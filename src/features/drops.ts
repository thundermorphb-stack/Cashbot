// Money drops: every so often, free CASH appears in a channel and the
// first person to press the button claims it. Only one winner!
//
// Automatic drops go to the channel set as DROP_CHANNEL_ID in .env.
// If that isn't set, automatic drops are off (admins can still use /drop).

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  type Client,
  type TextChannel,
} from "discord.js";
import { addCash } from "../lib/economy.ts";
import { log } from "../logger.ts";

// Tweak these to taste:
const MIN_MINUTES_BETWEEN_DROPS = 30;
const MAX_MINUTES_BETWEEN_DROPS = 90;
const MIN_AMOUNT = 100;
const MAX_AMOUNT = 1000;
const CLAIM_WINDOW_MINUTES = 5;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Posts one CASH drop in the given channel and pays whoever clicks first.
 * Used by both the automatic schedule and the admin /drop command.
 */
export async function postDrop(channel: TextChannel, amount?: number) {
  const cash = amount ?? randomInt(MIN_AMOUNT, MAX_AMOUNT);

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("💵 CASH DROP")
    .setDescription(`**${cash.toLocaleString()} CASH** appeared!\nFirst to press the button wins it!`)
    .setFooter({ text: `Disappears in ${CLAIM_WINDOW_MINUTES} minutes` });

  const button = new ButtonBuilder()
    .setCustomId("drop-claim")
    .setLabel(`Claim ${cash.toLocaleString()} CASH`)
    .setEmoji("💰")
    .setStyle(ButtonStyle.Success);

  const message = await channel.send({
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
  });

  // max: 1 → the very first click wins and the collector stops.
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: CLAIM_WINDOW_MINUTES * 60_000,
    max: 1,
  });

  collector.on("collect", async (click) => {
    await addCash(click.user.id, cash, "Money Drop");
    await click.update({
      embeds: [
        EmbedBuilder.from(embed)
          .setColor(0x2ecc71)
          .setDescription(`**${click.user}** claimed **${cash.toLocaleString()} 💵 CASH**!`)
          .setFooter({ text: "Better luck next time, everyone else!" }),
      ],
      components: [], // remove the button
    });
  });

  collector.on("end", async (collected) => {
    if (collected.size > 0) return; // someone won — already handled
    await message
      .edit({
        embeds: [
          EmbedBuilder.from(embed)
            .setColor(0x95a5a6)
            .setDescription(`Nobody claimed the **${cash.toLocaleString()} CASH**... it blew away in the wind. 🍃`)
            .setFooter({ text: "Stay alert for the next drop!" }),
        ],
        components: [],
      })
      .catch(() => {});
  });
}

/** Starts the endless random-drop schedule. Call once when the bot is ready. */
export function startDrops(client: Client) {
  const channelId = process.env.DROP_CHANNEL_ID;
  if (!channelId || channelId.startsWith("PASTE_")) {
    log.warn("DROP_CHANNEL_ID is not set in .env — automatic money drops are OFF (admins can still use /drop).");
    return;
  }

  const scheduleNext = () => {
    const minutes = randomInt(MIN_MINUTES_BETWEEN_DROPS, MAX_MINUTES_BETWEEN_DROPS);
    log.info(`Next money drop in ${minutes} minutes`);
    setTimeout(async () => {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel?.type === ChannelType.GuildText) {
          await postDrop(channel as TextChannel);
        } else {
          log.warn("DROP_CHANNEL_ID does not point to a normal text channel — drop skipped.");
        }
      } catch (error) {
        log.error("Money drop failed:", error);
      }
      scheduleNext(); // and again, forever
    }, minutes * 60_000);
  };

  scheduleNext();
}
