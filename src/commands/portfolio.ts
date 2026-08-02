// /portfolio — everything you own on the market, and how it's doing.

import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { getPortfolio } from "../lib/stocks.ts";

export const portfolio: Command = {
  data: new SlashCommandBuilder()
    .setName("portfolio")
    .setDescription("See your stock holdings and profit"),

  async execute(interaction) {
    await interaction.deferReply();
    const holdings = await getPortfolio(interaction.user.id);

    if (holdings.length === 0) {
      await interaction.editReply(
        "📭 You don't own any shares yet. Check `/stocks` and buy some with `/invest`!"
      );
      return;
    }

    const lines = holdings.map((holding) => {
      const sign = holding.profit >= 0 ? "+" : "";
      const icon = holding.profit >= 0 ? "📈" : "📉";
      return (
        `**${holding.name}** — ${holding.shares.toLocaleString()} share(s)\n` +
        `-# worth **${holding.value.toLocaleString()} CASH** (paid ${holding.costBasis.toLocaleString()}) ${icon} ${sign}${holding.profit.toLocaleString()}`
      );
    });

    const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
    const totalProfit = holdings.reduce((sum, holding) => sum + holding.profit, 0);
    const sign = totalProfit >= 0 ? "+" : "";

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(totalProfit >= 0 ? 0x2ecc71 : 0xe74c3c)
          .setTitle(`💼 ${interaction.user.displayName}'s Portfolio`)
          .setDescription(lines.join("\n"))
          .setFooter({
            text: `Total value: ${totalValue.toLocaleString()} CASH • Unrealized: ${sign}${totalProfit.toLocaleString()} CASH`,
          }),
      ],
    });
  },
};
