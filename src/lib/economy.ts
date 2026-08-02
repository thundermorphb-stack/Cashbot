// The money rules of CASH live here.
// Golden rule: CASH never moves without a Transaction log entry,
// so these helpers are the ONLY way commands should change balances.

import { prisma } from "./db.ts";
import { log } from "../logger.ts";
import { applyGarnishment } from "./loans.ts";

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
        reason: "Welcome Bonus",
      },
    });
    log.info(`New account created for ${discordId} with ${STARTING_BALANCE} CASH`);
  }

  return user;
}

/**
 * Gives CASH to a user's wallet and logs why.
 * Example: addCash("12345", 50, "Math Challenge")
 */
export async function addCash(discordId: string, amount: number, reason: string) {
  if (amount <= 0) throw new Error(`addCash amount must be positive, got ${amount}`);
  await getOrCreateUser(discordId);

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: discordId },
      data: {
        wallet: { increment: amount },
        totalEarned: { increment: amount },
      },
    }),
    prisma.transaction.create({
      data: { userId: discordId, amount, reason },
    }),
  ]);

  log.info(`+${amount} CASH to ${discordId} (${reason})`);
  return user;
}

/**
 * Takes CASH from a user's wallet and logs why.
 * Throws an error if the user can't afford it — check first with canAfford().
 * Example: removeCash("12345", 500, "Failed Steal Attempt")
 */
export async function removeCash(discordId: string, amount: number, reason: string) {
  if (amount <= 0) throw new Error(`removeCash amount must be positive, got ${amount}`);
  const existing = await getOrCreateUser(discordId);

  if (existing.wallet < amount) {
    throw new Error(
      `${discordId} has ${existing.wallet} CASH but tried to spend ${amount}`
    );
  }

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: discordId },
      data: {
        wallet: { decrement: amount },
        totalSpent: { increment: amount },
      },
    }),
    prisma.transaction.create({
      data: { userId: discordId, amount: -amount, reason },
    }),
  ]);

  log.info(`-${amount} CASH from ${discordId} (${reason})`);
  return user;
}

/**
 * Pays out earned CASH with the user's job bonus applied.
 * Example: base 100 with a +25% job = 125 CASH paid.
 * Use this for activity rewards (math, trivia, daily...);
 * use plain addCash for things a job shouldn't boost (drops, stolen money...).
 *
 * If the earner is in debt, their earnings are garnished straight to their
 * lender — `garnishNote` describes what happened (empty string when debt-free).
 */
export async function addEarnings(discordId: string, baseAmount: number, reason: string) {
  const user = await getOrCreateUser(discordId);
  const bonus = Math.round(baseAmount * user.jobBonus);
  const total = baseAmount + bonus;
  await addCash(discordId, total, reason);

  let garnishNote = "";
  const garnish = await applyGarnishment(discordId, total);
  if (garnish) {
    garnishNote =
      `\n🏦 **Debt collection:** ${garnish.garnished.toLocaleString()} CASH went to <@${garnish.lenderId}>` +
      (garnish.remaining > 0
        ? ` — **${garnish.remaining.toLocaleString()} CASH** still owed.`
        : ` — **debt fully paid!** 🎉`);
  }

  return { total, base: baseAmount, bonus, garnishNote };
}

/** True if the user has at least `amount` CASH in their wallet. */
export async function canAfford(discordId: string, amount: number) {
  const user = await getOrCreateUser(discordId);
  return user.wallet >= amount;
}

// ---------------- Donations ----------------
// Players can gift CASH, but the taxman always takes his cut.
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
// When the server is flooded with CASH, prices rise; when money is scarce,
// prices fall. This keeps the shop painful no matter how rich everyone gets.

/** How much CASH per member counts as "normal". */
export const BASELINE_PER_USER = 2_000;
export const MIN_INFLATION = 0.8; // prices never drop below 80% of base
export const MAX_INFLATION = 3.0; // ...and never rise above 300%

/** Pure math: turns total money supply + user count into a price multiplier. */
export function computeInflationMultiplier(supply: number, userCount: number): number {
  const baseline = Math.max(1, userCount) * BASELINE_PER_USER;
  const raw = supply / baseline;
  const clamped = Math.min(MAX_INFLATION, Math.max(MIN_INFLATION, raw));
  return Math.round(clamped * 100) / 100;
}

/** Reads the whole economy and returns the current inflation numbers. */
export async function getInflation() {
  const aggregate = await prisma.user.aggregate({
    _sum: { wallet: true, bank: true },
    _count: true,
  });
  const supply = (aggregate._sum.wallet ?? 0) + (aggregate._sum.bank ?? 0);
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
