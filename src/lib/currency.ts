// The two-country currency system.
//
// 💵 CASH is the currency of the home server; 🪙 COINS belongs to the sister
// server. Everyone can HOLD both, but each server only USES its own.
//
// The exchange rate follows supply: if twice as much CASH exists as COINS,
// then 1 coin is worth 2 cash. Rewards everywhere pay the same real WORTH —
// so a daily reward in the coins country pays fewer/more coins to equal the
// same cash-value.

import { prisma } from "./db.ts";

export type CurrencyKey = "cash" | "coins";

export const CURRENCIES = {
  cash: { key: "cash" as const, name: "CASH", emoji: "💵", column: "wallet" as const },
  coins: { key: "coins" as const, name: "COINS", emoji: "🪙", column: "coins" as const },
};

export type Currency = (typeof CURRENCIES)[CurrencyKey];

/** Which currency a server uses. Unknown servers default to CASH. */
export function currencyForGuild(guildId: string | null | undefined): Currency {
  const coinsGuild = process.env.COINS_GUILD_ID;
  if (guildId && coinsGuild && guildId === coinsGuild) return CURRENCIES.coins;
  return CURRENCIES.cash;
}

/** "1,234 💵 CASH" */
export function fmt(amount: number, currency: Currency): string {
  return `${amount.toLocaleString()} ${currency.emoji} ${currency.name}`;
}

export const RATE_MIN = 0.25; // 1 coin is never worth less than 0.25 cash
export const RATE_MAX = 4; // ...or more than 4 cash
const SMOOTHING = 25_000; // keeps the rate near 1.0 while both economies are tiny

/** Pure math: supplies in → how much CASH one COIN is worth. */
export function computeRate(cashSupply: number, coinsSupply: number): number {
  const raw = (cashSupply + SMOOTHING) / (coinsSupply + SMOOTHING);
  return Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, raw)) * 100) / 100;
}

/** Live exchange rate: 1 coin = `rate` cash. */
export async function getExchangeRate(): Promise<number> {
  const agg = await prisma.user.aggregate({ _sum: { wallet: true, coins: true } });
  return computeRate(agg._sum.wallet ?? 0, agg._sum.coins ?? 0);
}

/** Converts a CASH-denominated amount into the local currency at `rate`. */
export function toLocal(cashAmount: number, currency: Currency, rate: number): number {
  if (currency.key === "cash") return cashAmount;
  return Math.max(1, Math.round(cashAmount / rate));
}

/** Converts a local-currency amount into its CASH-worth at `rate`. */
export function toCashValue(amount: number, currency: Currency, rate: number): number {
  if (currency.key === "cash") return amount;
  return Math.round(amount * rate);
}
