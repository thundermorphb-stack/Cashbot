// /math — solve a math question to earn CASH.
// Easy:   347 + 189, 512 - 267           → 10-25 CASH  (30 seconds)
// Medium: 47 × 83, 35% of 480, 23²       → 25-50 CASH  (45 seconds)
// Hard:   12x + 7 = 5x + 91, remainders  → 50-100 CASH (60 seconds)
// Cooldown: 5 minutes (using the command starts the cooldown, win or lose).
//
// The question appears in a pop-up box (a "modal") with a text field.
// Each difficulty randomly picks one of several question styles,
// so answers can't be memorized.

import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { Command } from "../types.ts";
import { addEarnings } from "../lib/economy.ts";
import { getActiveCooldown, relativeTime, setCooldown } from "../lib/cooldowns.ts";

const COOLDOWN_MINUTES = 5;

const REWARDS = {
  easy: { min: 10, max: 25, seconds: 30 },
  medium: { min: 25, max: 50, seconds: 45 },
  hard: { min: 50, max: 100, seconds: 60 },
} as const;

type Difficulty = keyof typeof REWARDS;

/** A whole number between min and max, both included. */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Picks one random item from a list. */
function pick<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

type Question = { question: string; answer: number };

// ---- Easy: 3-digit mental arithmetic ----
const easyQuestions: Array<() => Question> = [
  () => {
    const a = randomInt(100, 999);
    const b = randomInt(100, 999);
    return { question: `${a} + ${b}`, answer: a + b };
  },
  () => {
    const a = randomInt(300, 999);
    const b = randomInt(100, a - 100);
    return { question: `${a} - ${b}`, answer: a - b };
  },
  () => {
    const a = randomInt(100, 500);
    const b = randomInt(100, 500);
    const c = randomInt(50, 300);
    return { question: `${a} + ${b} - ${c}`, answer: a + b - c };
  },
];

// ---- Medium: 2-digit multiplication, percentages, squares ----
const mediumQuestions: Array<() => Question> = [
  () => {
    const a = randomInt(12, 49);
    const b = randomInt(12, 49);
    return { question: `${a} × ${b}`, answer: a * b };
  },
  () => {
    const p = pick([5, 10, 15, 20, 25, 30, 35, 40, 45, 60, 75]);
    const n = randomInt(3, 49) * 20; // always gives a whole-number answer
    return { question: `${p}% of ${n}`, answer: (p * n) / 100 };
  },
  () => {
    const a = randomInt(13, 32);
    return { question: `${a}²`, answer: a * a };
  },
];

// ---- Hard: x on both sides, mixed products, remainders ----
const hardQuestions: Array<() => Question> = [
  () => {
    // ax + b = cx + d, where x can be negative
    const x = pick([randomInt(-15, -2), randomInt(2, 20)]);
    const a = randomInt(4, 12);
    const c = randomInt(2, a - 1); // a > c keeps one solution
    const b = randomInt(1, 40);
    const d = (a - c) * x + b;
    // Write "5x - 12" instead of the confusing "5x + -12" when d is negative.
    const rightSide = d === 0 ? `${c}x` : `${c}x ${d < 0 ? "-" : "+"} ${Math.abs(d)}`;
    return { question: `${a}x + ${b} = ${rightSide}  (find x)`, answer: x };
  },
  () => {
    const a = randomInt(12, 39);
    const b = randomInt(12, 39);
    const c = randomInt(12, 39);
    const d = randomInt(12, 39);
    return { question: `(${a} × ${b}) - (${c} × ${d})`, answer: a * b - c * d };
  },
  () => {
    const divisor = randomInt(7, 29);
    const quotient = randomInt(13, 40);
    const remainder = randomInt(1, divisor - 1);
    const dividend = divisor * quotient + remainder;
    return { question: `remainder of ${dividend} ÷ ${divisor}`, answer: remainder };
  },
];

export const GENERATORS: Record<Difficulty, Array<() => Question>> = {
  easy: easyQuestions,
  medium: mediumQuestions,
  hard: hardQuestions,
};

export const math: Command = {
  data: new SlashCommandBuilder()
    .setName("math")
    .setDescription("Solve a math question to earn CASH")
    .addStringOption((option) =>
      option
        .setName("difficulty")
        .setDescription("Harder questions pay more")
        .setRequired(true)
        .addChoices(
          { name: "Easy (10-25 CASH)", value: "easy" },
          { name: "Medium (25-50 CASH)", value: "medium" },
          { name: "Hard (50-100 CASH)", value: "hard" }
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;

    // 1. Respect the cooldown.
    const activeUntil = await getActiveCooldown(userId, "math");
    if (activeUntil) {
      await interaction.reply({
        content: `⏳ You already did a math challenge recently. Try again ${relativeTime(activeUntil)}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 2. Build the question and show it in a pop-up box.
    const difficulty = interaction.options.getString("difficulty", true) as Difficulty;
    const { question, answer } = pick(GENERATORS[difficulty])();
    const modalId = `math-${interaction.id}`; // unique per use, so answers can't get mixed up

    const modal = new ModalBuilder()
      .setCustomId(modalId)
      .setTitle(`Math Challenge (${difficulty})`)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("answer")
            .setLabel(`What is: ${question}`)
            .setPlaceholder("Type your answer as a number")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);

    // The cooldown starts now — closing the box without answering still counts.
    await setCooldown(userId, "math", COOLDOWN_MINUTES);

    // 3. Wait for their answer.
    let submitted;
    try {
      submitted = await interaction.awaitModalSubmit({
        filter: (m) => m.customId === modalId && m.user.id === userId,
        time: REWARDS[difficulty].seconds * 1000,
      });
    } catch {
      // Ran out of time or closed the box.
      await interaction
        .followUp({
          content: `⌛ Time's up! The answer was **${answer}**. No CASH this time.`,
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
      return;
    }

    // 4. Check the answer and pay out.
    const given = Number(submitted.fields.getTextInputValue("answer").trim());

    if (given === answer) {
      const { min, max } = REWARDS[difficulty];
      const paid = await addEarnings(userId, randomInt(min, max), `Math Challenge (${difficulty})`);
      const bonusNote = paid.bonus > 0 ? ` (${paid.base} + ${paid.bonus} job bonus)` : "";
      await submitted.reply(
        `✅ **Correct!** \`${question}\` = **${answer}**\n` +
          `${interaction.user} earned **${paid.total} 💵 CASH**${bonusNote}!` +
          paid.garnishNote
      );
    } else {
      await submitted.reply({
        content: `❌ Not quite. \`${question}\` = **${answer}**, you said \`${submitted.fields.getTextInputValue("answer")}\`. No CASH this time.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
