// The money rules of the two-country economy.
// Golden rule: money never moves without a Transaction log entry,
// so these helpers are the ONLY way commands should change balances.
//
// Every function takes a `currency` (💵 CASH by default). Balances live in
// User.wallet (cash) and User.coins (coins). Lifetime totals (totalEarned /
// totalSpent) are tracked in CASH-worth so leaderboards stay comparable.

import { prisma } from "./db.ts";
import { log } from "../logger.ts";
import { applyGarnishment } from "./loans.ts";
import {
  CURRENCIES,
  getExchangeRate,
  toCashValue,
  toLocal,
  type Currency,
} from "./currency.ts";

export const STARTING_BALANCE = 500;
export const CURRENCY = "💵 CASH";

/**
 * Finds a user's account, or creates one with the 500 CASH starting balance.
 * Called automatically the first time someone interacts with the bot.
 */
export async function getOrCreateUser(discordId: string) {
  let user = await prisma.user.findUnique({ where: { id: discordId } });

  if (!user) {
    user = await prisma.user.create({ data: { id: discordId } });
    await prisma.transaction.create({
      data: {
        userId: discordId,
        amount: STARTING_BALANCE,
        currency: "cash",
        reason: "Welcome Bonus",
      },
    });
    log.info(`New account created for ${discordId} with ${STARTING_BALANCE} CASH`);
  }

  return user;
}

/** The user's balance in the given currency. */
export function balanceOf(user: { wallet: number; coins: number }, currency: Currency): number {
  return currency.key === "cash" ? user.wallet : user.coins;
}

/** Gives money to a user and logs why. */
export async function addCash(
  discordId: string,
  amount: number,
  reason: string,
  currency: Currency = CURRENCIES.cash
) {
  if (amount <= 0) throw new Error(`addCash amount must be positive, got ${amount}`);
  await getOrCreateUser(discordId);
  const worth = currency.key === "cash" ? amount : toCashValue(amount, currency, await getExchangeRate());

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: discordId },
      data: {
        [currency.column]: { increment: amount },
        totalEarned: { increment: worth },
      },
    }),
    prisma.transaction.create({
      data: { userId: discordId, amount, currency: currency.key, reason },
    }),
  ]);

  log.info(`+${amount} ${currency.name} to ${discordId} (${reason})`);
  return user;
}

/**
 * Takes money from a user and logs why.
 * Throws an error if the user can't afford it — check first with canAfford().
 */
export async function removeCash(
  discordId: string,
  amount: number,
  reason: string,
  currency: Currency = CURRENCIES.cash
) {
  if (amount <= 0) throw new Error(`removeCash amount must be positive, got ${amount}`);
  const existing = await getOrCreateUser(discordId);
  const balance = balanceOf(existing, currency);

  if (balance < amount) {
    throw new Error(
      `${discordId} has ${balance} ${currency.name} but tried to spend ${amount}`
    );
  }
  const worth = currency.key === "cash" ? amount : toCashValue(amount, currency, await getExchangeRate());

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: discordId },
      data: {
        [currency.column]: { decrement: amount },
        totalSpent: { increment: worth },
      },
    }),
    prisma.transaction.create({
      data: { userId: discordId, amount: -amount, currency: currency.key, reason },
    }),
  ]);

  log.info(`-${amount} ${currency.name} from ${discordId} (${reason})`);
  return user;
}

/**
 * Pays out earned money with the user's job bonus applied, in the LOCAL
 * currency — always worth the same: `baseCashAmount` is in CASH-worth and is
 * converted at the live exchange rate for the coins country.
 *
 * If the earner is in debt (in this currency), earnings are garnished
 * straight to their lender — `garnishNote` describes what happened.
 */
export async function addEarnings(
  discordId: string,
  baseCashAmount: number,
  reason: string,
  currency: Currency = CURRENCIES.cash
) {
  const user = await getOrCreateUser(discordId);
  const rate = currency.key === "coins" ? await getExchangeRate() : 1;
  const localBase = toLocal(baseCashAmount, currency, rate);
  const bonus = Math.round(localBase * user.jobBonus);
  const total = localBase + bonus;
  await addCash(discordId, total, reason, currency);

  let garnishNote = "";
  const garnish = await applyGarnishment(discordId, total, currency);
  if (garnish) {
    garnishNote =
      `\n🏦 **Debt collection:** ${garnish.garnished.toLocaleString()} ${currency.emoji} went to <@${garnish.lenderId}>` +
      (garnish.remaining > 0
        ? ` — **${garnish.remaining.toLocaleString()} ${currency.name}** still owed.`
        : ` — **debt fully paid!** 🎉`);
  }

  return { total, base: localBase, bonus, garnishNote };
}

/** True if the user has at least `amount` of the currency on hand. */
export async function canAfford(
  discordId: string,
  amount: number,
  currency: Currency = CURRENCIES.cash
) {
  const user = await getOrCreateUser(discordId);
  return balanceOf(user, currency) >= amount;
}

// ---------------- Donations ----------------
// Players can gift money, but the taxman always takes his cut.
// The tax is destroyed (not given to anyone) — this quietly fights inflation.

export const DONATION_TAX_MIN_PCT = 7;
export const DONATION_TAX_MAX_PCT = 10;

/** Works out the tax on a donation. `rng` is injectable for tests. */
export function computeDonation(amount: number, rng: () => number = Math.random) {
  const pct =
    DONATION_TAX_MIN_PCT +
    Math.floor(rng() * (DONATION_TAX_MAX_PCT - DONATION_TAX_MIN_PCT + 1));
  const tax = Math.ceil((amount * pct) / 100);
  return { pct, tax, net: amount - tax };
}

// ---------------- Inflation ----------------
// Each currency has its own inflation, based on how much of IT exists.
// Flooded economy → prices up (×3 max); scarce money → prices down (×0.8).

/** How much money per member counts as "normal" (in local units). */
export const BASELINE_PER_USER = 2_000;
export const MIN_INFLATION = 0.8;
export const MAX_INFLATION = 3.0;

/** Pure math: turns total money supply + user count into a price multiplier. */
export function computeInflationMultiplier(supply: number, userCount: number): number {
  const baseline = Math.max(1, userCount) * BASELINE_PER_USER;
  const raw = supply / baseline;
  const clamped = Math.min(MAX_INFLATION, Math.max(MIN_INFLATION, raw));
  return Math.round(clamped * 100) / 100;
}

/** Reads one country's economy and returns its inflation numbers. */
export async function getInflation(currency: Currency = CURRENCIES.cash) {
  const aggregate = await prisma.user.aggregate({
    _sum: { wallet: true, coins: true },
    _count: true,
  });
  const supply =
    currency.key === "cash" ? (aggregate._sum.wallet ?? 0) : (aggregate._sum.coins ?? 0);
  const userCount = aggregate._count;
  return {
    supply,
    userCount,
    multiplier: computeInflationMultiplier(supply, userCount),
  };
}

/** Applies inflation to a base price, rounded to a tidy multiple of 50. */
export function inflatedPrice(basePrice: number, multiplier: number): number {
  return Math.max(50, Math.round((basePrice * multiplier) / 50) * 50);
}

/**
 * A shop/business price in the local currency: converts the CASH base price
 * at the exchange rate, then applies the local country's inflation.
 */
export async function localPrice(baseCashPrice: number, currency: Currency) {
  const rate = currency.key === "coins" ? await getExchangeRate() : 1;
  const inflation = await getInflation(currency);
  const price = inflatedPrice(toLocal(baseCashPrice, currency, rate), inflation.multiplier);
  return { price, inflation, rate };
}
