// /gamble — casino games. Only works in the channel marked with /casino set.
//
//   /gamble number bet guess     — pick 1-3; right = 2.5× your bet back
//   /gamble coinflip bet side    — heads or tails; right = 1.9× back
//   /gamble cards bet rank color suit — guess the hidden card:
//        each correct part +25%, each wrong part -25% (×0.25 to ×1.75)

import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { addCash, canAfford, removeCash } from "../lib/economy.ts";
import { getSetting } from "../lib/settings.ts";
import {
  CASINO_CHANNEL_KEY,
  COINFLIP_PAYOUT,
  MAX_BET,
  MIN_BET,
  NUMBER_PAYOUT,
  RANK_NAMES,
  SUITS,
  drawCard,
  formatCard,
  playCards,
  playCoinflip,
  playNumberGuess,
  type Suit,
} from "../lib/casino.ts";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const betOption = (option: any) =>
  option
    .setName("bet")
    .setDescription(`How much CASH to bet (${MIN_BET}-${MAX_BET.toLocaleString()})`)
    .setMinValue(MIN_BET)
    .setMaxValue(MAX_BET)
    .setRequired(true);

export const gamble: Command = {
  data: new SlashCommandBuilder()
    .setName("gamble")
    .setDescription("Casino games — only works in the casino channel")
    .addSubcommand((sub) =>
      sub
        .setName("number")
        .setDescription(`Guess a number from 1-3 — win ${NUMBER_PAYOUT}× your bet`)
        .addIntegerOption(betOption)
        .addIntegerOption((option) =>
          option
            .setName("guess")
            .setDescription("Your number")
            .setRequired(true)
            .addChoices({ name: "1", value: 1 }, { name: "2", value: 2 }, { name: "3", value: 3 })
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("coinflip")
        .setDescription(`Heads or tails — win ${COINFLIP_PAYOUT}× your bet`)
        .addIntegerOption(betOption)
        .addStringOption((option) =>
          option
            .setName("side")
            .setDescription("Your call")
            .setRequired(true)
            .addChoices({ name: "🪙 Heads", value: "heads" }, { name: "🪙 Tails", value: "tails" })
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("cards")
        .setDescription("Guess the hidden card: rank +250%, suit +60%, color +25% — misses -25%")
        .addIntegerOption(betOption)
        .addIntegerOption((option) =>
          option
            .setName("rank")
            .setDescription("The card's rank")
            .setRequired(true)
            .addChoices(...RANK_NAMES.map((name, i) => ({ name, value: i + 1 })))
        )
        .addStringOption((option) =>
          option
            .setName("color")
            .setDescription("The card's color")
            .setRequired(true)
            .addChoices({ name: "🔴 Red", value: "red" }, { name: "⚫ Black", value: "black" })
        )
        .addStringOption((option) =>
          option
            .setName("suit")
            .setDescription("The card's suit")
            .setRequired(true)
            .addChoices(
              { name: "♠️ Spades", value: "spades" },
              { name: "♥️ Hearts", value: "hearts" },
              { name: "♦️ Diamonds", value: "diamonds" },
              { name: "♣️ Clubs", value: "clubs" }
            )
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const fail = (text: string) =>
      interaction.reply({ content: text, flags: MessageFlags.Ephemeral });

    // ---- The casino gate: only in the marked channel ----
    const casinoChannel = await getSetting(CASINO_CHANNEL_KEY);
    if (!casinoChannel)
      return void (await fail("🚪 There's no casino yet — an admin must run `/casino set` in some channel first."));
    if (interaction.channelId !== casinoChannel)
      return void (await fail(`🎰 Gambling only works in the casino: <#${casinoChannel}>`));

    const sub = interaction.options.getSubcommand();
    const bet = interaction.options.getInteger("bet", true);
    if (!(await canAfford(userId, bet)))
      return void (await fail(`💸 You don't have **${bet.toLocaleString()} CASH** in your wallet.`));

    // ---- Game 1: number guess ----
    if (sub === "number") {
      const guess = interaction.options.getInteger("guess", true);
      await removeCash(userId, bet, "Casino: Number Guess");
      const result = playNumberGuess(bet, guess, randomInt(1, 3));
      if (result.win) await addCash(userId, result.payout, "Casino Win: Number Guess");

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(result.win ? 0x2ecc71 : 0xe74c3c)
            .setTitle(result.win ? "🎉 Winner!" : "🎲 House wins!")
            .setDescription(
              `${interaction.user} bet **${bet.toLocaleString()} 💵** and guessed **${guess}**.\n` +
                `The number was **${result.rolled}**.\n` +
                (result.win
                  ? `They walk away with **${result.payout.toLocaleString()} 💵 CASH**!`
                  : `The casino thanks them for the donation.`)
            ),
        ],
      });
      return;
    }

    // ---- Game 2: coinflip ----
    if (sub === "coinflip") {
      const side = interaction.options.getString("side", true) as "heads" | "tails";
      await removeCash(userId, bet, "Casino: Coinflip");
      const result = playCoinflip(bet, side, Math.random() < 0.5 ? "heads" : "tails");
      if (result.win) await addCash(userId, result.payout, "Casino Win: Coinflip");

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(result.win ? 0x2ecc71 : 0xe74c3c)
            .setTitle(result.win ? "🪙 Called it!" : "🪙 Wrong side!")
            .setDescription(
              `${interaction.user} bet **${bet.toLocaleString()} 💵** on **${side}**.\n` +
                `The coin landed on **${result.flip}**.\n` +
                (result.win
                  ? `They collect **${result.payout.toLocaleString()} 💵 CASH**!`
                  : `Gone. Just like that.`)
            ),
        ],
      });
      return;
    }

    // ---- Game 3: card guessing ----
    if (sub === "cards") {
      const guess = {
        rank: interaction.options.getInteger("rank", true),
        color: interaction.options.getString("color", true) as "red" | "black",
        suit: interaction.options.getString("suit", true) as Suit,
      };
      await removeCash(userId, bet, "Casino: Card Guess");
      const result = playCards(bet, guess, drawCard());
      if (result.payout > 0) await addCash(userId, result.payout, "Casino Win: Card Guess");

      const mark = (ok: boolean) => (ok ? "✅" : "❌");
      const profit = result.payout - bet;
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(profit > 0 ? 0x2ecc71 : profit < 0 ? 0xe74c3c : 0x95a5a6)
            .setTitle("🃏 The card is revealed...")
            .setDescription(
              `${interaction.user} bet **${bet.toLocaleString()} 💵** and guessed ` +
                `**${RANK_NAMES[guess.rank - 1]}**, **${guess.color}**, **${guess.suit}**.\n\n` +
                `The card was **${formatCard(result.card)}**\n` +
                `Rank ${mark(result.rankOk)} · Color ${mark(result.colorOk)} · Suit ${mark(result.suitOk)}\n\n` +
                `Multiplier: **×${result.multiplier.toFixed(2)}** → they get back **${result.payout.toLocaleString()} 💵 CASH** ` +
                `(${profit >= 0 ? "+" : ""}${profit.toLocaleString()})`
            ),
        ],
      });
    }
  },
};
