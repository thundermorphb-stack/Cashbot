// /exchange — swap between 💵 CASH and 🪙 COINS at the live exchange rate.
// The money changer keeps a 5% fee (destroyed — good against inflation).

import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { addCash, canAfford, removeCash } from "../lib/economy.ts";
import { CURRENCIES, fmt, getExchangeRate } from "../lib/currency.ts";

export const EXCHANGE_FEE = 0.05;

export const exchange: Command = {
  data: new SlashCommandBuilder()
    .setName("exchange")
    .setDescription("Swap between CASH and COINS at the live rate (5% fee)")
    .addStringOption((option) =>
      option
        .setName("from")
        .setDescription("Which currency you're paying with")
        .setRequired(true)
        .addChoices(
          { name: "💵 CASH → 🪙 COINS", value: "cash" },
          { name: "🪙 COINS → 💵 CASH", value: "coins" }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("How much of that currency to swap")
        .setMinValue(10)
        .setRequired(true)
    ),

  async execute(interaction) {
    const fromKey = interaction.options.getString("from", true) as "cash" | "coins";
    const amount = interaction.options.getInteger("amount", true);
    const from = CURRENCIES[fromKey];
    const to = fromKey === "cash" ? CURRENCIES.coins : CURRENCIES.cash;

    if (!(await canAfford(interaction.user.id, amount, from))) {
      await interaction.reply({
        content: `💸 You don't have ${fmt(amount, from)}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const rate = await getExchangeRate(); // 1 coin = rate cash
    const afterFee = amount * (1 - EXCHANGE_FEE);
    const received = Math.floor(fromKey === "cash" ? afterFee / rate : afterFee * rate);

    if (received < 1) {
      await interaction.reply({
        content: "🤏 That's too little to exchange — the fee would eat it all.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await removeCash(interaction.user.id, amount, "Currency Exchange", from);
    await addCash(interaction.user.id, received, "Currency Exchange", to);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x1abc9c)
          .setTitle("💱 Currency Exchanged")
          .setDescription(
            `${interaction.user} swapped **${fmt(amount, from)}** → **${fmt(received, to)}**\n` +
              `Rate: 1 🪙 = ${rate} 💵 · Fee: ${EXCHANGE_FEE * 100}%`
          ),
      ],
    });
  },
};
