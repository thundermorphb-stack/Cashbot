// /business found genre — start your own company! The bot picks the name
//     (no two companies can share one). Costs a fortune, but you earn a 5%
//     founder's cut every time someone else invests in you.
// /business view — your companies and how they're doing.
//
// When the server reaches 10 player-founded companies, the 5 default
// companies are delisted forever (their investors get paid out).

import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { prisma } from "../lib/db.ts";
import { getInflation, inflatedPrice } from "../lib/economy.ts";
import {
  countPlayerCompanies,
  displayName,
  foundCompany,
  DELIST_THRESHOLD,
  FOUND_COST_BASE,
  FOUNDER_CUT,
  MAX_COMPANIES_PER_PLAYER,
  NEW_COMPANY_PRICE,
} from "../lib/stocks.ts";
import { GENRES, type GenreKey } from "../data/stocks.ts";

export const business: Command = {
  data: new SlashCommandBuilder()
    .setName("business")
    .setDescription("Found and run your own companies")
    .addSubcommand((sub) =>
      sub
        .setName("found")
        .setDescription("Start a company — the bot names it, you collect the founder's cut")
        .addStringOption((option) =>
          option
            .setName("genre")
            .setDescription("What industry to enter")
            .setRequired(true)
            .addChoices(
              ...Object.entries(GENRES).map(([key, genre]) => ({
                name: `${genre.emoji} ${genre.label}`,
                value: key,
              }))
            )
        )
    )
    .addSubcommand((sub) => sub.setName("view").setDescription("See your companies")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    // ---------------- /business view ----------------
    if (sub === "view") {
      const mine = await prisma.stock.findMany({ where: { ownerId: userId } });
      if (mine.length === 0) {
        await interaction.reply({
          content: `🏢 You don't own a company yet. Start one with \`/business found\` (you can run up to ${MAX_COMPANIES_PER_PLAYER}).`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const lines: string[] = [];
      for (const row of mine) {
        const positions = await prisma.investment.findMany({ where: { company: row.key } });
        const investors = new Set(positions.map((p) => p.userId)).size;
        const shares = positions.reduce((sum, p) => sum + p.shares, 0);
        lines.push(
          `**${displayName(row)}** — 💵 **${row.price.toLocaleString()}**/share\n` +
            `-# ${investors} investor(s) holding ${shares.toLocaleString()} share(s) worth ${(shares * row.price).toLocaleString()} CASH`
        );
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2c3e50)
            .setTitle(`🏢 ${interaction.user.displayName}'s Business Empire`)
            .setDescription(lines.join("\n"))
            .setFooter({
              text: `You earn ${FOUNDER_CUT * 100}% of every CASH other players invest in your companies`,
            }),
        ],
      });
      return;
    }

    // ---------------- /business found ----------------
    const genre = interaction.options.getString("genre", true) as GenreKey;
    const inflation = await getInflation();
    const cost = inflatedPrice(FOUND_COST_BASE, inflation.multiplier);
    await interaction.deferReply();

    try {
      const { row, name, delisted } = await foundCompany(userId, genre, cost);
      const playerCompanies = await countPlayerCompanies();

      let description =
        `${interaction.user} founded **${displayName(row)}** for **${cost.toLocaleString()} 💵 CASH**!\n` +
        `Industry: **${GENRES[genre].emoji} ${GENRES[genre].label}** · IPO price: **${NEW_COMPANY_PRICE}**/share\n\n` +
        `📈 Every buy pushes the price up — and ${interaction.user} pockets a **${FOUNDER_CUT * 100}% founder's cut** ` +
        `of every CASH other players invest. Get people investing!`;

      if (delisted.length > 0) {
        description +=
          `\n\n🏛️ **HISTORIC MOMENT:** the server now has ${DELIST_THRESHOLD} player-owned companies! ` +
          `The old default companies (${delisted.join(", ")}) have been **delisted** — ` +
          `their investors were paid out at market price. The market belongs to the players now.`;
      } else {
        description += `\n-# Player companies: ${playerCompanies}/${DELIST_THRESHOLD} — at ${DELIST_THRESHOLD}, the default companies get delisted!`;
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder().setColor(0x2c3e50).setTitle("🏢 A Company is Born!").setDescription(description),
        ],
      });
    } catch (error) {
      if (error instanceof RangeError) {
        await interaction.editReply(`💸 ${error.message}`);
        return;
      }
      throw error;
    }
  },
};
