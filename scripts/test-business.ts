// Self-test for player companies: founding, name uniqueness, demand-driven
// prices, the founder's cut, search, and the delisting of default companies.
// Run with: npm run business:test — cleans up and restores defaults after.

import { prisma } from "../src/lib/db.ts";
import { addCash, getOrCreateUser } from "../src/lib/economy.ts";
import {
  buyShares,
  sellShares,
  countPlayerCompanies,
  ensureStocks,
  foundCompany,
  searchStocks,
  resolveStock,
  DELIST_THRESHOLD,
  FOUNDER_CUT,
  NEW_COMPANY_PRICE,
} from "../src/lib/stocks.ts";
import { deleteSetting } from "../src/lib/settings.ts";
import { DEFAULT_STOCKS } from "../src/data/stocks.ts";

const FOUNDER = "test-user-000";
const INVESTOR = "test-user-001";
const EXTRA = (n: number) => `test-user-extra-${n}`;
let failures = 0;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (!ok) failures++;
}

async function cleanup() {
  const testIds = [FOUNDER, INVESTOR, ...Array.from({ length: 8 }, (_, i) => EXTRA(i))];
  await prisma.stock.deleteMany({ where: { ownerId: { in: testIds } } });
  for (const id of testIds) {
    await prisma.investment.deleteMany({ where: { userId: id } });
    await prisma.transaction.deleteMany({ where: { userId: id } });
    await prisma.cooldown.deleteMany({ where: { userId: id } });
    await prisma.user.deleteMany({ where: { id } });
  }
  await deleteSetting("defaults_delisted"); // bring the default companies back
  await ensureStocks();
}

await cleanup();
await getOrCreateUser(FOUNDER);
await getOrCreateUser(INVESTOR);
await addCash(FOUNDER, 200_000, "Test Funding");
await addCash(INVESTOR, 200_000, "Test Funding");

// ---- Founding ----
const company = await foundCompany(FOUNDER, "space", 25_000);
check("founding creates a stock owned by the founder", company.row.ownerId === FOUNDER);
check("new company IPOs at the standard price", company.row.price === NEW_COMPANY_PRICE);
const founderPaid = await prisma.user.findUnique({ where: { id: FOUNDER } });
check("founder paid the founding cost", founderPaid!.wallet === 200_500 - 25_000);

// Names are unique, bot-generated, and genre-flavored.
const second = await foundCompany(FOUNDER, "space", 25_000);
check("two companies never share a name", second.name !== company.name);
let thirdBlocked = false;
try {
  await foundCompany(FOUNDER, "tech", 25_000);
} catch {
  thirdBlocked = true;
}
check("a player can't run more than 2 companies", thirdBlocked);

// ---- Demand moves prices ----
const buy = await buyShares(INVESTOR, company.row.key, 20);
const afterBuy = await prisma.stock.findUnique({ where: { key: company.row.key } });
check("a 20-share buy pushes the price up ~10%", afterBuy!.price === Math.round(buy.price * 1.1));

// ---- Founder's cut ----
check(`founder's cut is ${FOUNDER_CUT * 100}% of the investment`, buy.founderCut === Math.round(buy.cost * FOUNDER_CUT));
const founderRich = await prisma.user.findUnique({ where: { id: FOUNDER } });
check("founder actually received the cut", founderRich!.wallet === 200_500 - 50_000 + buy.founderCut);
const selfBuy = await buyShares(FOUNDER, company.row.key, 1);
check("no founder's cut when investing in your own company", selfBuy.founderCut === 0);

await prisma.investment.updateMany({
  where: { userId: INVESTOR },
  data: { boughtAt: new Date(Date.now() - 31 * 60_000) }, // age past settlement
});
const sellPriceBefore = (await prisma.stock.findUnique({ where: { key: company.row.key } }))!.price;
await sellShares(INVESTOR, company.row.key, 20);
const afterSell = await prisma.stock.findUnique({ where: { key: company.row.key } });
check("a 20-share sell pushes the price down ~10%", afterSell!.price === Math.round(sellPriceBefore * 0.9));

// ---- Search / autocomplete matching ----
const fragment = company.name.slice(2, 8);
const matches = await searchStocks(fragment);
check(`searching "${fragment}" finds ${company.name}`, matches.some((row) => row.key === company.row.key));
const resolved = await resolveStock(company.name.slice(0, 5));
check("partial names resolve to the closest company", resolved !== null);

// ---- Delisting at 10 player companies ----
// We have 2; found 8 more with extra test users. The INVESTOR holds default
// shares and must get refunded when the defaults are delisted.
await buyShares(INVESTOR, DEFAULT_STOCKS[0].key, 5);
const walletBeforeDelist = (await prisma.user.findUnique({ where: { id: INVESTOR } }))!.wallet;
const defaultPrice = (await prisma.stock.findUnique({ where: { key: DEFAULT_STOCKS[0].key } }))!.price;

let sawDelist: string[] = [];
for (let i = 0; i < 8; i++) {
  const id = EXTRA(i);
  await getOrCreateUser(id);
  await addCash(id, 30_000, "Test Funding");
  const result = await foundCompany(id, "crypto", 25_000);
  if (result.delisted.length > 0) sawDelist = result.delisted;
}
check("the 10th player company triggered the delisting", sawDelist.length === DEFAULT_STOCKS.length);
check("player company count reached the threshold", (await countPlayerCompanies()) >= DELIST_THRESHOLD);
check("default companies are gone from the market", (await prisma.stock.count({ where: { ownerId: null } })) === 0);
const walletAfterDelist = (await prisma.user.findUnique({ where: { id: INVESTOR } }))!.wallet;
check(
  "default-stock investors were paid out at market price",
  walletAfterDelist === walletBeforeDelist + 5 * defaultPrice
);

await cleanup();
check("cleanup restored the default companies", (await prisma.stock.count({ where: { ownerId: null } })) === DEFAULT_STOCKS.length);
await prisma.$disconnect();

if (failures > 0) {
  console.log(`\n${failures} problem(s) found.`);
  process.exit(1);
}
console.log("\nBusiness test finished.");
