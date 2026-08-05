// /gamble — casino games. Only works in the channel marked with /casino set.
//
//   /gamble number bet guess     — pick 1-3; right = 2.5× your bet back
//   /gamble coinflip bet side    — heads or tails; right = 1.9× back
//   /gamble cards bet rank color suit — guess the hidden card:
//        each correct part +25%, each wrong part -25% (×0.25 to ×1.75)

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../types.ts";
import { addCash, canAfford, removeCash } from "../lib/economy.ts";
import { currencyForGuild, fmt } from "../lib/currency.ts";
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
import {
  dealerPlay,
  formatHand,
  handValue,
  isBlackjack,
  settle,
  NATURAL_PAYOUT,
  WIN_PAYOUT,
} from "../lib/blackjack.ts";

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
        .setName("blackjack")
        .setDescription(`Beat the dealer to 21 — win ${WIN_PAYOUT}×, natural blackjack ${NATURAL_PAYOUT}×`)
        .addIntegerOption(betOption)
    )
    .addSubcommand((sub) =>
      sub
        .setName("cards")
        .setDescription("Guess the hidden card: rank +350%, suit +80%, color +30% — misses -25%")
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

    // ---- The casino gate: only in this server's marked channel ----
    const casinoChannel = await getSetting(`${CASINO_CHANNEL_KEY}:${interaction.guildId}`);
    if (!casinoChannel)
      return void (await fail("🚪 There's no casino yet — an admin must run `/casino set` in some channel first."));
    if (interaction.channelId !== casinoChannel)
      return void (await fail(`🎰 Gambling only works in the casino: <#${casinoChannel}>`));

    const currency = currencyForGuild(interaction.guildId);
    const sub = interaction.options.getSubcommand();
    const bet = interaction.options.getInteger("bet", true);
    if (!(await canAfford(userId, bet, currency)))
      return void (await fail(`💸 You don't have **${fmt(bet, currency)}** on hand.`));

    // ---- Game 1: number guess ----
    if (sub === "number") {
      const guess = interaction.options.getInteger("guess", true);
      await removeCash(userId, bet, "Casino: Number Guess", currency);
      const result = playNumberGuess(bet, guess, randomInt(1, 3));
      if (result.win) await addCash(userId, result.payout, "Casino Win: Number Guess", currency);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(result.win ? 0x2ecc71 : 0xe74c3c)
            .setTitle(result.win ? "🎉 Winner!" : "🎲 House wins!")
            .setDescription(
              `${interaction.user} bet **${bet.toLocaleString()} ${currency.emoji}** and guessed **${guess}**.\n` +
                `The number was **${result.rolled}**.\n` +
                (result.win
                  ? `They walk away with **${fmt(result.payout, currency)}**!`
                  : `The casino thanks them for the donation.`)
            ),
        ],
      });
      return;
    }

    // ---- Game 2: coinflip ----
    if (sub === "coinflip") {
      const side = interaction.options.getString("side", true) as "heads" | "tails";
      await removeCash(userId, bet, "Casino: Coinflip", currency);
      const result = playCoinflip(bet, side, Math.random() < 0.5 ? "heads" : "tails");
      if (result.win) await addCash(userId, result.payout, "Casino Win: Coinflip", currency);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(result.win ? 0x2ecc71 : 0xe74c3c)
            .setTitle(result.win ? "🪙 Called it!" : "🪙 Wrong side!")
            .setDescription(
              `${interaction.user} bet **${bet.toLocaleString()} ${currency.emoji}** on **${side}**.\n` +
                `The coin landed on **${result.flip}**.\n` +
                (result.win
                  ? `They collect **${fmt(result.payout, currency)}**!`
                  : `Gone. Just like that.`)
            ),
        ],
      });
      return;
    }

    // ---- Game 4: blackjack ----
    if (sub === "blackjack") {
      await removeCash(userId, bet, "Casino: Blackjack", currency);

      const player = [drawCard(), drawCard()];
      const dealer = [drawCard(), drawCard()];

      const table = (opts: { done: boolean; note?: string; color?: number }) =>
        new EmbedBuilder()
          .setColor(opts.color ?? 0x34495e)
          .setTitle(`🂡 Blackjack — ${bet.toLocaleString()} ${currency.emoji} on the table`)
          .setDescription(
            `**Dealer:** ${formatHand(dealer, !opts.done)}\n` +
              `**${interaction.user.displayName}:** ${formatHand(player)}` +
              (opts.note ? `\n\n${opts.note}` : "")
          );

      const buttons = (disabled = false) =>
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`bj-hit-${interaction.id}`)
            .setLabel("Hit")
            .setEmoji("🃏")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
          new ButtonBuilder()
            .setCustomId(`bj-stand-${interaction.id}`)
            .setLabel("Stand")
            .setEmoji("✋")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
        );

      // Finish the round: dealer plays, bets are settled, table is revealed.
      const finish = async (edit: (payload: object) => Promise<unknown>) => {
        if (handValue(player) <= 21 && !isBlackjack(player)) {
          dealer.push(...dealerPlay(dealer).slice(dealer.length));
        }
        const outcome = settle(bet, player, dealer);
        if (outcome.payout > 0) {
          await addCash(userId, outcome.payout, "Casino Win: Blackjack", currency);
        }
        const note =
          outcome.result === "blackjack"
            ? `♠️ **BLACKJACK!** Paid **${fmt(outcome.payout, currency)}** (${NATURAL_PAYOUT}×)!`
            : outcome.result === "win"
              ? `🎉 **You win ${fmt(outcome.payout, currency)}!**`
              : outcome.result === "push"
                ? `🤝 **Push.** Your ${fmt(bet, currency)} bet is returned.`
                : handValue(player) > 21
                  ? `💥 **Bust!** The house takes your ${fmt(bet, currency)}.`
                  : `🎩 **Dealer wins.** Your ${fmt(bet, currency)} is gone.`;
        const color =
          outcome.result === "blackjack" || outcome.result === "win"
            ? 0x2ecc71
            : outcome.result === "push"
              ? 0x95a5a6
              : 0xe74c3c;
        await edit({ embeds: [table({ done: true, note, color })], components: [buttons(true)] });
      };

      // Natural 21 off the deal? Settle immediately.
      if (isBlackjack(player)) {
        await interaction.deferReply();
        await finish((payload) => interaction.editReply(payload));
        return;
      }

      const reply = await interaction.reply({
        embeds: [table({ done: false })],
        components: [buttons()],
        withResponse: true,
      });
      const message = reply.resource!.message!;

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000,
      });

      collector.on("collect", async (click) => {
        if (click.user.id !== userId) {
          await click.reply({
            content: "This isn't your table — start your own hand with /gamble blackjack!",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (click.customId === `bj-hit-${interaction.id}`) {
          player.push(drawCard());
          if (handValue(player) >= 21) {
            collector.stop("done"); // bust or 21 — either way the hand is over
            await finish((payload) => click.update(payload));
          } else {
            await click.update({ embeds: [table({ done: false })], components: [buttons()] });
          }
          return;
        }

        collector.stop("done"); // stand
        await finish((payload) => click.update(payload));
      });

      collector.on("end", async (_collected, reason) => {
        if (reason === "done") return;
        // Walked away from the table — auto-stand.
        await finish((payload) => interaction.editReply(payload)).catch(() => {});
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
      await removeCash(userId, bet, "Casino: Card Guess", currency);
      const result = playCards(bet, guess, drawCard());
      if (result.payout > 0) await addCash(userId, result.payout, "Casino Win: Card Guess", currency);

      const mark = (ok: boolean) => (ok ? "✅" : "❌");
      const profit = result.payout - bet;
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(profit > 0 ? 0x2ecc71 : profit < 0 ? 0xe74c3c : 0x95a5a6)
            .setTitle("🃏 The card is revealed...")
            .setDescription(
              `${interaction.user} bet **${bet.toLocaleString()} ${currency.emoji}** and guessed ` +
                `**${RANK_NAMES[guess.rank - 1]}**, **${guess.color}**, **${guess.suit}**.\n\n` +
                `The card was **${formatCard(result.card)}**\n` +
                `Rank ${mark(result.rankOk)} · Color ${mark(result.colorOk)} · Suit ${mark(result.suitOk)}\n\n` +
                `Multiplier: **×${result.multiplier.toFixed(2)}** → they get back **${fmt(result.payout, currency)}** ` +
                `(${profit >= 0 ? "+" : ""}${profit.toLocaleString()})`
            ),
        ],
      });
    }
  },
};
