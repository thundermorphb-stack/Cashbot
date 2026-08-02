// Cooldown rules live here.
// A cooldown is stored in the database, so it survives bot restarts.
// Usage:
//   const until = await getActiveCooldown(userId, "math");
//   if (until) -> tell the user to wait
//   await setCooldown(userId, "math", 5); -> start a 5 minute cooldown

import { prisma } from "./db.ts";
import { getOrCreateUser } from "./economy.ts";

/** Returns when the cooldown ends, or null if the user is free to act. */
export async function getActiveCooldown(
  userId: string,
  command: string
): Promise<Date | null> {
  const cooldown = await prisma.cooldown.findUnique({
    where: { userId_command: { userId, command } },
  });
  if (!cooldown) return null;
  if (cooldown.expiresAt.getTime() <= Date.now()) return null; // already expired
  return cooldown.expiresAt;
}

/** Starts (or restarts) a cooldown lasting `minutes` minutes. */
export async function setCooldown(userId: string, command: string, minutes: number) {
  await getOrCreateUser(userId); // make sure the account exists first
  const expiresAt = new Date(Date.now() + minutes * 60_000);
  await prisma.cooldown.upsert({
    where: { userId_command: { userId, command } },
    update: { expiresAt },
    create: { userId, command, expiresAt },
  });
}

/**
 * Formats a date as a Discord "relative time" tag.
 * In chat it shows as e.g. "in 4 minutes" and counts down automatically.
 */
export function relativeTime(date: Date): string {
  return `<t:${Math.ceil(date.getTime() / 1000)}:R>`;
}
