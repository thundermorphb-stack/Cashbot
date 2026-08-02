// The expiry sweeper: every 10 minutes it looks for inventory items whose
// time is up, undoes their effect in Discord (removes the role, deletes the
// rented channel...), and clears them out of the inventory.

import type { Client, Guild } from "discord.js";
import { prisma } from "../lib/db.ts";
import { findShopItem } from "../data/shop.ts";
import { log } from "../logger.ts";

const SWEEP_EVERY_MINUTES = 10;

/** Undo one expired item's effect in Discord. Best effort — never throws. */
async function undoPerk(guild: Guild, userId: string, itemKey: string, metadata: Record<string, string>) {
  try {
    switch (itemKey) {
      case "role_color":
      case "custom_role": {
        if (metadata.roleId) {
          const role = await guild.roles.fetch(metadata.roleId).catch(() => null);
          if (role) await role.delete("CASH shop item expired");
        }
        break;
      }
      case "vip": {
        // The VIP role is shared — take it off this member, keep the role.
        if (metadata.roleId) {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) await member.roles.remove(metadata.roleId, "VIP expired");
        }
        break;
      }
      case "rent_text_channel":
      case "rent_voice_channel": {
        if (metadata.channelId) {
          const channel = await guild.channels.fetch(metadata.channelId).catch(() => null);
          if (channel) await channel.delete("CASH rental expired");
        }
        break;
      }
      // Security items and permanent perks need no cleanup.
    }
  } catch (error) {
    log.warn(`Could not fully clean up expired ${itemKey} for ${userId}:`, error);
  }
}

/**
 * One sweep: find everything expired, undo it, delete the inventory rows.
 * `guild` may be null in tests — then Discord cleanup is skipped.
 */
export async function sweepExpiredItems(guild: Guild | null) {
  const expired = await prisma.inventoryItem.findMany({
    where: { expiresAt: { lte: new Date() } },
    include: { shopItem: true },
  });

  for (const item of expired) {
    const key = item.shopItem.name;
    const def = findShopItem(key);
    const metadata = item.metadata ? (JSON.parse(item.metadata) as Record<string, string>) : {};

    if (guild) await undoPerk(guild, item.userId, key, metadata);
    await prisma.inventoryItem.delete({ where: { id: item.id } });
    log.info(`Expired: ${def?.name ?? key} (user ${item.userId})`);
  }

  return expired.length;
}

/** Starts the repeating sweep. Call once when the bot is ready. */
export function startExpirySweeper(client: Client, guildId: string) {
  const run = async () => {
    try {
      const guild = await client.guilds.fetch(guildId);
      await sweepExpiredItems(guild);
    } catch (error) {
      log.error("Expiry sweep failed:", error);
    }
  };
  run(); // once at startup, to catch anything that expired while offline
  setInterval(run, SWEEP_EVERY_MINUTES * 60_000);
}
