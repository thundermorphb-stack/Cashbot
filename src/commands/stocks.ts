// /stocks — the market board. Shows only the TOP companies (by total CASH
// invested in them). Niche companies exist too — find them by typing their
// name into /invest, which suggests the closest matches as you type.

import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { prisma } from "../lib/db.ts";
import { getPrices, displayName, PRICE_STEP_MINUTES } from "../lib/stocks.ts";

const BOARD_SIZE = 10;

export const stocks: Command = {
  data: new SlashCommandBuilder()
    .setName("stocks")
    .setDescription("See the top companies on the stock market"),

  async execute(interaction) {
    await interaction.deferReply();
    const [prices, positions] = await Promise.all([
      getPrices(),
      prisma.investment.groupBy({ by: ["company"], _sum: { shares: true } }),
    ]);

    // Rank companies by the total CASH currently invested in them.
    const investedIn = new Map(positions.map((p) => [p.company, p._sum.shares ?? 0]));
    const ranked = [...prices].sort(
      (a, b) => (investedIn.get(b.key) ?? 0) * b.price - (investedIn.get(a.key) ?? 0) * a.price
    );
    const board = ranked.slice(0, BOARD_SIZE);

    const lines = board.map((row, i) => {
      const diff = row.price - row.prevPrice;
      const pct = row.prevPrice > 0 ? ((diff / row.prevPrice) * 100).toFixed(1) : "0.0";
      const arrow = diff > 0 ? `📈 +${pct}%` : diff < 0 ? `📉 ${pct}%` : "➖ 0.0%";
      const owner = row.ownerId ? ` · founder <@${row.ownerId}>` : "";
      return (
        `**${i + 1}. ${displayName(row)}** — 💵 **${row.price.toLocaleString()}**/share  ${arrow}${owner}\n` +
        `-# ${((investedIn.get(row.key) ?? 0) * row.price).toLocaleString()} CASH invested`
      );
    });

    const hidden = prices.length - board.length;
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x16a085)
          .setTitle("📊 The CASH Stock Market — Top Companies")
          .setDescription(lines.join("\n"))
          .setFooter({
            text:
              `Prices move every ~${PRICE_STEP_MINUTES} min and with demand • /invest to buy, /sell to cash out` +
              (hidden > 0 ? ` • ${hidden} niche compan${hidden === 1 ? "y" : "ies"} not shown — search via /invest` : "") +
              ` • Found your own with /business`,
          }),
      ],
    });
  },
};
