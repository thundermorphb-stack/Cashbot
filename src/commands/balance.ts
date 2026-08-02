// /balance — shows your CASH account.
// If you don't have an account yet, one is created automatically
// with the 500 CASH starting balance.

import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { getOrCreateUser } from "../lib/economy.ts";
import { prisma } from "../lib/db.ts";

export const balance: Command = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your CASH balance"),

  async execute(interaction) {
    const user = await getOrCreateUser(interaction.user.id);
    const netWorth = user.wallet + user.bank;
    const job = user.jobId
      ? await prisma.job.findUnique({ where: { id: user.jobId } })
      : null;
    const jobLine = job
      ? `${job.name} (+${Math.round(user.jobBonus * 100)}%)`
      : "Unemployed";

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71) // money green
      .setTitle(`💵 ${interaction.user.displayName}'s CASH`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: "👛 Wallet", value: `${user.wallet.toLocaleString()} CASH`, inline: true },
        { name: "🏦 Bank", value: `${user.bank.toLocaleString()} CASH`, inline: true },
        { name: "💰 Net Worth", value: `${netWorth.toLocaleString()} CASH`, inline: true },
        { name: "📈 Total Earned", value: `${user.totalEarned.toLocaleString()} CASH`, inline: true },
        { name: "📉 Total Spent", value: `${user.totalSpent.toLocaleString()} CASH`, inline: true },
        { name: "⭐ Level", value: `${user.level}`, inline: true },
        { name: "💼 Job", value: jobLine, inline: true }
      )
      .setFooter({ text: "Wallet CASH can be stolen — the bank is safe!" });

    await interaction.reply({ embeds: [embed] });
  },
};
