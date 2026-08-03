// /invest — buy shares. Start typing the company name and the bot suggests
// the closest matches (that's how you find niche companies not on /stocks).

import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { buyShares, displayName, resolveStock, searchStocks } from "../lib/stocks.ts";

export const invest: Command = {
  data: new SlashCommandBuilder()
    .setName("invest")
    .setDescription("Buy shares in a company")
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
        .setDescription("How many shares to buy")
        .setMinValue(1)
        .setMaxValue(100_000)
        .setRequired(true)
    ),

  // Fills the dropdown while the user is typing a company name.
  async autocomplete(interaction) {
    const query = interaction.options.getFocused();
    const rows = await searchStocks(query);
    await interaction.respond(
      rows.map((row) => ({
        name: `${displayName(row)} — ${row.price.toLocaleString()}/share`.slice(0, 100),
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
      await interaction.editReply(
        `🔍 No company matches "${input}". Check /stocks or start typing to see suggestions.`
      );
      return;
    }

    try {
      const { price, cost, row } = await buyShares(interaction.user.id, stock.key, shares);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x16a085)
            .setTitle("🧾 Shares Purchased")
            .setDescription(
              `${interaction.user} bought **${shares.toLocaleString()} share(s)** of **${displayName(row)}**\n` +
                `at 💵 **${price.toLocaleString()}**/share — total **${cost.toLocaleString()} CASH**.\n` +
                `📈 The buy-in pushed the price up!`
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
