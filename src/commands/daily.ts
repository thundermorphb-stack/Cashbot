// /daily — collect a free daily reward of 100-500 CASH.
// Cooldown: 24 hours.

import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { addEarnings, getOrCreateUser, balanceOf } from "../lib/economy.ts";
import { currencyForGuild } from "../lib/currency.ts";
import { getActiveCooldown, relativeTime, setCooldown } from "../lib/cooldowns.ts";

const COOLDOWN_MINUTES = 24 * 60; // 24 hours
const REWARD_MIN = 100;
const REWARD_MAX = 500;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const daily: Command = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Collect your free daily CASH reward"),

  async execute(interaction) {
    const userId = interaction.user.id;

    const activeUntil = await getActiveCooldown(userId, "daily");
    if (activeUntil) {
      await interaction.reply({
        content: `⏳ You already collected your daily reward. Come back ${relativeTime(activeUntil)}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const currency = currencyForGuild(interaction.guildId);
    const paid = await addEarnings(userId, randomInt(REWARD_MIN, REWARD_MAX), "Daily Reward", currency);
    await setCooldown(userId, "daily", COOLDOWN_MINUTES);
    const user = await getOrCreateUser(userId);

    const bonusNote = paid.bonus > 0 ? ` (${paid.base} + ${paid.bonus} job bonus)` : "";
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f) // gold
      .setTitle("📅 Daily Reward")
      .setDescription(
        `${interaction.user} collected **${paid.total} ${currency.emoji} ${currency.name}**${bonusNote}!\n` +
          `On hand: **${balanceOf(user, currency).toLocaleString()} ${currency.name}**` +
          paid.garnishNote
      )
      .setFooter({ text: "Come back tomorrow for more!" });

    await interaction.reply({ embeds: [embed] });
  },
};
