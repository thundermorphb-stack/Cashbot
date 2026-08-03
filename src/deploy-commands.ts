// Registers the slash commands with Discord so they show up in your server.
// Run this once after adding or changing a command:  npm run deploy

import { REST, Routes } from "discord.js";
import { config } from "./config.ts";
import { commands } from "./commands/index.ts";
import { log } from "./logger.ts";

const rest = new REST().setToken(config.token);

try {
  const body = commands.map((c) => c.data.toJSON());
  const guilds = [config.guildId, config.coinsGuildId].filter(
    (id): id is string => id !== null
  );
  log.info(`Registering ${body.length} slash command(s) in ${guilds.length} server(s)...`);

  for (const guildId of guilds) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, guildId), { body });
    log.info(`Registered in guild ${guildId}`);
  }

  log.info(`Done! Commands registered: ${body.map((c) => `/${c.name}`).join(", ")}`);
} catch (error) {
  log.error("Failed to register commands:", error);
  process.exit(1);
}
