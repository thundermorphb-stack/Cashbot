// Shop plumbing: keeps the ShopItem table in sync with the catalog,
// records purchases in the inventory, and answers "how protected is this user?"

import { prisma } from "./db.ts";
import { SHOP_ITEMS, findShopItem, type ShopItemDef } from "../data/shop.ts";

/** Makes sure every catalog item exists in the database. Run at startup. */
export async function ensureShopItems() {
  for (const item of SHOP_ITEMS) {
    await prisma.shopItem.upsert({
      where: { name: item.key },
      update: {
        description: item.description,
        price: item.basePrice,
        type: item.type,
        durationMin: item.durationDays ? item.durationDays * 24 * 60 : null,
      },
      create: {
        name: item.key, // we store the stable key; display name lives in the catalog
        description: item.description,
        price: item.basePrice,
        type: item.type,
        durationMin: item.durationDays ? item.durationDays * 24 * 60 : null,
      },
    });
  }
}

/** Stores a purchased item in the user's inventory. */
export async function addToInventory(
  userId: string,
  item: ShopItemDef,
  metadata?: Record<string, string>
) {
  const shopItem = await prisma.shopItem.findUnique({ where: { name: item.key } });
  if (!shopItem) throw new Error(`Shop item ${item.key} missing — run ensureShopItems first`);

  return prisma.inventoryItem.create({
    data: {
      userId,
      shopItemId: shopItem.id,
      expiresAt: item.durationDays
        ? new Date(Date.now() + item.durationDays * 24 * 60 * 60_000)
        : null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

/**
 * The user's best active (not expired) security item.
 * Returns how much it lowers a thief's success chance, e.g. 0.28 for the alarm.
 */
export async function getActiveSecurity(userId: string) {
  const items = await prisma.inventoryItem.findMany({
    where: {
      userId,
      shopItem: { type: "security" },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { shopItem: true },
  });

  let best = { reduction: 0, name: null as string | null };
  for (const owned of items) {
    const def = findShopItem(owned.shopItem.name);
    if (def?.securityReduction && def.securityReduction > best.reduction) {
      best = { reduction: def.securityReduction, name: def.name };
    }
  }
  return best;
}
