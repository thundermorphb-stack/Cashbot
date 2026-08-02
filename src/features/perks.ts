// What actually happens when someone buys each shop perk.
// Each handler either applies the perk (returns a note + metadata for cleanup)
// or throws a PerkError with a friendly message (the buyer gets refunded).

import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
} from "discord.js";
import type { ShopItemDef } from "../data/shop.ts";

/** A predictable, human-friendly failure (bad input, missing permission...). */
export class PerkError extends Error {}

export interface PerkResult {
  note: string; // shown to the buyer
  metadata?: Record<string, string>; // ids for later cleanup (role, channel...)
}

const HEX_COLOR = /^#?([0-9a-fA-F]{6})$/;

function parseColor(input: string | null): number {
  const match = input?.trim().match(HEX_COLOR);
  if (!match) {
    throw new PerkError(
      'Please give a hex color like `#ff0088` in the "color" option. (Google "color picker" to find one.)'
    );
  }
  return parseInt(match[1], 16);
}

async function getMember(interaction: ChatInputCommandInteraction): Promise<GuildMember> {
  if (!interaction.guild) throw new PerkError("Shop perks only work inside a server.");
  return interaction.guild.members.fetch(interaction.user.id);
}

/** Creates the role just below the bot's own highest role so colors show up. */
async function createPersonalRole(guild: Guild, name: string, color: number) {
  const me = await guild.members.fetchMe();
  return guild.roles.create({
    name,
    color,
    position: Math.max(1, me.roles.highest.position - 1),
    reason: "CASH shop purchase",
  });
}

export async function applyPerk(
  interaction: ChatInputCommandInteraction,
  item: ShopItemDef
): Promise<PerkResult> {
  const guild = interaction.guild;
  if (!guild) throw new PerkError("Shop perks only work inside a server.");
  const text = interaction.options.getString("text");
  const colorInput = interaction.options.getString("color");
  const image = interaction.options.getAttachment("image");
  const member = await getMember(interaction);

  switch (item.key) {
    case "nickname": {
      const nick = text!.slice(0, 32);
      if (guild.ownerId === member.id) {
        throw new PerkError(
          "Discord does not allow bots to change the **server owner's** nickname — sorry, that rule is above my pay grade. (Your CASH was not taken.)"
        );
      }
      await member.setNickname(nick, "CASH shop purchase").catch(() => {
        throw new PerkError(
          "I couldn't change that nickname — my role may be below yours, or I'm missing the **Manage Nicknames** permission."
        );
      });
      return { note: `Your nickname is now **${nick}**.` };
    }

    case "role_color": {
      const color = parseColor(colorInput);
      const role = await createPersonalRole(guild, `🎨 ${member.displayName}`, color).catch(() => {
        throw new PerkError("I couldn't create the role — I need the **Manage Roles** permission.");
      });
      await member.roles.add(role);
      return { note: `Your name now glows in **${colorInput}** for 30 days!`, metadata: { roleId: role.id } };
    }

    case "custom_role": {
      const name = text!.slice(0, 100);
      const color = colorInput ? parseColor(colorInput) : 0x99aab5;
      const role = await createPersonalRole(guild, name, color).catch(() => {
        throw new PerkError("I couldn't create the role — I need the **Manage Roles** permission.");
      });
      await member.roles.add(role);
      return { note: `You now wear the **${name}** role for 30 days!`, metadata: { roleId: role.id } };
    }

    case "custom_emoji": {
      const name = text!.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 32);
      if (name.length < 2) throw new PerkError("Emoji names need at least 2 letters/numbers.");
      const emoji = await guild.emojis
        .create({ attachment: image!.url, name, reason: `CASH shop: ${interaction.user.tag}` })
        .catch(() => {
          throw new PerkError(
            "Upload failed — the image must be under **256 KB** (PNG/JPG/GIF), and I need the **Manage Expressions** permission."
          );
        });
      return { note: `The ${emoji} \`:${name}:\` emoji now lives here forever!`, metadata: { emojiId: emoji.id } };
    }

    case "custom_sticker": {
      const name = text!.slice(0, 30);
      const sticker = await guild.stickers
        .create({
          file: image!.url,
          name,
          tags: "sparkles",
          reason: `CASH shop: ${interaction.user.tag}`,
        })
        .catch(() => {
          throw new PerkError(
            "Upload failed — stickers must be **PNG/APNG under 512 KB** and roughly 320×320, and I need the **Manage Expressions** permission."
          );
        });
      return { note: `Sticker **${sticker.name}** added to the server!`, metadata: { stickerId: sticker.id } };
    }

    case "announcement": {
      if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
        throw new PerkError("Announcements only work in a normal text channel.");
      }
      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe91e63)
            .setTitle("📢 PAID ANNOUNCEMENT")
            .setDescription(text!.slice(0, 1000))
            .setFooter({ text: `Sponsored by ${interaction.user.displayName}'s wallet` }),
        ],
      });
      return { note: "Your announcement has been broadcast. Money well spent." };
    }

    case "rent_text_channel":
    case "rent_voice_channel": {
      const isVoice = item.key === "rent_voice_channel";
      const name = text!.slice(0, 90);
      const me = await guild.members.fetchMe();
      const channel = await guild.channels
        .create({
          name,
          type: isVoice ? ChannelType.GuildVoice : ChannelType.GuildText,
          reason: `CASH shop rental: ${interaction.user.tag}`,
          permissionOverwrites: [
            // Private: hidden from everyone...
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            // ...except the renter (who can also invite friends)...
            {
              id: member.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageRoles,
              ],
            },
            // ...and the bot itself (so it can clean up later).
            { id: me.id, allow: [PermissionFlagsBits.ViewChannel] },
          ],
        })
        .catch(() => {
          throw new PerkError("I couldn't create the channel — I need the **Manage Channels** permission.");
        });
      return {
        note: `Your private ${isVoice ? "voice" : "chat"} channel ${channel} is ready for 7 days! Use its settings to invite friends.`,
        metadata: { channelId: channel.id },
      };
    }

    case "vip": {
      // One shared VIP role for the whole server, created on first purchase.
      let role = guild.roles.cache.find((r) => r.name === "💎 VIP");
      if (!role) {
        role = await createPersonalRole(guild, "💎 VIP", 0x1abc9c).catch(() => {
          throw new PerkError("I couldn't create the VIP role — I need the **Manage Roles** permission.");
        });
        await role.setHoist(true).catch(() => {}); // show VIPs separately in the member list
      }
      await member.roles.add(role);
      return { note: "Welcome to the **💎 VIP** club — enjoy 30 days of luxury!", metadata: { roleId: role.id } };
    }

    default:
      throw new PerkError("That item isn't wired up yet. (This is a bug — tell an admin!)");
  }
}
