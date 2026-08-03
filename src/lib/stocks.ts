// Stock market rules: price movement, buying, selling, portfolios,
// and player-founded companies.
//
// Prices move two ways:
//  1. A small random step every ~15 minutes (with a tiny upward drift).
//  2. DEMAND: every buy pushes the price up (~0.5% per share, max +25% per
//     trade) and every sell pushes it down — so the more players invest in
//     a company, the higher its stock climbs.
//
// Player companies: founded with /business found (the bot names them, no
// duplicates, max 2 per player). The founder earns a 5% cut of every CASH
// amount other players invest. Once the server has 10 player-owned
// companies, the 5 default companies are delisted (investors get paid out).

import { prisma } from "./db.ts";
import { addCash, canAfford, removeCash } from "./economy.ts";
import { getSetting, setSetting } from "./settings.ts";
import { log } from "../logger.ts";
import { DEFAULT_STOCKS, GENRES, genreEmoji, type GenreKey } from "../data/stocks.ts";

export const PRICE_STEP_MINUTES = 15;
const MAX_CATCHUP_STEPS = 12; // after long quiet periods, apply at most this many steps

export const FOUND_COST_BASE = 25_000; // founding a company (before inflation)
export const MAX_COMPANIES_PER_PLAYER = 2;
export const FOUNDER_CUT = 0.05; // founders earn 5% of others' investments
export const DELIST_THRESHOLD = 10; // player companies needed to retire the defaults
export const NEW_COMPANY_PRICE = 100;
const DELISTED_FLAG = "defaults_delisted";

// Demand impact of one trade: 0.5% per share, capped at ±25% per trade.
const IMPACT_PER_SHARE = 0.005;
const MAX_IMPACT = 0.25;

type StockRow = Awaited<ReturnType<typeof prisma.stock.findFirstOrThrow>>;

export function displayName(row: { name: string; genre: string }): string {
  return `${genreEmoji(row.genre)} ${row.name}`;
}

/** One random price step. Slight upward drift: -96% to +104% of volatility. */
export function nextPrice(
  price: number,
  basePrice: number,
  volatility: number,
  rng: () => number = Math.random
): number {
  const changePct = (rng() * 2 - 0.96) * volatility;
  const moved = Math.round(price * (1 + changePct));
  return clampPrice(moved, basePrice);
}

function clampPrice(price: number, basePrice: number): number {
  const floor = Math.max(5, Math.round(basePrice * 0.25));
  const ceiling = Math.round(basePrice * 20); // demand can pump far above base
  return Math.min(ceiling, Math.max(floor, price));
}

/** Seeds the 5 default companies (unless they've been delisted for good). */
export async function ensureStocks() {
  if (await getSetting(DELISTED_FLAG)) return;
  for (const stock of DEFAULT_STOCKS) {
    await prisma.stock.upsert({
      where: { key: stock.key },
      update: {
        name: stock.name,
        genre: stock.genre,
        basePrice: stock.basePrice,
        volatility: stock.volatility,
      },
      create: {
        key: stock.key,
        name: stock.name,
        genre: stock.genre,
        basePrice: stock.basePrice,
        volatility: stock.volatility,
        price: stock.basePrice,
        prevPrice: stock.basePrice,
      },
    });
  }
}

/** Catches stale prices up to the present, then returns all listed stocks. */
export async function getPrices() {
  await ensureStocks();
  const rows = await prisma.stock.findMany();
  const now = Date.now();

  for (const row of rows) {
    const minutesStale = (now - row.updatedAt.getTime()) / 60_000;
    const steps = Math.min(MAX_CATCHUP_STEPS, Math.floor(minutesStale / PRICE_STEP_MINUTES));
    if (steps <= 0) continue;

    let price = row.price;
    for (let i = 0; i < steps; i++) price = nextPrice(price, row.basePrice, row.volatility);

    await prisma.stock.update({
      where: { key: row.key },
      data: { prevPrice: row.price, price, updatedAt: new Date() },
    });
    row.prevPrice = row.price;
    row.price = price;
  }

  return rows;
}

/** Finds a stock by key, exact name, or closest partial name match. */
export async function resolveStock(input: string) {
  const byKey = await prisma.stock.findUnique({ where: { key: input } });
  if (byKey) return byKey;
  return prisma.stock.findFirst({
    where: { name: { contains: input.trim() } },
    orderBy: { createdAt: "asc" },
  });
}

/** Name search for the /invest and /sell autocomplete boxes. */
export async function searchStocks(query: string, limit = 25) {
  await ensureStocks();
  return prisma.stock.findMany({
    where: query.trim() ? { name: { contains: query.trim() } } : {},
    orderBy: [{ price: "desc" }],
    take: limit,
  });
}

/** Demand: buys push the price up, sells push it down. */
async function applyTradeImpact(row: StockRow, shares: number, direction: 1 | -1) {
  const impact = Math.min(MAX_IMPACT, IMPACT_PER_SHARE * shares);
  const newPrice = clampPrice(Math.round(row.price * (1 + direction * impact)), row.basePrice);
  await prisma.stock.update({
    where: { key: row.key },
    data: { prevPrice: row.price, price: newPrice, updatedAt: new Date() },
  });
}

