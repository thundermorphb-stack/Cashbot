// /trivia — answer a trivia question to earn 20-50 CASH.
// The four possible answers appear as clickable buttons.
// Only the person who ran the command can answer, and they get 30 seconds.
// Cooldown: 10 minutes (starts when the question is shown).

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
import { addEarnings } from "../lib/economy.ts";
import { currencyForGuild } from "../lib/currency.ts";
import { getActiveCooldown, relativeTime, setCooldown } from "../lib/cooldowns.ts";
import {
  TRIVIA,
  TRIVIA_CATEGORIES,
  type TriviaCategory,
} from "../data/trivia.ts";

const COOLDOWN_MINUTES = 10;
const ANSWER_TIME_SECONDS = 30;
const REWARD_MIN = 20;
const REWARD_MAX = 50;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Returns a copy of the list in random order. */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const trivia: Command = {
  data: new SlashCommandBuilder()
    .setName("trivia")
    .setDescription("Answer a trivia question to earn CASH")
    .addStringOption((option) =>
      option
        .setName("category")
        .setDescription("Pick a topic (leave empty for random)")
        .setRequired(false)
        .addChoices(
          { name: "General Knowledge", value: "general" },
          { name: "Gaming", value: "gaming" },
          { name: "Science", value: "science" },
          { name: "History", value: "history" }
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;

    // 1. Respect the cooldown.
    const activeUntil = await getActiveCooldown(userId, "trivia");
    if (activeUntil) {
      await interaction.reply({
        content: `⏳ You already played trivia recently. Try again ${relativeTime(activeUntil)}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 2. Pick a category (random if not chosen) and a question.
    const categories = Object.keys(TRIVIA) as TriviaCategory[];
    const category =
      (interaction.options.getString("category") as TriviaCategory | null) ??
      categories[randomInt(0, categories.length - 1)];
    const pool = TRIVIA[category];
    const q = pool[randomInt(0, pool.length - 1)];

    // 3. Shuffle the four answers and build a button for each.
    const options = shuffle([q.correct, ...q.wrong]);
    const makeButtons = (opts?: { revealCorrect?: boolean; picked?: number }) =>
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        options.map((text, i) => {
          const button = new ButtonBuilder()
            .setCustomId(`trivia-${interaction.id}-${i}`)
            .setLabel(text)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(opts !== undefined); // disable everything once it's over
          if (opts?.revealCorrect && text === q.correct) button.setStyle(ButtonStyle.Success);
          else if (opts?.picked === i && text !== q.correct) button.setStyle(ButtonStyle.Danger);
          return button;
        })
      );

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(TRIVIA_CATEGORIES[category])
      .setDescription(`**${q.question}**`)
      .setFooter({
        text: `${interaction.user.displayName} has ${ANSWER_TIME_SECONDS} seconds • ${REWARD_MIN}-${REWARD_MAX} CASH`,
      });

    const reply = await interaction.reply({
      embeds: [embed],
      components: [makeButtons()],
      withResponse: true,
    });
    const message = reply.resource!.message!;

    // The cooldown starts now — walking away still counts.
    await setCooldown(userId, "trivia", COOLDOWN_MINUTES);

    // 4. Wait for a button click.
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: ANSWER_TIME_SECONDS * 1000,
    });

    collector.on("collect", async (click) => {
      // Someone else trying to answer? Politely turn them away.
      if (click.user.id !== userId) {
        await click.reply({
          content: "This isn't your question — use /trivia to get your own!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      collector.stop("answered");
      const pickedIndex = Number(click.customId.split("-").pop());
      const pickedText = options[pickedIndex];

      if (pickedText === q.correct) {
        const currency = currencyForGuild(interaction.guildId);
        const paid = await addEarnings(userId, randomInt(REWARD_MIN, REWARD_MAX), `Trivia (${category})`, currency);
        const bonusNote = paid.bonus > 0 ? ` (incl. ${paid.bonus} job bonus)` : "";
        await click.update({
          embeds: [
            EmbedBuilder.from(embed)
              .setColor(0x2ecc71)
              .setFooter({ text: `✅ Correct! ${interaction.user.displayName} earned ${paid.total} ${currency.emoji} ${currency.name}${bonusNote}` }),
          ],
          components: [makeButtons({ revealCorrect: true })],
        });
        if (paid.garnishNote) {
          await click.followUp({ content: paid.garnishNote.trim() }).catch(() => {});
        }
      } else {
        await click.update({
          embeds: [
            EmbedBuilder.from(embed)
              .setColor(0xe74c3c)
              .setFooter({ text: `❌ Wrong! The answer was: ${q.correct}` }),
          ],
          components: [makeButtons({ revealCorrect: true, picked: pickedIndex })],
        });
      }
    });

    collector.on("end", async (_collected, reason) => {
      if (reason === "answered") return;
      // Time ran out with no answer.
      await interaction
        .editReply({
          embeds: [
            EmbedBuilder.from(embed)
              .setColor(0x95a5a6)
              .setFooter({ text: `⌛ Time's up! The answer was: ${q.correct}` }),
          ],
          components: [makeButtons({ revealCorrect: true })],
        })
        .catch(() => {});
    });
  },
};
