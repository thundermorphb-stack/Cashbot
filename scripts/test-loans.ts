// Self-test for the loan system. Run with: npm run loans:test
// Uses two pretend users (a loan shark and a victim), cleans up afterwards.

import { prisma } from "../src/lib/db.ts";
import { addCash, addEarnings, getOrCreateUser } from "../src/lib/economy.ts";
import {
  applyGarnishment,
  computeOwed,
  createLoan,
  forgiveLoan,
  repayLoan,
  MAX_OWED_MULTIPLIER,
  PERIOD_MINUTES,
} from "../src/lib/loans.ts";

const SHARK = "test-user-000";
const VICTIM = "test-user-001";
let failures = 0;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (!ok) failures++;
}

async function cleanup() {
  for (const id of [SHARK, VICTIM]) {
    await prisma.loan.deleteMany({ where: { OR: [{ lenderId: id }, { borrowerId: id }] } });
    await prisma.transaction.deleteMany({ where: { userId: id } });
    await prisma.cooldown.deleteMany({ where: { userId: id } });
    await prisma.user.deleteMany({ where: { id } });
  }
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

// ---- Interest math (pure) ----
const base = { principal: 1000, ratePct: 5, repaid: 0 };
check("brand new loan: owed = principal", computeOwed({ ...base, startedAt: new Date() }) === 1000);
check(
  "after 3 ticks at 5%: owed = 1150",
  computeOwed({ ...base, startedAt: minutesAgo(PERIOD_MINUTES * 3 + 1) }) === 1150
);
check(
  `debt caps at ${MAX_OWED_MULTIPLIER}× principal even after ages`,
  computeOwed({ ...base, startedAt: minutesAgo(60 * 24 * 365) }) === 1000 * MAX_OWED_MULTIPLIER
);
check(
  "repayments reduce what's owed",
  computeOwed({ ...base, repaid: 400, startedAt: new Date() }) === 600
);

// ---- The full loan lifecycle against the database ----
await cleanup();
await getOrCreateUser(SHARK);
await getOrCreateUser(VICTIM);
await addCash(SHARK, 5000, "Test Funding");

// Lender pays out, borrower receives.
await createLoan(SHARK, VICTIM, 2000, 5);
const sharkAfter = await prisma.user.findUnique({ where: { id: SHARK } });
const victimAfter = await prisma.user.findUnique({ where: { id: VICTIM } });
check("lender's wallet went down by the principal", sharkAfter!.wallet === 5500 - 2000);
check("borrower's wallet went up by the principal", victimAfter!.wallet === 500 + 2000);

// One debt at a time.
let secondBlocked = false;
try {
  await createLoan(SHARK, VICTIM, 100, 1);
} catch {
  secondBlocked = true;
}
check("a second loan to the same borrower is blocked", secondBlocked);

// Earnings are garnished to the lender.
const paid = await addEarnings(VICTIM, 300, "Math Challenge (test)");
check("earning while in debt produces a garnish note", paid.garnishNote.includes("Debt collection"));
const victimGarnished = await prisma.user.findUnique({ where: { id: VICTIM } });
const sharkGarnished = await prisma.user.findUnique({ where: { id: SHARK } });
check("borrower kept none of the 300 earned", victimGarnished!.wallet === 2500);
check("lender received the 300", sharkGarnished!.wallet === 3800);
const loanNow = await prisma.loan.findFirst({ where: { borrowerId: VICTIM } });
check("the loan's books recorded the 300 as repaid", loanNow!.repaid === 300);

// Manual repayment clears the rest and closes the loan.
const result = await repayLoan(VICTIM, undefined);
check("full repayment pays exactly what's left (1700)", result.payment === 1700 && result.remaining === 0);
check("loan is deleted once fully paid", (await prisma.loan.count({ where: { borrowerId: VICTIM } })) === 0);
check("debt-free earnings have no garnish note", (await addEarnings(VICTIM, 50, "Test")).garnishNote === "");

// Garnishment only takes what's owed, not everything earned.
await createLoan(SHARK, VICTIM, 100, 0);
const partial = await applyGarnishment(VICTIM, 999);
check("garnish takes only the 100 owed out of 999 earned", partial!.garnished === 100 && partial!.remaining === 0);

// Forgiveness wipes the slate.
await createLoan(SHARK, VICTIM, 500, 2);
const { forgiven } = await forgiveLoan(SHARK, VICTIM);
check("forgiving returns the wiped amount", forgiven === 500);
check("forgiven loan is gone", (await prisma.loan.count({ where: { borrowerId: VICTIM } })) === 0);

await cleanup();
await prisma.$disconnect();

if (failures > 0) {
  console.log(`\n${failures} problem(s) found.`);
  process.exit(1);
}
console.log("\nLoans test finished.");
