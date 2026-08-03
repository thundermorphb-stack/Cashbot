// A self-test for the database. Run with:  npm run db:test
// It creates a pretend user, moves CASH around, prints the transaction log,
// and then deletes the pretend user again. Your real data is untouched.

import { prisma } from "../src/lib/db.ts";
import {
  addCash,
  removeCash,
  canAfford,
  computeDonation,
  getOrCreateUser,
  STARTING_BALANCE,
  DONATION_TAX_MIN_PCT,
  DONATION_TAX_MAX_PCT,
} from "../src/lib/economy.ts";
import { CURRENCIES, computeRate, toLocal, toCashValue, RATE_MIN, RATE_MAX } from "../src/lib/currency.ts";

const TEST_ID = "test-user-000";

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (!ok) process.exitCode = 1;
}

// Clean up any leftovers from a previous run.
await prisma.transaction.deleteMany({ where: { userId: TEST_ID } });
await prisma.user.deleteMany({ where: { id: TEST_ID } });

// 1. New accounts start with 500 CASH.
const user = await getOrCreateUser(TEST_ID);
check(`new user starts with ${STARTING_BALANCE} CASH`, user.wallet === STARTING_BALANCE);

// 2. Earning CASH updates wallet and totalEarned.
const afterEarn = await addCash(TEST_ID, 50, "Math Challenge");
check("wallet is 550 after earning 50", afterEarn.wallet === 550);
check("totalEarned is 50", afterEarn.totalEarned === 50);

// 3. Spending CASH updates wallet and totalSpent.
const afterSpend = await removeCash(TEST_ID, 200, "Failed Steal Attempt");
check("wallet is 350 after losing 200", afterSpend.wallet === 350);
check("totalSpent is 200", afterSpend.totalSpent === 200);

// 4. Overspending is blocked.
let blocked = false;
try {
  await removeCash(TEST_ID, 999999, "Impossible Purchase");
} catch {
  blocked = true;
}
check("spending more than you have is blocked", blocked);

// 5. canAfford answers correctly.
check("canAfford(100) is true", await canAfford(TEST_ID, 100));
check("canAfford(999999) is false", !(await canAfford(TEST_ID, 999999)));

// 5a. Two currencies: coins are a separate pocket from cash.
const beforeCoins = await getOrCreateUser(TEST_ID);
const withCoins = await addCash(TEST_ID, 300, "Coins Test", CURRENCIES.coins);
check("earning coins fills the coins pocket, not the wallet", withCoins.coins === 300 && withCoins.wallet === beforeCoins.wallet);
check("canAfford checks the right pocket", (await canAfford(TEST_ID, 300, CURRENCIES.coins)) && !(await canAfford(TEST_ID, 999_999, CURRENCIES.coins)));
let coinsOverdraft = false;
try {
  await removeCash(TEST_ID, 999_999, "Impossible", CURRENCIES.coins);
} catch {
  coinsOverdraft = true;
}
check("overspending coins is blocked", coinsOverdraft);
await removeCash(TEST_ID, 300, "Coins Test Cleanup", CURRENCIES.coins);

// 5a2. Exchange-rate math: supply decides worth.
check("equal supplies → 1 coin = 1 cash", computeRate(100_000, 100_000) === 1);
check("double the cash supply → 1 coin = ~2 cash", computeRate(225_000, 100_000) === 2);
check(`rate is clamped to [${RATE_MIN}, ${RATE_MAX}]`, computeRate(99_999_999, 0) === RATE_MAX && computeRate(0, 99_999_999) === RATE_MIN);
check("toLocal converts cash-worth into coins at the rate", toLocal(100, CURRENCIES.coins, 2) === 50);
check("toCashValue converts coins back into cash-worth", toCashValue(50, CURRENCIES.coins, 2) === 100);
check("cash amounts pass through both conversions unchanged", toLocal(100, CURRENCIES.cash, 2) === 100 && toCashValue(100, CURRENCIES.cash, 2) === 100);

// 5b. Donation tax always lands between 7% and 10%, and nothing goes missing.
let taxOk = true;
for (let i = 0; i < 5000; i++) {
  const { pct, tax, net } = computeDonation(1000);
  if (pct < DONATION_TAX_MIN_PCT || pct > DONATION_TAX_MAX_PCT) taxOk = false;
  if (net + tax !== 1000) taxOk = false; // recipient's share + tax must equal the gift
  if (tax < Math.ceil((1000 * DONATION_TAX_MIN_PCT) / 100)) taxOk = false;
}
check("donation tax stays within 7-10% and always adds up", taxOk);
check("donation tax rounds up on small gifts (10 CASH → 1 tax min)", computeDonation(10, () => 0).tax === 1);

// 6. Cooldowns: setting one makes it active; expired ones don't block.
const { getActiveCooldown, setCooldown } = await import("../src/lib/cooldowns.ts");
await setCooldown(TEST_ID, "math", 5);
check("cooldown is active right after being set", (await getActiveCooldown(TEST_ID, "math")) !== null);
await prisma.cooldown.update({
  where: { userId_command: { userId: TEST_ID, command: "math" } },
  data: { expiresAt: new Date(Date.now() - 1000) }, // force it into the past
});
check("expired cooldown no longer blocks", (await getActiveCooldown(TEST_ID, "math")) === null);
await prisma.cooldown.deleteMany({ where: { userId: TEST_ID } });

// 7. Every movement was logged.
const logbook = await prisma.transaction.findMany({
  where: { userId: TEST_ID },
  orderBy: { id: "asc" },
});
// welcome bonus, math, failed steal + 2 coins test moves
check("every movement was logged (5 transactions)", logbook.length === 5);

console.log("\nTransaction log for the test user:");
for (const t of logbook) {
  const sign = t.amount > 0 ? "+" : "";
  console.log(`  ${sign}${t.amount} CASH — ${t.reason}`);
}

// Clean up.
await prisma.transaction.deleteMany({ where: { userId: TEST_ID } });
await prisma.user.deleteMany({ where: { id: TEST_ID } });
await prisma.$disconnect();

console.log("\nDatabase test finished.");
