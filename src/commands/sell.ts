// /sell — sell shares at the current price. Company name autocompletes.

import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { prisma } from "../lib/db.ts";
import { displayName, resolveStock, sellShares } from "../lib/stocks.ts";
import { currencyForGuild, fmt } from "../lib/currency.ts";

export const sell: Command = {
  data: new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Sell shares you own")
    .addStringOption((option) =>
      option
        .setName("company")
        .setDescription("Start typing a name — the bot will suggest matches")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("shares")
        .setDescription("How many shares to sell")
        .setMinValue(1)
        .setMaxValue(100_000)
        .setRequired(true)
    ),

  // Suggest only companies the seller actually owns shares in.
  async autocomplete(interaction) {
    const query = interaction.options.getFocused().trim().toLowerCase();
    const lots = await prisma.investment.findMany({
      where: { userId: interaction.user.id },
      select: { company: true, shares: true },
    });
    const owned = new Map<string, number>();
    for (const lot of lots) owned.set(lot.company, (owned.get(lot.company) ?? 0) + lot.shares);

    const rows = await prisma.stock.findMany({ where: { key: { in: [...owned.keys()] } } });
    await interaction.respond(
      rows
        .filter((row) => !query || row.name.toLowerCase().includes(query))
        .slice(0, 25)
        .map((row) => ({
          name: `${displayName(row)} — you own ${owned.get(row.key)} share(s)`.slice(0, 100),
          value: row.key,
        }))
    );
  },

  async execute(interaction) {
    const input = interaction.options.getString("company", true);
    const shares = interaction.options.getInteger("shares", true);
    await interaction.deferReply();

    const stock = await resolveStock(input);
    if (!stock) {
      await interaction.editReply(`🔍 No company matches "${input}".`);
      return;
    }

    try {
      const currency = currencyForGuild(interaction.guildId);
      const result = await sellShares(interaction.user.id, stock.key, shares, currency);
      const verdict =
        result.profit > 0
          ? `📈 Profit: **+${result.profit.toLocaleString()} ${currency.name}** — nice trade!`
          : result.profit < 0
            ? `📉 Loss: **${result.profit.toLocaleString()} ${currency.name}** — ouch.`
            : `➖ Broke exactly even.`;

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(result.profit >= 0 ? 0x2ecc71 : 0xe74c3c)
            .setTitle("💰 Shares Sold")
            .setDescription(
              `${interaction.user} sold **${shares.toLocaleString()} share(s)** of **${displayName(result.row)}**\n` +
                `at 💵 **${result.price.toLocaleString()}**/share — received **${fmt(result.proceeds, currency)}**.\n${verdict}\n` +
                `📉 The sell-off pushed the price down.`
            ),
        ],
      });
    } catch (error) {
      if (error instanceof RangeError) {
        await interaction.editReply(`🤨 ${error.message}`);
        return;
      }
      throw error;
    }
  },
};
