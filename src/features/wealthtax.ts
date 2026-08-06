// The wealth tax: once a day, everyone carrying more than 100,000 CASH-worth
// of money (cash + coins combined) pays 5% of the EXCESS. The taxed money is
// destroyed — hoarded fortunes melt, spent ones don't.
//
// Example: carrying 300,000 → excess 200,000 → pays 10,000 that day.

import { prisma } from "../lib/db.ts";
import { removeCash, balanceOf } from "../lib/economy.ts";
import { CURRENCIES, getExchangeRate } from "../lib/currency.ts";
import { getSetting, setSetting } from "../lib/settings.ts";
import { log } from "../logger.ts";

export const WEALTH_TAX_THRESHOLD = 100_000; // CASH-worth of money on hand
export const WEALTH_TAX_RATE = 0.05; // of the excess, once per day
const LAST_RUN_KEY = "wealth_tax_last_run";
const CHECK_EVERY_MINUTES = 60;

/** Pure math: how much someone carrying `worth` owes today. */
export function computeWealthTax(worth: number): number {
  if (worth <= WEALTH_TAX_THRESHOLD) return 0;
  return Math.round((worth - WEALTH_TAX_THRESHOLD) * WEALTH_TAX_RATE);
}

/** Taxes one user, splitting the bill across their two currencies. */
export async function taxUserWealth(
  user: { id: string; wallet: number; coins: number },
  rate: number
) {
  const worth = user.wallet + Math.round(user.coins * rate);
  const tax = computeWealthTax(worth);
  if (tax <= 0) return 0;

  // Pay proportionally from each pocket, never more than the pocket holds.
  const cashPart = Math.min(user.wallet, Math.round(tax * (user.wallet / worth)));
  const coinsWorthPart = tax - cashPart;
  const coinsPart = Math.min(user.coins, Math.round(coinsWorthPart / rate));

  if (cashPart > 0) await removeCash(user.id, cashPart, "Wealth Tax", CURRENCIES.cash);
  if (coinsPart > 0) await removeCash(user.id, coinsPart, "Wealth Tax", CURRENCIES.coins);
  return cashPart + Math.round(coinsPart * rate);
}

/** One full collection round across every account. */
export async function collectWealthTax() {
  const rate = await getExchangeRate();
  const users = await prisma.user.findMany();
  let collected = 0;
  let payers = 0;

  for (const user of users) {
    const paid = await taxUserWealth(user, rate).catch(() => 0);
    if (paid > 0) {
      collected += paid;
      payers++;
    }
  }

  if (payers > 0) {
    log.info(`Wealth tax day: collected ~${collected.toLocaleString()} CASH-worth from ${payers} tycoon(s)`);
  }
  return { payers, collected };
}

/** Checks hourly whether 24h have passed since the last collection. */
export function startWealthTax() {
  const run = async () => {
    try {
      const last = Number((await getSetting(LAST_RUN_KEY)) ?? 0);
      if (Date.now() - last < 24 * 60 * 60_000) return;
      await setSetting(LAST_RUN_KEY, String(Date.now()));
      await collectWealthTax();
    } catch (error) {
      log.error("Wealth tax collection failed:", error);
    }
  };
  run(); // check once at startup (catches missed days while offline)
  setInterval(run, CHECK_EVERY_MINUTES * 60_000);
}
