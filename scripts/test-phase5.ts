// Self-test for stealing, security, and inflation. Run with: npm run phase5:test
// Uses a pretend user and cleans up afterwards.

import { prisma } from "../src/lib/db.ts";
import {
  computeInflationMultiplier,
  inflatedPrice,
  BASELINE_PER_USER,
  MIN_INFLATION,
  MAX_INFLATION,
  getOrCreateUser,
} from "../src/lib/economy.ts";
import { maxAttempt, resolveSteal, STEAL_BASE_CHANCE, STEAL_MIN_CHANCE } from "../src/lib/steal.ts";
import { ensureShopItems, addToInventory, getActiveSecurity } from "../src/lib/shop.ts";
import { findShopItem, SHOP_ITEMS } from "../src/data/shop.ts";

const TEST_ID = "test-user-000";
let failures = 0;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (!ok) failures++;
}

// ---- Steal math (pure logic, forced dice) ----
const alwaysWin = () => 0; // rng of 0 → always below the chance → success
const alwaysLose = () => 0.9999; // rng near 1 → always fails

const win = resolveSteal(1000, 0, alwaysWin);
check("forced win is a success", win.success);
check("forced win with rng 0 pays exactly 50% (500)", win.stolen === 500);

const loss = resolveSteal(1000, 0, alwaysLose);
check("forced loss is a failure", !loss.success);
check("failure penalty is exactly 150% (1500)", loss.penalty === 1500);

// Stolen amount stays between 50% and 100% across many real rolls.
// (First dice roll forced to "win", second roll left random for the payout.)
function winThenRandom() {
  let first = true;
  return () => (first ? ((first = false), 0) : Math.random());
}
let inRange = true;
for (let i = 0; i < 5000; i++) {
  const roll = resolveSteal(1000, 0, winThenRandom());
  if (!roll.success || roll.stolen < 500 || roll.stolen > 1000) inRange = false;
}
check("stolen amounts always land between 50% and 100%", inRange);

check("security reduces the success chance", resolveSteal(100, 0.28).chance === STEAL_BASE_CHANCE - 0.28);
check(`chance never drops below ${STEAL_MIN_CHANCE}`, resolveSteal(100, 0.99).chance === STEAL_MIN_CHANCE);
check("maxAttempt: 1500 wallet can attempt at most 1000", maxAttempt(1500) === 1000);

// ---- Inflation math ----
check(
  "normal supply → multiplier 1.0",
  computeInflationMultiplier(BASELINE_PER_USER * 10, 10) === 1
);
check(
  "double the money → multiplier 2.0",
  computeInflationMultiplier(BASELINE_PER_USER * 10 * 2, 10) === 2
);
check(
  `flooded economy is capped at ×${MAX_INFLATION}`,
  computeInflationMultiplier(BASELINE_PER_USER * 1000, 10) === MAX_INFLATION
);
check(
  `broke economy is floored at ×${MIN_INFLATION}`,
  computeInflationMultiplier(0, 10) === MIN_INFLATION
);
check("inflatedPrice rounds to a tidy 50: 1500 × 1.37 → 2050", inflatedPrice(1500, 1.37) === 2050);
check("inflatedPrice at ×1 keeps the base price", inflatedPrice(12000, 1) === 12000);

// ---- Catalog sanity ----
check("all shop item keys are unique", new Set(SHOP_ITEMS.map((i) => i.key)).size === SHOP_ITEMS.length);
check(
  "all security items define a reduction and duration",
  SHOP_ITEMS.filter((i) => i.type === "security").every((i) => i.securityReduction && i.durationDays)
);

// ---- Security lookup against the real database ----
async function cleanup() {
  await prisma.inventoryItem.deleteMany({ where: { userId: TEST_ID } });
  await prisma.transaction.deleteMany({ where: { userId: TEST_ID } });
  await prisma.cooldown.deleteMany({ where: { userId: TEST_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_ID } });
}
await cleanup();
await getOrCreateUser(TEST_ID);
await ensureShopItems();

check("no security → zero reduction", (await getActiveSecurity(TEST_ID)).reduction === 0);

await addToInventory(TEST_ID, findShopItem("padlock")!);
await addToInventory(TEST_ID, findShopItem("alarm_system")!);
const best = await getActiveSecurity(TEST_ID);
check("best owned security wins (alarm 28% beats padlock 10%)", best.reduction === 0.28);

// Expire the alarm — the padlock should take over.
const alarmRow = await prisma.inventoryItem.findFirst({
  where: { userId: TEST_ID, shopItem: { name: "alarm_system" } },
});
await prisma.inventoryItem.update({
  where: { id: alarmRow!.id },
  data: { expiresAt: new Date(Date.now() - 1000) },
});
check("expired security stops counting", (await getActiveSecurity(TEST_ID)).reduction === 0.1);

await cleanup();
await prisma.$disconnect();

if (failures > 0) {
  console.log(`\n${failures} problem(s) found.`);
  process.exit(1);
}
console.log("\nPhase 5 test finished.");
