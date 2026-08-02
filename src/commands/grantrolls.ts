// /grantrolls — admin-only: gift extra job rolls to a player.
// Bonus rolls never expire and are spent after the free daily 5 run out.
// Only members with "Manage Server" permission can see and use this.

import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../types.ts";
import { grantRolls } from "../lib/jobs.ts";

export const grantrolls: Command = {
  data: new SlashCommandBuilder()
    .setName("grantrolls")
    .setDescription("Admin: give a player extra job rolls")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) =>
      option.setName("player").setDescription("Who gets the rolls").setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("How many extra rolls (1-50)")
        .setMinValue(1)
        .setMaxValue(50)
        .setRequired(true)
    ),

  async execute(interaction) {
    const player = interaction.options.getUser("player", true);
    const amount = interaction.options.getInteger("amount", true);

    if (player.bot) {
      await interaction.reply({
        content: "🤖 Bots are proudly unemployed.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const totalBonus = await grantRolls(player.id, amount);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle("🎲 Bonus Job Rolls!")
          .setDescription(
            `${interaction.user} granted **${amount} extra job roll(s)** to ${player}!\n` +
              `They now have **${totalBonus} bonus roll(s)** saved up — used automatically ` +
              `once the free daily 5 run out. Spend them with \`/job roll\`!`
          ),
      ],
    });
  },
};
