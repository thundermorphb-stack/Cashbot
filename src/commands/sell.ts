// /sell — sell shares at the current price and pocket the CASH.

import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { sellShares } from "../lib/stocks.ts";
import { STOCKS, findStock } from "../data/stocks.ts";

export const sell: Command = {
  data: new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Sell shares you own")
    .addStringOption((option) =>
      option
        .setName("company")
        .setDescription("Which company's shares to sell")
        .setRequired(true)
        .addChoices(...STOCKS.map((stock) => ({ name: stock.name, value: stock.key })))
    )
    .addIntegerOption((option) =>
      option
        .setName("shares")
        .setDescription("How many shares to sell")
        .setMinValue(1)
        .setMaxValue(100_000)
        .setRequired(true)
    ),

  async execute(interaction) {
    const company = interaction.options.getString("company", true);
    const shares = interaction.options.getInteger("shares", true);
    await interaction.deferReply();

    try {
      const result = await sellShares(interaction.user.id, company, shares);
      const verdict =
        result.profit > 0
          ? `📈 Profit: **+${result.profit.toLocaleString()} CASH** — nice trade!`
          : result.profit < 0
            ? `📉 Loss: **${result.profit.toLocaleString()} CASH** — ouch.`
            : `➖ Broke exactly even.`;

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(result.profit >= 0 ? 0x2ecc71 : 0xe74c3c)
            .setTitle("💰 Shares Sold")
            .setDescription(
              `${interaction.user} sold **${shares.toLocaleString()} share(s)** of **${findStock(company)!.name}**\n` +
                `at 💵 **${result.price.toLocaleString()}**/share — received **${result.proceeds.toLocaleString()} CASH**.\n${verdict}`
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
