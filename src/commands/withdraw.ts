// /withdraw [amount] — take CASH out of the bank and back into your wallet
// (needed for shopping, investing, lending... and yes, it's stealable again).

import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { withdrawCash } from "../lib/economy.ts";

export const withdraw: Command = {
  data: new SlashCommandBuilder()
    .setName("withdraw")
    .setDescription("Take CASH out of the bank so you can spend it")
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("How much to withdraw (leave empty for everything)")
        .setMinValue(1)
        .setRequired(false)
    ),

  async execute(interaction) {
    const amount = interaction.options.getInteger("amount") ?? undefined;
    try {
      const result = await withdrawCash(interaction.user.id, amount);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle("💸 Withdrawal Complete")
            .setDescription(
              `${interaction.user} took out **${result.moved.toLocaleString()} 💵 CASH**.\n` +
                `👛 Wallet: **${result.wallet.toLocaleString()}** · 🏦 Bank: **${result.bank.toLocaleString()}**`
            )
            .setFooter({ text: "Careful — wallet money can be stolen!" }),
        ],
      });
    } catch (error) {
      if (error instanceof RangeError) {
        await interaction.reply({ content: `🤷 ${error.message}`, flags: MessageFlags.Ephemeral });
        return;
      }
      throw error;
    }
  },
};
