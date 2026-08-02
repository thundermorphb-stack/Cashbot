// /ping — a simple test command to confirm the bot is alive.

import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";

export const ping: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check that CASH is online"),

  async execute(interaction) {
    const sent = await interaction.reply({
      content: "Pinging...",
      withResponse: true,
    });
    const roundTrip =
      (sent.resource?.message?.createdTimestamp ?? Date.now()) -
      interaction.createdTimestamp;

    await interaction.editReply(
      `🏓 Pong! CASH is online.\n` +
        `Response time: **${roundTrip}ms** | Discord latency: **${Math.round(
          interaction.client.ws.ping
        )}ms**`
    );
  },
};
