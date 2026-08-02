// The rules of robbery. Pure logic lives here so it can be tested.
//
// Success: you grab 50-100% of the amount you attempted.
// Failure: you pay 150% of the attempted amount to your victim (ouch).
// Security items owned by the victim lower your success chance.

export const STEAL_BASE_CHANCE = 0.45; // 45% success against an unprotected target
export const STEAL_MIN_CHANCE = 0.05; // even a bodyguard can nap
export const STEAL_MIN_AMOUNT = 100;
export const PENALTY_RATE = 1.5; // lose 150% on failure
export const STEAL_COOLDOWN_MINUTES = 30; // between any two steal attempts
export const SAME_TARGET_COOLDOWN_MINUTES = 180; // between robbing the same person
export const NEW_USER_PROTECTION_HOURS = 24; // fresh accounts can't be robbed
export const MIN_TARGET_WALLET = 250; // too broke to be worth robbing

/** The most you can attempt with a given wallet (you must afford the 150% fine). */
export function maxAttempt(thiefWallet: number): number {
  return Math.floor(thiefWallet / PENALTY_RATE);
}

export interface StealOutcome {
  success: boolean;
  chance: number; // the success chance that was used
  stolen: number; // what the thief takes (0 on failure)
  penalty: number; // what the thief pays the victim (0 on success)
}

/**
 * Rolls the dice for one steal attempt.
 * `rng` is injectable so tests can force outcomes.
 */
export function resolveSteal(
  amount: number,
  securityReduction: number,
  rng: () => number = Math.random
): StealOutcome {
  const chance = Math.max(STEAL_MIN_CHANCE, STEAL_BASE_CHANCE - securityReduction);
  const success = rng() < chance;

  if (success) {
    const fraction = 0.5 + rng() * 0.5; // somewhere between 50% and 100%
    return { success, chance, stolen: Math.max(1, Math.round(amount * fraction)), penalty: 0 };
  }
  return { success, chance, stolen: 0, penalty: Math.round(amount * PENALTY_RATE) };
}
