// Self-test for investments, inventory expiry, and leaderboard math.
// Run with: npm run phase6:test — uses a pretend user, cleans up afterwards.

import { prisma } from "../src/lib/db.ts";
import { addCash, getOrCreateUser } from "../src/lib/economy.ts";
import { buyShares, sellShares, getPortfolio, nextPrice, ensureStocks } from "../src/lib/stocks.ts";
import { ensureShopItems, addToInventory } from "../src/lib/shop.ts";
import { sweepExpiredItems } from "../src/features/expiry.ts";
import { findShopItem } from "../src/data/shop.ts";
import { DEFAULT_STOCKS as STOCKS } from "../src/data/stocks.ts";

const TEST_ID = "test-user-000";
let failures = 0;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.investment.deleteMany({ where: { userId: TEST_ID } });
  await prisma.inventoryItem.deleteMany({ where: { userId: TEST_ID } });
  await prisma.transaction.deleteMany({ where: { userId: TEST_ID } });
  await prisma.cooldown.deleteMany({ where: { userId: TEST_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_ID } });
}

await cleanup();
await getOrCreateUser(TEST_ID);
await ensureShopItems();
await ensureStocks();

// ---- Price movement stays inside the guard rails ----
const def = STOCKS[0];
let priceInBounds = true;
let price = def.basePrice;
for (let i = 0; i < 10_000; i++) {
  price = nextPrice(price, def.basePrice, def.volatility);
  const floor = Math.max(5, Math.round(def.basePrice * 0.25));
  if (price < floor || price > def.basePrice * 8) priceInBounds = false;
}
check("10,000 price steps never leave the 25%-800% guard rails", priceInBounds);

// No more money printer: no upward drift, and pumped prices deflate.
const neutralRng = () => 0.51; // makes the random part exactly zero
check("no free upward drift at the base price", nextPrice(100, 100, 0.12, () => 0.5) <= 100);
check("pumped prices get pulled back toward base (200 → 195)", nextPrice(200, 100, 0.12, neutralRng) === 195);
check("crashed prices recover toward base (50 → 53)", nextPrice(50, 100, 0.12, neutralRng) === 53);

// ---- Buying and selling ----
await addCash(TEST_ID, 100_000, "Test Funding");
const buy = await buyShares(TEST_ID, def.key, 10);
check("bought 10 shares at a positive price", buy.price > 0 && buy.cost === buy.price * 10);

const afterBuy = await prisma.user.findUnique({ where: { id: TEST_ID } });
check("wallet went down by exactly the cost", afterBuy!.wallet === 100_500 - buy.cost);

let portfolio = await getPortfolio(TEST_ID);
check("portfolio shows the 10 shares", portfolio.length === 1 && portfolio[0].shares === 10);

// The buy-then-instantly-sell exploit is dead: new shares must settle first.
let settling = false;
try {
  await sellShares(TEST_ID, def.key, 1);
} catch {
  settling = true;
}
check("freshly bought shares can't be sold (30-min settlement)", settling);
await prisma.investment.updateMany({
  where: { userId: TEST_ID },
  data: { boughtAt: new Date(Date.now() - 31 * 60_000) }, // pretend time passed
});

const sale = await sellShares(TEST_ID, def.key, 4);
const gross = sale.price * 4;
check(
  "sale pays the post-impact price × 4 minus the 5% broker fee",
  sale.proceeds === gross - Math.round(gross * 0.05) && sale.fee === Math.round(gross * 0.05)
);

portfolio = await getPortfolio(TEST_ID);
check("6 shares remain after selling 4", portfolio[0].shares === 6);

let overSell = false;
try {
  await sellShares(TEST_ID, def.key, 999);
} catch {
  overSell = true;
}
check("selling more than you own is blocked", overSell);

let overBuy = false;
try {
  await buyShares(TEST_ID, def.key, 100_000);
} catch {
  overBuy = true;
}
check("buying beyond your wallet is blocked", overBuy);

const logged = await prisma.transaction.count({
  where: { userId: TEST_ID, reason: { contains: "Stock" } },
});
check("both trades were logged in the transaction history", logged === 2);

// ---- Inventory expiry sweep ----
await addToInventory(TEST_ID, findShopItem("padlock")!);
const padlockRow = await prisma.inventoryItem.findFirst({ where: { userId: TEST_ID } });
await prisma.inventoryItem.update({
  where: { id: padlockRow!.id },
  data: { expiresAt: new Date(Date.now() - 1000) }, // force-expire it
});
await addToInventory(TEST_ID, findShopItem("bodyguard")!); // still active

const sweptCount = await sweepExpiredItems([]);
const remaining = await prisma.inventoryItem.findMany({ where: { userId: TEST_ID } });
check("sweep removed exactly the expired item", sweptCount >= 1 && remaining.length === 1);
check("the active item survived the sweep", remaining[0].shopItemId !== padlockRow!.shopItemId);

// ---- Thieves leaderboard math ----
await prisma.transaction.createMany({
  data: [
    { userId: TEST_ID, amount: 300, reason: "Steal Success" },
    { userId: TEST_ID, amount: 200, reason: "Steal Success" },
  ],
});
const thieves = await prisma.transaction.groupBy({
  by: ["userId"],
  where: { reason: "Steal Success" },
  _sum: { amount: true },
});
const me = thieves.find((row) => row.userId === TEST_ID);
check("thieves board sums steal successes (300+200=500)", me?._sum.amount === 500);

await cleanup();
await prisma.$disconnect();

if (failures > 0) {
  console.log(`\n${failures} problem(s) found.`);
  process.exit(1);
}
console.log("\nPhase 6+7 test finished.");
