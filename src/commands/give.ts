// /give @user amount — donate CASH to another player.
// The taxman takes a random 7-10% cut; the rest lands in their wallet.
// The tax is destroyed, which helps keep inflation in check.

import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import {
  addCash,
  canAfford,
  computeDonation,
  removeCash,
  DONATION_TAX_MIN_PCT,
  DONATION_TAX_MAX_PCT,
} from "../lib/economy.ts";

const MIN_DONATION = 10; // below this, tax rounding gets silly

export const give: Command = {
  data: new SlashCommandBuilder()
    .setName("give")
    .setDescription(`Donate CASH to someone (${DONATION_TAX_MIN_PCT}-${DONATION_TAX_MAX_PCT}% tax applies)`)
    .addUserOption((option) =>
      option.setName("to").setDescription("Who receives your generosity").setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription(`How much CASH to give (min ${MIN_DONATION})`)
        .setMinValue(MIN_DONATION)
        .setRequired(true)
    ),

  async execute(interaction) {
    const sender = interaction.user;
    const recipient = interaction.options.getUser("to", true);
    const amount = interaction.options.getInteger("amount", true);

    const fail = (text: string) =>
      interaction.reply({ content: text, flags: MessageFlags.Ephemeral });

    if (recipient.id === sender.id)
      return void (await fail("🪞 Donating to yourself is just moving money between pockets."));
    if (recipient.bot) return void (await fail("🤖 Bots can't accept donations."));
    if (!(await canAfford(sender.id, amount)))
      return void (await fail(`💸 You don't have **${amount.toLocaleString()} CASH** in your wallet.`));

    const { pct, tax, net } = computeDonation(amount);

    // Sender pays the full amount; recipient gets it minus the tax.
    await removeCash(sender.id, amount, `Donation to ${recipient.tag}`);
    await addCash(recipient.id, net, `Donation from ${sender.tag}`);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe91e63)
          .setTitle("🎁 Donation")
          .setDescription(
            `${sender} gave **${amount.toLocaleString()} 💵 CASH** to ${recipient}!\n` +
              `🏛️ The taxman took **${pct}%** (${tax.toLocaleString()} CASH).\n` +
              `${recipient} received **${net.toLocaleString()} 💵 CASH**.`
          )
          .setFooter({ text: "Generosity is taxable. Welcome to capitalism." }),
      ],
    });
  },
};
