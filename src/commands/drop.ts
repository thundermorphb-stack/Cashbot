// /drop — admin-only: force a CASH drop in the current channel right now.
// Useful for testing and for hyping up the server.
// Only members with "Manage Server" permission can see and use this.

import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type TextChannel,
} from "discord.js";
import type { Command } from "../types.ts";
import { postDrop } from "../features/drops.ts";

export const drop: Command = {
  data: new SlashCommandBuilder()
    .setName("drop")
    .setDescription("Admin: drop CASH in this channel right now")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("How much CASH to drop (leave empty for random)")
        .setMinValue(1)
        .setMaxValue(1_000_000)
        .setRequired(false)
    ),

  async execute(interaction) {
    if (interaction.channel?.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: "Drops only work in a normal text channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const amount = interaction.options.getInteger("amount") ?? undefined;
    await interaction.reply({ content: "💵 Incoming drop!", flags: MessageFlags.Ephemeral });
    await postDrop(interaction.channel as TextChannel, amount);
  },
};
