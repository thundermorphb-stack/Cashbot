// Job rules: rolling a random job and the 5-rolls-per-day limit.
// Kept separate from the command file so the logic can be tested.

import { prisma } from "./db.ts";
import { getOrCreateUser } from "./economy.ts";
import { RARITIES, type Rarity } from "../data/jobs.ts";

export const ROLLS_PER_DAY = 5;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Picks a rarity using the weights (Common is likely, Legendary is not). */
export function rollRarity(): Rarity {
  const roll = randomInt(1, 100);
  let cumulative = 0;
  for (const [rarity, info] of Object.entries(RARITIES)) {
    cumulative += info.weight;
    if (roll <= cumulative) return rarity as Rarity;
  }
  return "common"; // can't happen (weights add up to 100), but keeps TypeScript happy
}

/**
 * How many rolls the user has left, and when the daily count refreshes.
 * `remaining` = free daily rolls + any admin-granted bonus rolls.
 */
export async function getRollStatus(userId: string) {
  const user = await getOrCreateUser(userId);
  const now = new Date();

  // If the 24h window has passed (or never started), the daily counter is fresh.
  const windowActive = user.jobRerollsResetAt && user.jobRerollsResetAt > now;
  const used = windowActive ? user.jobRerollsUsed : 0;
  const dailyRemaining = ROLLS_PER_DAY - used;

  return {
    used,
    dailyRemaining,
    bonusRolls: user.bonusRolls,
    remaining: dailyRemaining + user.bonusRolls,
    resetAt: windowActive ? user.jobRerollsResetAt : (null as Date | null),
  };
}

/** Admin action: hand someone extra job rolls (they never expire). */
export async function grantRolls(userId: string, count: number) {
  await getOrCreateUser(userId);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { bonusRolls: { increment: count } },
  });
  return user.bonusRolls;
}

/**
 * Rolls a new job for the user (rarity → job name → exact bonus),
 * saves it, and spends one of today's rolls.
 * Throws if the user has no rolls left — check getRollStatus() first.
 */
export async function rollJob(userId: string) {
  const status = await getRollStatus(userId);
  if (status.remaining <= 0) {
    throw new Error(`${userId} has no job rolls left today`);
  }

  const rarity = rollRarity();
  const info = RARITIES[rarity];
  const name = info.jobs[randomInt(0, info.jobs.length - 1)];
  // Exact bonus somewhere in the rarity's range, e.g. rare = 20% to 35%.
  const bonus =
    Math.round((info.minBonus + Math.random() * (info.maxBonus - info.minBonus)) * 100) / 100;

  // Make sure this job exists in the Job table, then link the user to it.
  const job = await prisma.job.upsert({
    where: { name },
    update: {},
    create: { name, rarity, bonus: (info.minBonus + info.maxBonus) / 2 },
  });

  // Spend a free daily roll first; only dip into bonus rolls when those run out.
  const usingDailyRoll = status.dailyRemaining > 0;
  // First daily roll of a fresh window starts a new 24h timer.
  const resetAt = status.resetAt ?? new Date(Date.now() + 24 * 60 * 60_000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      jobId: job.id,
      jobBonus: bonus,
      ...(usingDailyRoll
        ? { jobRerollsUsed: status.used + 1, jobRerollsResetAt: resetAt }
        : { bonusRolls: { decrement: 1 } }),
    },
  });

  return {
    name,
    rarity,
    bonus,
    rollsLeft: status.remaining - 1,
    resetAt,
  };
}
