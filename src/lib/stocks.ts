// Stock market rules: price movement, buying, selling, and portfolios.
//
// Prices take a small random step every ~15 minutes (with a tiny upward
// drift, so patient investors are rewarded). Steps are applied lazily:
// whenever anyone looks at the market, we catch up on missed steps.

import { prisma } from "./db.ts";
import { addCash, canAfford, removeCash } from "./economy.ts";
import { STOCKS, findStock } from "../data/stocks.ts";

export const PRICE_STEP_MINUTES = 15;
const MAX_CATCHUP_STEPS = 12; // after long quiet periods, apply at most this many steps

/** One random price step. Slight upward drift: -96% to +104% of volatility. */
export function nextPrice(price: number, basePrice: number, volatility: number, rng: () => number = Math.random): number {
  const changePct = (rng() * 2 - 0.96) * volatility;
  const moved = Math.round(price * (1 + changePct));
  const floor = Math.max(5, Math.round(basePrice * 0.25));
  const ceiling = Math.round(basePrice * 4);
  return Math.min(ceiling, Math.max(floor, moved));
}

/** Makes sure every company exists in the database. Run at startup. */
export async function ensureStocks() {
  for (const stock of STOCKS) {
    await prisma.stock.upsert({
      where: { key: stock.key },
      update: {},
      create: { key: stock.key, price: stock.basePrice, prevPrice: stock.basePrice },
    });
  }
}

/** Catches stale prices up to the present, then returns all current prices. */
export async function getPrices() {
  await ensureStocks();
  const rows = await prisma.stock.findMany();
  const now = Date.now();

  for (const row of rows) {
    const minutesStale = (now - row.updatedAt.getTime()) / 60_000;
    const steps = Math.min(MAX_CATCHUP_STEPS, Math.floor(minutesStale / PRICE_STEP_MINUTES));
    if (steps <= 0) continue;

    const def = findStock(row.key)!;
    let price = row.price;
    for (let i = 0; i < steps; i++) price = nextPrice(price, def.basePrice, def.volatility);

    await prisma.stock.update({
      where: { key: row.key },
      data: { prevPrice: row.price, price, updatedAt: new Date() },
    });
    row.prevPrice = row.price;
    row.price = price;
  }

  return rows;
}

/** Buys shares at the current price. Throws with a friendly message if broke. */
export async function buyShares(userId: string, stockKey: string, shares: number) {
  const def = findStock(stockKey);
  if (!def) throw new Error("Unknown company");
  const prices = await getPrices();
  const price = prices.find((row) => row.key === stockKey)!.price;
  const cost = price * shares;

  if (!(await canAfford(userId, cost))) {
    throw new RangeError(
      `${shares} share(s) of ${def.name} cost ${cost.toLocaleString()} CASH right now — you can't afford that.`
    );
  }

  await removeCash(userId, cost, `Stock Purchase (${def.name})`);
  await prisma.investment.create({
    data: { userId, company: stockKey, shares, buyPrice: price },
  });
  return { price, cost };
}

/** Sells shares (oldest lots first) at the current price. */
export async function sellShares(userId: string, stockKey: string, shares: number) {
  const def = findStock(stockKey);
  if (!def) throw new Error("Unknown company");

  const lots = await prisma.investment.findMany({
    where: { userId, company: stockKey },
    orderBy: { boughtAt: "asc" },
  });
  const owned = lots.reduce((sum, lot) => sum + lot.shares, 0);
  if (shares > owned) {
    throw new RangeError(`You only own ${owned} share(s) of ${def.name}.`);
  }

  const prices = await getPrices();
  const price = prices.find((row) => row.key === stockKey)!.price;

  // Take shares from the oldest lots first, tracking what they originally cost.
  let toSell = shares;
  let costBasis = 0;
  for (const lot of lots) {
    if (toSell <= 0) break;
    const taken = Math.min(lot.shares, toSell);
    costBasis += taken * lot.buyPrice;
    toSell -= taken;
    if (taken === lot.shares) {
      await prisma.investment.delete({ where: { id: lot.id } });
    } else {
      await prisma.investment.update({
        where: { id: lot.id },
        data: { shares: lot.shares - taken },
      });
    }
  }

  const proceeds = price * shares;
  await addCash(userId, proceeds, `Stock Sale (${def.name})`);
  return { price, proceeds, costBasis, profit: proceeds - costBasis };
}

export interface Holding {
  key: string;
  name: string;
  shares: number;
  costBasis: number;
  currentPrice: number;
  value: number;
  profit: number;
}

/** Everything the user owns, valued at current prices. */
export async function getPortfolio(userId: string): Promise<Holding[]> {
  const lots = await prisma.investment.findMany({ where: { userId } });
  if (lots.length === 0) return [];
  const prices = await getPrices();

  const byCompany = new Map<string, { shares: number; costBasis: number }>();
  for (const lot of lots) {
    const entry = byCompany.get(lot.company) ?? { shares: 0, costBasis: 0 };
    entry.shares += lot.shares;
    entry.costBasis += lot.shares * lot.buyPrice;
    byCompany.set(lot.company, entry);
  }

  return [...byCompany.entries()].map(([key, entry]) => {
    const currentPrice = prices.find((row) => row.key === key)?.price ?? 0;
    const value = currentPrice * entry.shares;
    return {
      key,
      name: findStock(key)?.name ?? key,
      shares: entry.shares,
      costBasis: entry.costBasis,
      currentPrice,
      value,
      profit: value - entry.costBasis,
    };
  });
}
