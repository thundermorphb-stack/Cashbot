// /balance — shows your money in BOTH currencies, plus the exchange rate.
// You can hold cash and coins anywhere, but each server only spends its own.

import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { getOrCreateUser } from "../lib/economy.ts";
import { prisma } from "../lib/db.ts";
import { currencyForGuild, getExchangeRate, toCashValue, CURRENCIES } from "../lib/currency.ts";

export const balance: Command = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your CASH and COINS"),

  async execute(interaction) {
    const user = await getOrCreateUser(interaction.user.id);
    const local = currencyForGuild(interaction.guildId);
    const rate = await getExchangeRate();
    const netWorth = user.wallet + toCashValue(user.coins, CURRENCIES.coins, rate);
    const job = user.jobId
      ? await prisma.job.findUnique({ where: { id: user.jobId } })
      : null;
    const jobLine = job
      ? `${job.name} (+${Math.round(user.jobBonus * 100)}%)`
      : "Unemployed";

    const embed = new EmbedBuilder()
      .setColor(local.key === "cash" ? 0x2ecc71 : 0xf1c40f)
      .setTitle(`${local.emoji} ${interaction.user.displayName}'s Money`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: "💵 CASH", value: `${user.wallet.toLocaleString()}`, inline: true },
        { name: "🪙 COINS", value: `${user.coins.toLocaleString()}`, inline: true },
        { name: "💰 Net Worth", value: `${netWorth.toLocaleString()} CASH-worth`, inline: true },
        { name: "📈 Total Earned", value: `${user.totalEarned.toLocaleString()}`, inline: true },
        { name: "💼 Job", value: jobLine, inline: true },
        { name: "🌍 Exchange Rate", value: `1 🪙 = ${rate} 💵`, inline: true }
      )
      .setFooter({
        text: `This server uses ${local.emoji} ${local.name} — swap currencies with /exchange`,
      });

    await interaction.reply({ embeds: [embed] });
  },
};
