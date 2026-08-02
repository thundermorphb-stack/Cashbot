// /loan offer @user amount rate — lend CASH; interest grows every 20 minutes.
//     The borrower must click Accept before any money moves.
// /loan repay [amount] — pay back your debt (defaults to all of it).
// /loan status — what you owe and what you're owed.
// /loan forgive @user — wipe someone's remaining debt to you.
//
// While in debt, EVERYTHING the borrower earns is garnished to the lender.

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
import { canAfford } from "../lib/economy.ts";
import {
  computeOwed,
  createLoan,
  forgiveLoan,
  getLoanAsBorrower,
  getLoansAsLender,
  repayLoan,
  MAX_OWED_MULTIPLIER,
  MAX_RATE_PCT,
  MIN_LOAN,
  PERIOD_MINUTES,
} from "../lib/loans.ts";
import { relativeTime } from "../lib/cooldowns.ts";

const ACCEPT_WINDOW_SECONDS = 120;

export const loan: Command = {
  data: new SlashCommandBuilder()
    .setName("loan")
    .setDescription("Lend CASH with interest, or manage your debts")
    .addSubcommand((sub) =>
      sub
        .setName("offer")
        .setDescription("Offer someone a loan (they must accept)")
        .addUserOption((option) =>
          option.setName("to").setDescription("Who to lend to").setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("amount")
            .setDescription(`How much CASH to lend (min ${MIN_LOAN})`)
            .setMinValue(MIN_LOAN)
            .setRequired(true)
        )
        .addNumberOption((option) =>
          option
            .setName("rate")
            .setDescription(`Interest % added every ${PERIOD_MINUTES} minutes (0-${MAX_RATE_PCT})`)
            .setMinValue(0)
            .setMaxValue(MAX_RATE_PCT)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("repay")
        .setDescription("Pay back your debt from your wallet")
        .addIntegerOption((option) =>
          option
            .setName("amount")
            .setDescription("How much to repay (leave empty to pay everything)")
            .setMinValue(1)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("See what you owe and what you're owed")
    )
    .addSubcommand((sub) =>
      sub
        .setName("forgive")
        .setDescription("Wipe someone's remaining debt to you")
        .addUserOption((option) =>
          option.setName("borrower").setDescription("Whose debt to forgive").setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const me = interaction.user;
    const fail = (text: string) =>
      interaction.reply({ content: text, flags: MessageFlags.Ephemeral });

    // ---------------- /loan offer ----------------
    if (sub === "offer") {
      const borrower = interaction.options.getUser("to", true);
      const amount = interaction.options.getInteger("amount", true);
      const rate = interaction.options.getNumber("rate", true);

      if (borrower.id === me.id) return void (await fail("🪞 You can't lend to yourself."));
      if (borrower.bot) return void (await fail("🤖 Bots have excellent credit but no needs."));
      if (!(await canAfford(me.id, amount)))
        return void (await fail(`💸 You don't have **${amount.toLocaleString()} CASH** in your wallet to lend.`));
      if (await getLoanAsBorrower(borrower.id))
        return void (await fail(`${borrower.displayName} already has an active loan — one debt at a time.`));

      // Show what this deal really means before they accept.
      const perDay = (rate * (24 * 60)) / PERIOD_MINUTES;
      const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle("🤝 Loan Offer")
        .setDescription(
          `${me} offers ${borrower} a loan of **${amount.toLocaleString()} 💵 CASH**\n` +
            `at **${rate}% interest every ${PERIOD_MINUTES} minutes** (≈ ${Math.round(perDay)}%/day, simple interest).`
        )
        .addFields({
          name: `⚠️ ${borrower.displayName}, read before accepting`,
          value:
            `• Interest starts ticking the moment you accept.\n` +
            `• **Everything you earn** (math, trivia, daily) goes straight to ${me.displayName} until the debt is paid.\n` +
            `• Debt is capped at ${MAX_OWED_MULTIPLIER}× the loan (${(amount * MAX_OWED_MULTIPLIER).toLocaleString()} CASH).\n` +
            `• Repay anytime with \`/loan repay\`.`,
        })
        .setFooter({ text: `Offer expires in ${ACCEPT_WINDOW_SECONDS / 60} minutes` });

      const buttons = (disabled = false) =>
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`loan-accept-${interaction.id}`)
            .setLabel("Accept the loan")
            .setEmoji("✍️")
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
          new ButtonBuilder()
            .setCustomId(`loan-decline-${interaction.id}`)
            .setLabel("Decline")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
        );

      const reply = await interaction.reply({
        content: `${borrower}`,
        embeds: [embed],
        components: [buttons()],
        withResponse: true,
      });
      const message = reply.resource!.message!;

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: ACCEPT_WINDOW_SECONDS * 1000,
      });

      collector.on("collect", async (click) => {
        if (click.user.id !== borrower.id) {
          await click.reply({
            content: "Only the person being offered the loan can decide.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        collector.stop("decided");

        if (click.customId === `loan-decline-${interaction.id}`) {
          await click.update({
            embeds: [EmbedBuilder.from(embed).setColor(0x95a5a6).setFooter({ text: "Offer declined." })],
            components: [buttons(true)],
          });
          return;
        }

        // Accept: re-check the rules, then move the money.
        try {
          await createLoan(me.id, borrower.id, amount, rate);
          await click.update({
            embeds: [
              EmbedBuilder.from(embed)
                .setColor(0x2ecc71)
                .setFooter({ text: "✍️ Signed! The clock is ticking — repay with /loan repay" }),
            ],
            components: [buttons(true)],
          });
        } catch (error) {
          const reason = error instanceof RangeError ? error.message : "The lender can no longer afford this loan.";
          await click.update({
            embeds: [EmbedBuilder.from(embed).setColor(0xe74c3c).setFooter({ text: `Fell through: ${reason}` })],
            components: [buttons(true)],
          });
        }
      });

      collector.on("end", async (_collected, reason) => {
        if (reason === "decided") return;
        await interaction
          .editReply({
            embeds: [EmbedBuilder.from(embed).setColor(0x95a5a6).setFooter({ text: "⌛ Offer expired." })],
            components: [buttons(true)],
          })
          .catch(() => {});
      });
      return;
    }

    // ---------------- /loan repay ----------------
    if (sub === "repay") {
      const requested = interaction.options.getInteger("amount") ?? undefined;
      try {
        const result = await repayLoan(me.id, requested);
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(result.remaining > 0 ? 0xf39c12 : 0x2ecc71)
              .setTitle(result.remaining > 0 ? "💳 Payment Made" : "🎉 Debt Cleared!")
              .setDescription(
                `${me} paid **${result.payment.toLocaleString()} 💵 CASH** to <@${result.lenderId}>.` +
                  (result.remaining > 0
                    ? `\nStill owed: **${result.remaining.toLocaleString()} CASH** (and interest keeps ticking...)`
                    : `\nThey are officially debt-free!`)
              ),
          ],
        });
      } catch (error) {
        if (error instanceof RangeError) return void (await fail(`🤷 ${error.message}`));
        return void (await fail("💸 Your wallet can't cover that payment. Earn some CASH first — oh wait..."));
      }
      return;
    }

    // ---------------- /loan status ----------------
    if (sub === "status") {
      const myDebt = await getLoanAsBorrower(me.id);
      const myLoans = await getLoansAsLender(me.id);
      const lines: string[] = [];

      if (myDebt) {
        const owed = computeOwed(myDebt);
        const nextTick = new Date(
          myDebt.startedAt.getTime() +
            (Math.floor((Date.now() - myDebt.startedAt.getTime()) / (PERIOD_MINUTES * 60_000)) + 1) *
              PERIOD_MINUTES *
              60_000
        );
        lines.push(
          `**You owe** <@${myDebt.lenderId}>: **${owed.toLocaleString()} 💵 CASH**\n` +
            `-# borrowed ${myDebt.principal.toLocaleString()} at ${myDebt.ratePct}%/${PERIOD_MINUTES}min · ` +
            `repaid ${myDebt.repaid.toLocaleString()} so far · interest ticks ${relativeTime(nextTick)}`
        );
      } else {
        lines.push("**You owe:** nothing. Financially responsible... boring, but responsible.");
      }

      if (myLoans.length > 0) {
        for (const lent of myLoans) {
          lines.push(
            `**Owed to you** by <@${lent.borrowerId}>: **${computeOwed(lent).toLocaleString()} 💵 CASH**\n` +
              `-# lent ${lent.principal.toLocaleString()} at ${lent.ratePct}%/${PERIOD_MINUTES}min`
          );
        }
      } else {
        lines.push("**Owed to you:** nothing.");
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle(`🏦 ${me.displayName}'s Loan Book`)
            .setDescription(lines.join("\n\n")),
        ],
      });
      return;
    }

    // ---------------- /loan forgive ----------------
    if (sub === "forgive") {
      const borrower = interaction.options.getUser("borrower", true);
      try {
        const { forgiven } = await forgiveLoan(me.id, borrower.id);
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle("🕊️ Debt Forgiven")
              .setDescription(
                `${me} wiped ${borrower}'s remaining debt of **${forgiven.toLocaleString()} 💵 CASH**. What a saint.`
              ),
          ],
        });
      } catch (error) {
        if (error instanceof RangeError) return void (await fail(`🤷 ${error.message}`));
        throw error;
      }
    }
  },
};
