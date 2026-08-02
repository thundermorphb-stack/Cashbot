// /job roll — roll for a random job. Rarer jobs = bigger income bonus.
// /job view — see your current job and rolls left today.
// Everyone gets 5 rolls per day. The bonus applies to math, trivia, and daily.

import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { getOrCreateUser } from "../lib/economy.ts";
import { getRollStatus, rollJob, ROLLS_PER_DAY } from "../lib/jobs.ts";
import { relativeTime } from "../lib/cooldowns.ts";
import { prisma } from "../lib/db.ts";
import { RARITIES, type Rarity } from "../data/jobs.ts";

function formatBonus(bonus: number): string {
  return `+${Math.round(bonus * 100)}%`;
}

export const job: Command = {
  data: new SlashCommandBuilder()
    .setName("job")
    .setDescription("Jobs boost everything you earn")
    .addSubcommand((sub) =>
      sub.setName("roll").setDescription(`Roll for a random job (${ROLLS_PER_DAY} rolls per day)`)
    )
    .addSubcommand((sub) =>
      sub.setName("view").setDescription("See your current job and remaining rolls")
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "view") {
      const user = await getOrCreateUser(userId);
      const currentJob = user.jobId
        ? await prisma.job.findUnique({ where: { id: user.jobId } })
        : null;
      const status = await getRollStatus(userId);

      const embed = new EmbedBuilder()
        .setColor(currentJob ? RARITIES[currentJob.rarity as Rarity].color : 0x95a5a6)
        .setTitle(`💼 ${interaction.user.displayName}'s Job`)
        .setDescription(
          currentJob
            ? `**${currentJob.name}** (${RARITIES[currentJob.rarity as Rarity].label})\n` +
                `Income bonus: **${formatBonus(user.jobBonus)}** on everything you earn`
            : "Unemployed — use `/job roll` to get a job!"
        )
        .setFooter({
          text: `Rolls left today: ${status.remaining}/${ROLLS_PER_DAY}`,
        });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ---- /job roll ----
    const status = await getRollStatus(userId);
    if (status.remaining <= 0) {
      await interaction.reply({
        content: `⏳ You've used all ${ROLLS_PER_DAY} job rolls for today. More rolls ${relativeTime(status.resetAt!)}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const rolled = await rollJob(userId);
    const rarityInfo = RARITIES[rolled.rarity];

    const embed = new EmbedBuilder()
      .setColor(rarityInfo.color)
      .setTitle("💼 New Job!")
      .setDescription(
        `${interaction.user} is now a **${rolled.name}**!\n` +
          `Rarity: **${rarityInfo.label}**\n` +
          `Income bonus: **${formatBonus(rolled.bonus)}** on everything you earn`
      )
      .setFooter({
        text:
          rolled.rollsLeft > 0
            ? `Rolls left today: ${rolled.rollsLeft}/${ROLLS_PER_DAY} — rolling again replaces this job!`
            : `That was your last roll for today!`,
      });

    await interaction.reply({ embeds: [embed] });
  },
};
