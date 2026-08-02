// Self-test for the job system. Run with: npm run jobs:test
// Uses a pretend user, then cleans up. Your real data is untouched.

import { prisma } from "../src/lib/db.ts";
import { addEarnings, getOrCreateUser } from "../src/lib/economy.ts";
import { getRollStatus, rollJob, rollRarity, ROLLS_PER_DAY } from "../src/lib/jobs.ts";
import { RARITIES, type Rarity } from "../src/data/jobs.ts";

const TEST_ID = "test-user-000";
let failures = 0;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.transaction.deleteMany({ where: { userId: TEST_ID } });
  await prisma.cooldown.deleteMany({ where: { userId: TEST_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_ID } });
}

await cleanup();
await getOrCreateUser(TEST_ID);

// 1. Rarity weights: roll 10,000 times, make sure rare things are rarer.
const counts: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
for (let i = 0; i < 10_000; i++) counts[rollRarity()]++;
check("common is the most frequent rarity", counts.common > counts.uncommon);
check("legendary is the least frequent rarity", counts.legendary < counts.epic);
check("every rarity can be rolled", Object.values(counts).every((c) => c > 0));
console.log(
  "   distribution:",
  Object.entries(counts)
    .map(([r, c]) => `${r} ${(c / 100).toFixed(1)}%`)
    .join(", ")
);

// 2. Rolling a job gives a bonus inside the rarity's advertised range.
const rolled = await rollJob(TEST_ID);
const range = RARITIES[rolled.rarity];
check(
  `rolled "${rolled.name}" (${rolled.rarity}) bonus ${rolled.bonus} is within ${range.minBonus}-${range.maxBonus}`,
  rolled.bonus >= range.minBonus && rolled.bonus <= range.maxBonus
);
check("job list for that rarity contains the job", (range.jobs as readonly string[]).includes(rolled.name));

// 3. The 5-per-day limit is enforced.
for (let i = 0; i < ROLLS_PER_DAY - 1; i++) await rollJob(TEST_ID); // use up the rest
const status = await getRollStatus(TEST_ID);
check("no rolls remaining after using all 5", status.remaining === 0);
let blocked = false;
try {
  await rollJob(TEST_ID);
} catch {
  blocked = true;
}
check("6th roll of the day is blocked", blocked);

// 4. After the 24h window passes, rolls come back.
await prisma.user.update({
  where: { id: TEST_ID },
  data: { jobRerollsResetAt: new Date(Date.now() - 1000) }, // pretend a day passed
});
const refreshed = await getRollStatus(TEST_ID);
check("rolls refresh after the window ends", refreshed.remaining === ROLLS_PER_DAY);

// 5. Job bonus increases earnings, spec example: 100 base at +25% pays 125.
await prisma.user.update({ where: { id: TEST_ID }, data: { jobBonus: 0.25 } });
const paid = await addEarnings(TEST_ID, 100, "Bonus Test");
check("100 CASH at +25% job bonus pays 125", paid.total === 125 && paid.bonus === 25);

// 6. The payout was logged with the full amount.
const lastLog = await prisma.transaction.findFirst({
  where: { userId: TEST_ID, reason: "Bonus Test" },
});
check("the 125 CASH payout was logged", lastLog?.amount === 125);

await cleanup();
await prisma.$disconnect();

if (failures > 0) {
  console.log(`\n${failures} problem(s) found.`);
  process.exit(1);
}
console.log("\nJobs test finished.");
