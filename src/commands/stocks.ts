// /stocks — today's market board with prices and recent movement.

import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { getPrices, PRICE_STEP_MINUTES } from "../lib/stocks.ts";
import { findStock } from "../data/stocks.ts";

export const stocks: Command = {
  data: new SlashCommandBuilder()
    .setName("stocks")
    .setDescription("See the stock market prices"),

  async execute(interaction) {
    await interaction.deferReply();
    const prices = await getPrices();

    const lines = prices.map((row) => {
      const def = findStock(row.key)!;
      const diff = row.price - row.prevPrice;
      const pct = row.prevPrice > 0 ? ((diff / row.prevPrice) * 100).toFixed(1) : "0.0";
      const arrow = diff > 0 ? `📈 +${pct}%` : diff < 0 ? `📉 ${pct}%` : "➖ 0.0%";
      return `**${def.name}** — 💵 **${row.price.toLocaleString()}**/share  ${arrow}`;
    });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x16a085)
          .setTitle("📊 The CASH Stock Market")
          .setDescription(lines.join("\n"))
          .setFooter({
            text: `Prices move every ~${PRICE_STEP_MINUTES} min • Buy with /invest, sell with /sell`,
          }),
      ],
    });
  },
};
