// /deposit [amount] — move wallet CASH into the bank, where thieves can't
// touch it. Leave the amount empty to deposit everything.

import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { depositCash } from "../lib/economy.ts";

export const deposit: Command = {
  data: new SlashCommandBuilder()
    .setName("deposit")
    .setDescription("Move CASH into the bank — safe from thieves")
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("How much to deposit (leave empty for everything)")
        .setMinValue(1)
        .setRequired(false)
    ),

  async execute(interaction) {
    const amount = interaction.options.getInteger("amount") ?? undefined;
    try {
      const result = await depositCash(interaction.user.id, amount);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle("🏦 Deposit Complete")
            .setDescription(
              `${interaction.user} locked away **${result.moved.toLocaleString()} 💵 CASH**.\n` +
                `👛 Wallet: **${result.wallet.toLocaleString()}** · 🏦 Bank: **${result.bank.toLocaleString()}**`
            )
            .setFooter({ text: "Bank money is theft-proof — but you must withdraw to spend it." }),
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
