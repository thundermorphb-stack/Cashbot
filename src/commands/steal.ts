// /steal @user amount — attempt a robbery.
// Win:  grab 50-100% of the attempted amount from their wallet.
// Lose: pay 150% of the attempted amount TO your victim as compensation.
// Bank money is untouchable. Security items make targets harder to rob.

import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { addCash, balanceOf, getOrCreateUser, removeCash } from "../lib/economy.ts";
import { currencyForGuild, fmt } from "../lib/currency.ts";
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

    const currency = currencyForGuild(interaction.guildId);
    const thief = await getOrCreateUser(thiefId);
    const victim = await getOrCreateUser(target.id);
    const thiefBalance = balanceOf(thief, currency);
    const victimBalance = balanceOf(victim, currency);

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

    if (victimBalance < MIN_TARGET_WALLET)
      return void (await fail(`🫤 ${target.displayName} carries less than ${MIN_TARGET_WALLET} ${currency.name} — not worth the risk.`));

    if (amount > victimBalance)
      return void (await fail(`💸 ${target.displayName} only carries **${fmt(victimBalance, currency)}**. Aim lower.`));

    // ---- Thief must be able to pay the 150% fine ----
    const cap = maxAttempt(thiefBalance);
    if (amount > cap)
      return void (await fail(
        `⚖️ If you fail, you owe 150% of the attempt. With **${fmt(thiefBalance, currency)}** on hand you can attempt at most **${cap.toLocaleString()} ${currency.name}**.`
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
      await removeCash(target.id, outcome.stolen, `Robbed by ${interaction.user.tag}`, currency);
      await addCash(thiefId, outcome.stolen, "Steal Success", currency);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("🦹 Heist Successful!")
            .setDescription(
              `${interaction.user} robbed **${fmt(outcome.stolen, currency)}** from ${target}!` +
                securityNote
            )
            .setFooter({ text: "Crime pays... this time. Buy security from /shop to fight back!" }),
        ],
      });
    } else {
      await removeCash(thiefId, outcome.penalty, "Failed Steal Attempt", currency);
      await addCash(target.id, outcome.penalty, "Steal Compensation", currency);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("🚔 Caught Red-Handed!")
            .setDescription(
              `${interaction.user} tried to rob ${target} and got caught!\n` +
                `They paid **${fmt(outcome.penalty, currency)}** (150%) to ${target} as compensation.` +
                securityNote
            )
            .setFooter({ text: "Crime doesn't pay." }),
        ],
      });
    }
  },
};
