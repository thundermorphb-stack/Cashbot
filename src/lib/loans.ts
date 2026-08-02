// Loan rules: interest that ticks up every 20 minutes, debt collection,
// and repayment. The scary part of capitalism lives in this file.
//
// - Interest is simple (not compounding): owed = principal × (1 + rate% × periods)
// - Total owed is capped at 5× the principal, so debt can't spiral forever.
// - While in debt, EVERYTHING the borrower earns (math, trivia, daily) is
//   garnished — sent straight to the lender — until the debt is cleared.

import { prisma } from "./db.ts";
import { addCash, removeCash } from "./economy.ts";
import { log } from "../logger.ts";

export const PERIOD_MINUTES = 20; // how often interest ticks
export const MAX_RATE_PCT = 10; // lenders can charge at most 10% per tick
export const MAX_OWED_MULTIPLIER = 5; // debt never exceeds 5× the principal
export const MIN_LOAN = 100;

type LoanRow = { principal: number; ratePct: number; startedAt: Date; repaid: number };

/** How much is owed on a loan right now (interest included, cap applied). */
export function computeOwed(loan: LoanRow, now: number = Date.now()): number {
  const periods = Math.floor((now - loan.startedAt.getTime()) / (PERIOD_MINUTES * 60_000));
  const grossOwed = Math.min(
    Math.round(loan.principal * (1 + (loan.ratePct / 100) * Math.max(0, periods))),
    loan.principal * MAX_OWED_MULTIPLIER
  );
  return Math.max(0, grossOwed - loan.repaid);
}

/** The one loan this user currently owes money on (borrowers max out at one). */
export async function getLoanAsBorrower(userId: string) {
  return prisma.loan.findFirst({ where: { borrowerId: userId } });
}

/** All loans this user has handed out. */
export async function getLoansAsLender(userId: string) {
  return prisma.loan.findMany({ where: { lenderId: userId } });
}

/**
 * Moves the money and opens the loan (call only after the borrower accepted).
 * Throws with a friendly message if the rules are broken.
 */
export async function createLoan(
  lenderId: string,
  borrowerId: string,
  principal: number,
  ratePct: number
) {
  if (await getLoanAsBorrower(borrowerId)) {
    throw new RangeError("They already have an active loan — one debt at a time!");
  }
  // removeCash throws if the lender can't afford it anymore.
  await removeCash(lenderId, principal, "Loan Sent");
  await addCash(borrowerId, principal, "Loan Received");
  return prisma.loan.create({
    data: { lenderId, borrowerId, principal, ratePct },
  });
}

/** Applies a payment to the loan's books; closes it when fully paid. */
async function recordPayment(loanId: number, previousRepaid: number, payment: number, owedBefore: number) {
  if (payment >= owedBefore) {
    await prisma.loan.delete({ where: { id: loanId } });
    return 0; // debt cleared
  }
  await prisma.loan.update({
    where: { id: loanId },
    data: { repaid: previousRepaid + payment },
  });
  return owedBefore - payment;
}

/**
 * Debt collection: called automatically whenever a borrower earns CASH.
 * Takes up to `earnedAmount` from them and hands it to their lender.
 * Returns null if the user is debt-free.
 */
export async function applyGarnishment(borrowerId: string, earnedAmount: number) {
  const loan = await getLoanAsBorrower(borrowerId);
  if (!loan) return null;

  const owed = computeOwed(loan);
  if (owed <= 0) {
    await prisma.loan.delete({ where: { id: loan.id } }); // stale, fully-paid loan
    return null;
  }

  const garnished = Math.min(earnedAmount, owed);
  if (garnished <= 0) return null;

  await removeCash(borrowerId, garnished, "Debt Collection");
  await addCash(loan.lenderId, garnished, "Debt Collection");
  const remaining = await recordPayment(loan.id, loan.repaid, garnished, owed);

  log.info(`Garnished ${garnished} CASH from ${borrowerId} → ${loan.lenderId} (${remaining} still owed)`);
  return { garnished, remaining, lenderId: loan.lenderId };
}

/** Manual repayment from the borrower's wallet. */
export async function repayLoan(borrowerId: string, requestedAmount?: number) {
  const loan = await getLoanAsBorrower(borrowerId);
  if (!loan) throw new RangeError("You don't owe anyone anything. Enjoy it!");

  const owed = computeOwed(loan);
  const payment = Math.min(requestedAmount ?? owed, owed);

  // removeCash throws if their wallet is too small.
  await removeCash(borrowerId, payment, "Loan Repayment");
  await addCash(loan.lenderId, payment, "Loan Repayment");
  const remaining = await recordPayment(loan.id, loan.repaid, payment, owed);

  return { payment, remaining, lenderId: loan.lenderId };
}

/** The lender wipes the remaining debt. */
export async function forgiveLoan(lenderId: string, borrowerId: string) {
  const loan = await prisma.loan.findFirst({ where: { lenderId, borrowerId } });
  if (!loan) throw new RangeError("They don't owe you anything.");
  const owed = computeOwed(loan);
  await prisma.loan.delete({ where: { id: loan.id } });
  return { forgiven: owed };
}
