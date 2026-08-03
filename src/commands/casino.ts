// /casino — admin-only: mark a channel as the server's casino.
// Gambling commands (/gamble) only work inside the marked channel.
//   /casino set    → this channel becomes the casino
//   /casino unset  → gambling is disabled again
//   /casino view   → where is the casino?

import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../types.ts";
import { deleteSetting, getSetting, setSetting } from "../lib/settings.ts";
import { CASINO_CHANNEL_KEY } from "../lib/casino.ts";

export const casino: Command = {
  data: new SlashCommandBuilder()
    .setName("casino")
    .setDescription("Admin: manage the casino channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("set").setDescription("Make THIS channel the casino")
    )
    .addSubcommand((sub) =>
      sub.setName("unset").setDescription("Close the casino (disable gambling)")
    )
    .addSubcommand((sub) => sub.setName("view").setDescription("Show the casino channel")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "set") {
      await setSetting(CASINO_CHANNEL_KEY, interaction.channelId);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe91e63)
            .setTitle("🎰 The Casino is OPEN!")
            .setDescription(
              `<#${interaction.channelId}> is now the casino.\n` +
                `Members can gamble here with **/gamble** — number guessing, coinflips, and card guessing.\n` +
                `The house always wins... eventually. 🎲`
            ),
        ],
      });
      return;
    }

    if (sub === "unset") {
      await deleteSetting(CASINO_CHANNEL_KEY);
      await interaction.reply("🚪 The casino is closed. Gambling is disabled server-wide.");
      return;
    }

    const channelId = await getSetting(CASINO_CHANNEL_KEY);
    await interaction.reply({
      content: channelId
        ? `🎰 The casino is <#${channelId}>.`
        : "There is no casino right now. Run `/casino set` in a channel to open one.",
      flags: MessageFlags.Ephemeral,
    });
  },
};
