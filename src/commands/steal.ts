// /steal @user amount — attempt a robbery.
// Win:  grab 50-100% of the attempted amount from their wallet.
// Lose: pay 150% of the attempted amount TO your victim as compensation.
// Bank money is untouchable. Security items make targets harder to rob.

import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { addCash, getOrCreateUser, removeCash } from "../lib/economy.ts";
import { getActiveCooldown, relativeTime, setCooldown } from "../lib/cooldowns.ts";
import { getActiveSecurity } from "../lib/shop.ts";
import {
  maxAttempt,
  MIN_TARGET_WALLET,
  NEW_USER_PROTECTION_HOURS,
  resolveSteal,
  SAME_TARGET_COOLDOWN_MINUTES,
  STEAL_COOLDOWN_MINUTES,
  STEAL_MIN_AMOUNT,
} from "../lib/steal.ts";

export const steal: Command = {
  data: new SlashCommandBuilder()
    .setName("steal")
    .setDescription("Attempt to rob someone's wallet (risky!)")
    .addUserOption((option) =>
      option.setName("target").setDescription("Who to rob").setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription(`How much to try to steal (min ${STEAL_MIN_AMOUNT})`)
        .setMinValue(STEAL_MIN_AMOUNT)
        .setRequired(true)
    ),

  async execute(interaction) {
    const thiefId = interaction.user.id;
    const target = interaction.options.getUser("target", true);
    const amount = interaction.options.getInteger("amount", true);

    const fail = (text: string) =>
      interaction.reply({ content: text, flags: MessageFlags.Ephemeral });

    // ---- Sanity checks ----
    if (target.id === thiefId) return void (await fail("🪞 You can't rob yourself."));
    if (target.bot) return void (await fail("🤖 Bots have no pockets."));

    const thief = await getOrCreateUser(thiefId);
    const victim = await getOrCreateUser(target.id);

    // ---- Cooldowns: one global, one per victim ----
    const globalCd = await getActiveCooldown(thiefId, "steal");
    if (globalCd)
      return void (await fail(`⏳ You're laying low after your last heist. Try again ${relativeTime(globalCd)}.`));

    const targetCd = await getActiveCooldown(thiefId, `steal:${target.id}`);
    if (targetCd)
      return void (await fail(`👀 ${target.displayName} is watching you closely. You can rob them again ${relativeTime(targetCd)}.`));

    // ---- Target protections ----
    const accountAgeHours = (Date.now() - victim.createdAt.getTime()) / 3_600_000;
    if (accountAgeHours < NEW_USER_PROTECTION_HOURS)
      return void (await fail(`🛡️ ${target.displayName} is new to the economy and under protection for now.`));

    if (victim.wallet < MIN_TARGET_WALLET)
      return void (await fail(`🫤 ${target.displayName}'s wallet has less than ${MIN_TARGET_WALLET} CASH — not worth the risk.`));

    if (amount > victim.wallet)
      return void (await fail(`💸 ${target.displayName} only carries **${victim.wallet.toLocaleString()} CASH** in their wallet. Aim lower.`));

    // ---- Thief must be able to pay the 150% fine ----
    const cap = maxAttempt(thief.wallet);
    if (amount > cap)
      return void (await fail(
        `⚖️ If you fail, you owe 150% of the attempt. With **${thief.wallet.toLocaleString()} CASH** in your wallet you can attempt at most **${cap.toLocaleString()} CASH**.`
      ));

    // ---- Commit: cooldowns start now, win or lose ----
    await setCooldown(thiefId, "steal", STEAL_COOLDOWN_MINUTES);
    await setCooldown(thiefId, `steal:${target.id}`, SAME_TARGET_COOLDOWN_MINUTES);

    const security = await getActiveSecurity(target.id);
    const outcome = resolveSteal(amount, security.reduction);
    const securityNote = security.name
      ? `\n${security.name} made this ${Math.round(security.reduction * 100)}% harder!`
      : "";

    if (outcome.success) {
      await removeCash(target.id, outcome.stolen, `Robbed by ${interaction.user.tag}`);
      await addCash(thiefId, outcome.stolen, "Steal Success");

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("🦹 Heist Successful!")
            .setDescription(
              `${interaction.user} robbed **${outcome.stolen.toLocaleString()} 💵 CASH** from ${target}!` +
                securityNote
            )
            .setFooter({ text: "Crime pays... this time. Bank your CASH to keep it safe!" }),
        ],
      });
    } else {
      await removeCash(thiefId, outcome.penalty, "Failed Steal Attempt");
      await addCash(target.id, outcome.penalty, "Steal Compensation");

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("🚔 Caught Red-Handed!")
            .setDescription(
              `${interaction.user} tried to rob ${target} and got caught!\n` +
                `They paid **${outcome.penalty.toLocaleString()} 💵 CASH** (150%) to ${target} as compensation.` +
                securityNote
            )
            .setFooter({ text: "Crime doesn't pay." }),
        ],
      });
    }
  },
};
