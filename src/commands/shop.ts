// /shop — browse everything money can buy, at today's inflation-adjusted prices.

import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { getInflation, inflatedPrice } from "../lib/economy.ts";
import { SHOP_ITEMS } from "../data/shop.ts";

export const shop: Command = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Browse what your CASH can buy"),

  async execute(interaction) {
    const inflation = await getInflation();

    const list = (type: "security" | "perk") =>
      SHOP_ITEMS.filter((item) => item.type === type)
        .map((item) => {
          const price = inflatedPrice(item.basePrice, inflation.multiplier);
          const duration = item.durationDays ? ` · ${item.durationDays}d` : "";
          return `**${item.name}** — 💵 **${price.toLocaleString()}**${duration}\n-# ${item.description}`;
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
            `Inflation: **×${inflation.multiplier}** · Money in circulation: ` +
            `**${inflation.supply.toLocaleString()} CASH** across ${inflation.userCount} member(s)`,
        }
      );

    await interaction.reply({ embeds: [embed] });
  },
};
