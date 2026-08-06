// The main entry point of CASH. Run with:  npm start
// It logs in to Discord, listens for slash commands, and routes each one
// to the matching command file in src/commands/.

import { Client, Collection, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { config } from "./config.ts";
import { commands } from "./commands/index.ts";
import { prisma } from "./lib/db.ts";
import { log } from "./logger.ts";
import { startDrops } from "./features/drops.ts";
import { startExpirySweeper } from "./features/expiry.ts";
import { startWealthTax } from "./features/wealthtax.ts";
import { ensureShopItems } from "./lib/shop.ts";
import { ensureStocks } from "./lib/stocks.ts";
import type { Command } from "./types.ts";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Put commands in a map so we can look them up by name instantly.
const commandMap = new Collection<string, Command>();
for (const command of commands) {
  commandMap.set(command.data.name, command);
}

client.once(Events.ClientReady, async (readyClient) => {
  log.info(`Logged in as ${readyClient.user.tag}`);
  log.info(`CASH is online in ${readyClient.guilds.cache.size} server(s)`);
  await ensureShopItems(); // sync the shop catalog into the database
  await ensureStocks(); // sync the stock market into the database
  startDrops(readyClient); // begin the random money-drop schedules
  // Clean up expired items in every country.
  startExpirySweeper(
    readyClient,
    [config.guildId, config.coinsGuildId].filter((id): id is string => id !== null)
  );
  startWealthTax(); // the daily 5% levy on fortunes above 100k
});

// Runs every time someone uses a slash command.
client.on(Events.InteractionCreate, async (interaction) => {
  // Autocomplete: fill the suggestion list while the user is typing.
  if (interaction.isAutocomplete()) {
    const command = commandMap.get(interaction.commandName);
    await command?.autocomplete?.(interaction).catch((error) => {
      log.error(`Autocomplete error in /${interaction.commandName}:`, error);
    });
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commandMap.get(interaction.commandName);
  if (!command) {
    log.warn(`Unknown command: /${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    // If a command crashes, tell the user politely instead of going silent.
    log.error(`Error in /${interaction.commandName}:`, error);
    const message = {
      content: "⚠️ Something went wrong running that command. Please try again.",
      flags: MessageFlags.Ephemeral,
    } as const;
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(message).catch(() => {});
    } else {
      await interaction.reply(message).catch(() => {});
    }
  }
});

// Safety nets: log unexpected errors instead of crashing silently.
process.on("unhandledRejection", (error) => {
  log.error("Unhandled promise rejection:", error);
});
process.on("uncaughtException", (error) => {
  log.error("Uncaught exception:", error);
});

// Close the database cleanly when the bot is stopped (Ctrl+C).
process.on("SIGINT", async () => {
  log.info("Shutting down...");
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
});

log.info("Starting CASH...");
client.login(config.token);
