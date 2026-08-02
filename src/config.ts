// Loads settings from the .env file and checks nothing is missing.
// If a required value is absent the bot stops immediately with a clear message,
// instead of crashing later in a confusing way.

import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith("PASTE_")) {
    console.error(
      `Missing setting: ${name}\n` +
        `Open the .env file in the project folder and fill in ${name}.\n` +
        `See README instructions for where to find it.`
    );
    process.exit(1);
  }
  return value;
}

export const config = {
  /** The bot's secret login token (from the Discord Developer Portal). */
  token: required("DISCORD_TOKEN"),
  /** The bot application's ID (also called Application ID). */
  clientId: required("CLIENT_ID"),
  /** The ID of your Discord server, so commands appear there instantly. */
  guildId: required("GUILD_ID"),
  /** Where the SQLite database file lives. */
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
};
