// Tiny key-value storage for server settings, e.g. which channel is the casino.

import { prisma } from "./db.ts";

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function deleteSetting(key: string) {
  await prisma.setting.deleteMany({ where: { key } });
}
