// /buy — purchase a shop item at today's inflation-adjusted price.
// Some items need extra input:
//   text  → nickname, role name, announcement, channel name, emoji/sticker name
//   color → hex like #ff0088 for role colors
//   image → the picture for emojis and stickers
// If applying the perk fails, the buyer is automatically refunded.

import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";
import { addCash, canAfford, getInflation, inflatedPrice, removeCash } from "../lib/economy.ts";
import { addToInventory } from "../lib/shop.ts";
import { SHOP_ITEMS, findShopItem } from "../data/shop.ts";
import { applyPerk, PerkError } from "../features/perks.ts";
import { log } from "../logger.ts";

export const buy: Command = {
  data: new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Buy something from the CASH shop")
    .addStringOption((option) =>
      option
        .setName("item")
        .setDescription("What to buy (see /shop for prices)")
        .setRequired(true)
        .addChoices(...SHOP_ITEMS.map((item) => ({ name: item.name, value: item.key })))
    )
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("Nickname / role name / announcement / channel or emoji name")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option.setName("color").setDescription("Hex color like #ff0088").setRequired(false)
    )
    .addAttachmentOption((option) =>
      option.setName("image").setDescription("Image for emoji/sticker purchases").setRequired(false)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const item = findShopItem(interaction.options.getString("item", true));
    const fail = (text: string) =>
      interaction.reply({ content: text, flags: MessageFlags.Ephemeral });

    if (!item) return void (await fail("That item doesn't exist. Check /shop!"));

    // ---- Check the required extras up front, before taking any money ----
    if (item.needsText && !interaction.options.getString("text"))
      return void (await fail(`✍️ **${item.name}** needs the \`text\` option — add it after picking the item.`));
    if (item.needsColor && !interaction.options.getString("color"))
      return void (await fail(`🎨 **${item.name}** needs the \`color\` option — a hex code like \`#ff0088\`.`));
    if (item.needsImage && !interaction.options.getAttachment("image"))
      return void (await fail(`🖼️ **${item.name}** needs the \`image\` option — attach a picture.`));

    // ---- Check the price at current inflation ----
    const inflation = await getInflation();
    const price = inflatedPrice(item.basePrice, inflation.multiplier);
    if (!(await canAfford(userId, price)))
      return void (await fail(
        `💸 **${item.name}** costs **${price.toLocaleString()} CASH** right now (inflation ×${inflation.multiplier}) — you can't afford it. Get earning!`
      ));

    // Perks can take a moment (creating roles/channels/emojis).
    await interaction.deferReply();

    // ---- Pay first, then deliver; refund automatically if delivery fails ----
    await removeCash(userId, price, `Shop: ${item.name}`);
    try {
      // Security items just need to sit in your inventory to work.
      const result =
        item.type === "security"
          ? {
              note:
                `You're protected! Thieves now have a **${Math.round((item.securityReduction ?? 0) * 100)}% lower** ` +
                `success chance against you for **${item.durationDays} days**. (Your best security item counts.)`,
              metadata: undefined,
            }
          : await applyPerk(interaction, item);
      if (!item.consumable) {
        await addToInventory(userId, item, result.metadata);
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle(`🛍️ Purchased: ${item.name}`)
            .setDescription(result.note)
            .setFooter({
              text:
                `-${price.toLocaleString()} CASH (inflation ×${inflation.multiplier})` +
                (item.durationDays ? ` · expires in ${item.durationDays} days` : ""),
            }),
        ],
      });
    } catch (error) {
      await addCash(userId, price, `Refund: ${item.name}`);
      if (error instanceof PerkError) {
        await interaction.editReply(`⚠️ ${error.message}\n💵 Your **${price.toLocaleString()} CASH** was refunded.`);
      } else {
        log.error(`Purchase of ${item.key} failed unexpectedly:`, error);
        await interaction.editReply(
          `⚠️ Something went wrong delivering **${item.name}**. Your **${price.toLocaleString()} CASH** was refunded.`
        );
      }
    }
  },
};
