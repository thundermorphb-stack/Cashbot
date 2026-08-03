// /shop — browse everything money can buy, at today's inflation-adjusted prices.

import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { getInflation, inflatedPrice } from "../lib/economy.ts";
import { currencyForGuild, getExchangeRate, toLocal } from "../lib/currency.ts";
import { SHOP_ITEMS } from "../data/shop.ts";

export const shop: Command = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Browse what your money can buy"),

  async execute(interaction) {
    const currency = currencyForGuild(interaction.guildId);
    const rate = currency.key === "coins" ? await getExchangeRate() : 1;
    const inflation = await getInflation(currency);

    const list = (type: "security" | "perk") =>
      SHOP_ITEMS.filter((item) => item.type === type)
        .map((item) => {
          const price = inflatedPrice(toLocal(item.basePrice, currency, rate), inflation.multiplier);
          const duration = item.durationDays ? ` · ${item.durationDays}d` : "";
          return `**${item.name}** — ${currency.emoji} **${price.toLocaleString()}**${duration}\n-# ${item.description}`;
        })
        .join("\n");

    const trend =
      inflation.multiplier > 1.1 ? "📈 High inflation — the server is rich, so prices are up!"
      : inflation.multiplier < 0.95 ? "📉 Deflation — money is scarce, so prices are down!"
      : "⚖️ Prices are stable.";

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle("🏪 The CASH Shop")
      .setDescription(`Buy with \`/buy\`. Prices move with the server's economy!`)
      .addFields(
        { name: "🛡️ Security — protect your wallet from /steal", value: list("security") },
        { name: "✨ Perks — flaunt your fortune", value: list("perk") },
        {
          name: "Economy report",
          value:
            `${trend}\n` +
            `Inflation: **×${inflation.multiplier}** · ${currency.name} in circulation: ` +
            `**${inflation.supply.toLocaleString()} ${currency.emoji}** · Exchange: 1 🪙 = ${rate} 💵`,
        }
      );

    await interaction.reply({ embeds: [embed] });
  },
};