/** Buys shares at the current price. Throws RangeError with a friendly message. */
export async function buyShares(userId: string, stockKey: string, shares: number) {
  await getPrices();
  const row = await prisma.stock.findUnique({ where: { key: stockKey } });
  if (!row) throw new RangeError("That company isn't listed (anymore).");
  const cost = row.price * shares;

  if (!(await canAfford(userId, cost))) {
    throw new RangeError(
      `${shares} share(s) of ${displayName(row)} cost ${cost.toLocaleString()} CASH right now — you can't afford that.`
    );
  }

  await removeCash(userId, cost, `Stock Purchase (${row.name})`);
  await prisma.investment.create({
    data: { userId, company: stockKey, shares, buyPrice: row.price },
  });

  // The founder earns a cut when OTHER players invest in their company.
  let founderCut = 0;
  if (row.ownerId && row.ownerId !== userId) {
    founderCut = Math.round(cost * FOUNDER_CUT);
    if (founderCut > 0) await addCash(row.ownerId, founderCut, `Founder's Cut (${row.name})`);
  }

  await applyTradeImpact(row, shares, 1); // demand pushes the price up
  return { price: row.price, cost, row, founderCut };
}

/** Sells shares (oldest lots first) at the current price. */
export async function sellShares(userId: string, stockKey: string, shares: number) {
  const row = await prisma.stock.findUnique({ where: { key: stockKey } });
  if (!row) throw new RangeError("That company isn't listed (anymore).");

  const lots = await prisma.investment.findMany({
    where: { userId, company: stockKey },
    orderBy: { boughtAt: "asc" },
  });
  const owned = lots.reduce((sum, lot) => sum + lot.shares, 0);
  if (shares > owned) {
    throw new RangeError(`You only own ${owned} share(s) of ${displayName(row)}.`);
  }

  await getPrices();
  const fresh = await prisma.stock.findUnique({ where: { key: stockKey } });
  const price = fresh!.price;

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
  await addCash(userId, proceeds, `Stock Sale (${row.name})`);
  await applyTradeImpact(fresh!, shares, -1); // sell-off pushes the price down
  return { price, proceeds, costBasis, profit: proceeds - costBasis, row };
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
    const row = prices.find((r) => r.key === key);
    const currentPrice = row?.price ?? 0;
    const value = currentPrice * entry.shares;
    return {
      key,
      name: row ? displayName(row) : key,
      shares: entry.shares,
      costBasis: entry.costBasis,
      currentPrice,
      value,
      profit: value - entry.costBasis,
    };
  });
}

// ---------------- Player-founded companies ----------------

/** Builds a unique company name for the genre. */
export async function generateCompanyName(genre: GenreKey): Promise<string> {
  const { prefixes, suffixes } = GENRES[genre];
  const combos: string[] = [];
  for (const prefix of prefixes) for (const suffix of suffixes) combos.push(`${prefix}${suffix}`);
  // Shuffle so names come out in a fresh order every time.
  for (let i = combos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combos[i], combos[j]] = [combos[j], combos[i]];
  }
  for (const name of combos) {
    const taken = await prisma.stock.findFirst({ where: { name } });
    if (!taken) return name;
  }
  throw new RangeError(`Every possible ${GENRES[genre].label} name is taken! Try another genre.`);
}

export async function countPlayerCompanies(): Promise<number> {
  return prisma.stock.count({ where: { ownerId: { not: null } } });
}

/**
 * Founds a new company: charges the founder, generates the name, lists the
 * stock. If this takes the server to 10 player companies, the defaults are
 * delisted (their investors are paid out at the current price).
 */
export async function foundCompany(ownerId: string, genre: GenreKey, cost: number) {
  const mine = await prisma.stock.count({ where: { ownerId } });
  if (mine >= MAX_COMPANIES_PER_PLAYER) {
    throw new RangeError(`You already run ${MAX_COMPANIES_PER_PLAYER} companies — even tycoons have limits.`);
  }
  if (!(await canAfford(ownerId, cost))) {
    throw new RangeError(`Founding a company costs ${cost.toLocaleString()} CASH right now — you can't afford it.`);
  }

  const name = await generateCompanyName(genre);
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");

  await removeCash(ownerId, cost, `Founded Company (${name})`);
  const row = await prisma.stock.create({
    data: {
      key,
      name,
      genre,
      ownerId,
      price: NEW_COMPANY_PRICE,
      prevPrice: NEW_COMPANY_PRICE,
      basePrice: NEW_COMPANY_PRICE,
      volatility: 0.12,
    },
  });

  // Historic moment: 10 player companies → the old guard retires.
  let delisted: string[] = [];
  if ((await countPlayerCompanies()) >= DELIST_THRESHOLD && !(await getSetting(DELISTED_FLAG))) {
    delisted = await delistDefaultCompanies();
  }

  return { row, name, delisted };
}

/** Pays out every investor in the default companies, then removes them. */
async function delistDefaultCompanies(): Promise<string[]> {
  const defaults = await prisma.stock.findMany({ where: { ownerId: null } });
  const names: string[] = [];

  for (const stock of defaults) {
    const lots = await prisma.investment.findMany({ where: { company: stock.key } });
    for (const lot of lots) {
      await addCash(lot.userId, lot.shares * stock.price, `Stock Delisting Payout (${stock.name})`);
    }
    await prisma.investment.deleteMany({ where: { company: stock.key } });
    await prisma.stock.delete({ where: { key: stock.key } });
    names.push(stock.name);
    log.info(`Delisted default company ${stock.name}, paid out ${lots.length} position(s)`);
  }

  await setSetting(DELISTED_FLAG, "true");
  return names;
}
