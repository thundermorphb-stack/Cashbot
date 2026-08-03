// Shared type definitions.
// Every slash command file exports an object matching this shape,
// so the rest of the bot knows how to register and run it.

import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

export interface Command {
  /** The command's name, description, and options (what Discord shows). */
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder;
  /** The code that runs when someone uses the command. */
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  /** Optional: fills the suggestion list while the user is still typing. */
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}
