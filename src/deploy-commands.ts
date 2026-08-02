// Registers the slash commands with Discord so they show up in your server.
// Run this once after adding or changing a command:  npm run deploy

import { REST, Routes } from "discord.js";
import { config } from "./config.ts";
import { commands } from "./commands/index.ts";
import { log } from "./logger.ts";

const rest = new REST().setToken(config.token);

try {
  const body = commands.map((c) => c.data.toJSON());
  log.info(`Registering ${body.length} slash command(s)...`);

  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body }
  );

  log.info(`Done! Commands registered: ${body.map((c) => `/${c.name}`).join(", ")}`);
} catch (error) {
  log.error("Failed to register commands:", error);
  process.exit(1);
}
