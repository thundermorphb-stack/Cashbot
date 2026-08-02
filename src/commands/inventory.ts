// /inventory — everything you've bought that you still own.
// Temporary items show a live countdown; the bot removes them automatically
// when they expire (see src/features/expiry.ts).

import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { prisma } from "../lib/db.ts";
import { findShopItem } from "../data/shop.ts";
import { relativeTime } from "../lib/cooldowns.ts";

export const inventory: Command = {
  data: new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("See the items you own"),

  async execute(interaction) {
    const items = await prisma.inventoryItem.findMany({
      where: {
        userId: interaction.user.id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { shopItem: true },
      orderBy: { acquiredAt: "desc" },
    });

    if (items.length === 0) {
      await interaction.reply(
        "🎒 Your inventory is empty. Browse `/shop` and treat yourself!"
      );
      return;
    }

    const lines = items.map((item) => {
      const def = findShopItem(item.shopItem.name);
      const name = def?.name ?? item.shopItem.name;
      const expiry = item.expiresAt ? `expires ${relativeTime(item.expiresAt)}` : "permanent ♾️";
      return `**${name}** — ${expiry}`;
    });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x8e44ad)
          .setTitle(`🎒 ${interaction.user.displayName}'s Inventory`)
          .setDescription(lines.join("\n"))
          .setFooter({ text: "Expired items are removed automatically" }),
      ],
    });
  },
};
