// /leaderboard — the server's hall of fame (and infamy).
// Views: richest wallets+banks, highest net worth (cash + stocks),
// best jobs, best investors, and the most successful thieves.

import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { prisma } from "../lib/db.ts";
import { getPrices } from "../lib/stocks.ts";
import { RARITIES, type Rarity } from "../data/jobs.ts";

const MEDALS = ["🥇", "🥈", "🥉"];

function rank(index: number): string {
  return MEDALS[index] ?? `**${index + 1}.**`;
}

/** Turns user IDs into readable names (mentions render nicely in embeds). */
function mention(userId: string): string {
  return `<@${userId}>`;
}

type Row = { userId: string; text: string };

export const leaderboard: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("See the server's top earners, investors, and thieves")
    .addStringOption((option) =>
      option
        .setName("board")
        .setDescription("Which ranking to show")
        .setRequired(true)
        .addChoices(
          { name: "💵 Richest (wallet + bank)", value: "richest" },
          { name: "💰 Highest net worth (cash + stocks)", value: "networth" },
          { name: "💼 Best jobs", value: "jobs" },
          { name: "📊 Best investors", value: "investors" },
          { name: "🦹 Most successful thieves", value: "thieves" }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const board = interaction.options.getString("board", true);
    let title = "";
    let rows: Row[] = [];

    if (board === "richest") {
      title = "💵 Richest Members";
      const users = await prisma.user.findMany();
      rows = users
        .map((user) => ({ userId: user.id, total: user.wallet + user.bank }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((entry) => ({
          userId: entry.userId,
          text: `**${entry.total.toLocaleString()} CASH**`,
        }));
    }

    if (board === "networth") {
      title = "💰 Highest Net Worth";
      const [users, investments, prices] = await Promise.all([
        prisma.user.findMany(),
        prisma.investment.findMany(),
        getPrices(),
      ]);
      const priceMap = new Map(prices.map((row) => [row.key, row.price]));
      const stockValue = new Map<string, number>();
      for (const lot of investments) {
        const value = (priceMap.get(lot.company) ?? 0) * lot.shares;
        stockValue.set(lot.userId, (stockValue.get(lot.userId) ?? 0) + value);
      }
      rows = users
        .map((user) => ({
          userId: user.id,
          total: user.wallet + user.bank + (stockValue.get(user.id) ?? 0),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((entry) => ({
          userId: entry.userId,
          text: `**${entry.total.toLocaleString()} CASH**`,
        }));
    }

    if (board === "jobs") {
      title = "💼 Best Jobs";
      const users = await prisma.user.findMany({
        where: { jobId: { not: null } },
        include: { job: true },
        orderBy: { jobBonus: "desc" },
        take: 10,
      });
      rows = users.map((user) => ({
        userId: user.id,
        text: `**${user.job!.name}** (${RARITIES[user.job!.rarity as Rarity].label}, +${Math.round(user.jobBonus * 100)}%)`,
      }));
    }

    if (board === "investors") {
      title = "📊 Best Investors";
      const [investments, prices] = await Promise.all([
        prisma.investment.findMany(),
        getPrices(),
      ]);
      const priceMap = new Map(prices.map((row) => [row.key, row.price]));
      const totals = new Map<string, number>();
      for (const lot of investments) {
        const value = (priceMap.get(lot.company) ?? 0) * lot.shares;
        totals.set(lot.userId, (totals.get(lot.userId) ?? 0) + value);
      }
      rows = [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([userId, value]) => ({
          userId,
          text: `portfolio worth **${value.toLocaleString()} CASH**`,
        }));
    }

    if (board === "thieves") {
      title = "🦹 Most Successful Thieves";
      const grouped = await prisma.transaction.groupBy({
        by: ["userId"],
        where: { reason: "Steal Success" },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      });
      rows = grouped.map((entry) => ({
        userId: entry.userId,
        text: `stole **${(entry._sum.amount ?? 0).toLocaleString()} CASH** total`,
      }));
    }

    if (rows.length === 0) {
      await interaction.editReply("📭 Nothing to rank yet — this board is waiting for its first legend.");
      return;
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xd4af37)
          .setTitle(title)
          .setDescription(
            rows.map((row, i) => `${rank(i)} ${mention(row.userId)} — ${row.text}`).join("\n")
          )
          .setFooter({ text: "CASH — where everyone can make it (or take it)" }),
      ],
    });
  },
};
