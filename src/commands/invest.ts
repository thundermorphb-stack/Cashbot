// /invest — buy shares of a fictional company at the current price.

import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { buyShares } from "../lib/stocks.ts";
import { STOCKS, findStock } from "../data/stocks.ts";

export const invest: Command = {
  data: new SlashCommandBuilder()
    .setName("invest")
    .setDescription("Buy shares in a company")
    .addStringOption((option) =>
      option
        .setName("company")
        .setDescription("Which company to invest in (see /stocks for prices)")
        .setRequired(true)
        .addChoices(...STOCKS.map((stock) => ({ name: stock.name, value: stock.key })))
    )
    .addIntegerOption((option) =>
      option
        .setName("shares")
        .setDescription("How many shares to buy")
        .setMinValue(1)
        .setMaxValue(100_000)
        .setRequired(true)
    ),

  async execute(interaction) {
    const company = interaction.options.getString("company", true);
    const shares = interaction.options.getInteger("shares", true);
    await interaction.deferReply();

    try {
      const { price, cost } = await buyShares(interaction.user.id, company, shares);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x16a085)
            .setTitle("🧾 Shares Purchased")
            .setDescription(
              `${interaction.user} bought **${shares.toLocaleString()} share(s)** of **${findStock(company)!.name}**\n` +
                `at 💵 **${price.toLocaleString()}**/share — total **${cost.toLocaleString()} CASH**.`
            )
            .setFooter({ text: "Track it with /portfolio — sell with /sell" }),
        ],
      });
    } catch (error) {
      if (error instanceof RangeError) {
        await interaction.editReply(`💸 ${error.message}`);
        return;
      }
      throw error;
    }
  },
};
