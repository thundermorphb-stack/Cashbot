// The shop catalog.
// Base prices are deliberately steep — perks should feel like achievements.
// The FINAL price also rises and falls with server-wide inflation
// (see getInflation in src/lib/economy.ts).
//
// Security items lower a thief's success chance against you (best one counts).

export interface ShopItemDef {
  key: string; // stable internal id — never change once players own one
  name: string; // what players see
  description: string;
  basePrice: number;
  type: "security" | "perk";
  durationDays?: number; // how long it lasts; empty = permanent
  consumable?: boolean; // true = used instantly, never stored in inventory
  securityReduction?: number; // 0.10 = thieves are 10% less likely to succeed
  needsText?: boolean; // item requires the "text" option when buying
  needsColor?: boolean; // item requires the "color" option when buying
  needsImage?: boolean; // item requires the "image" option when buying
}

export const SHOP_ITEMS: ShopItemDef[] = [
  // ---- Security (protect your wallet from /steal) ----
  {
    key: "padlock",
    name: "🔒 Padlock",
    description: "Thieves are 10% less likely to rob you. Lasts 3 days.",
    basePrice: 1_500,
    type: "security",
    durationDays: 3,
    securityReduction: 0.1,
  },
  {
    key: "guard_dog",
    name: "🐕 Guard Dog",
    description: "Thieves are 18% less likely to rob you. Lasts 5 days.",
    basePrice: 4_000,
    type: "security",
    durationDays: 5,
    securityReduction: 0.18,
  },
  {
    key: "alarm_system",
    name: "🚨 Alarm System",
    description: "Thieves are 28% less likely to rob you. Lasts 7 days.",
    basePrice: 10_000,
    type: "security",
    durationDays: 7,
    securityReduction: 0.28,
  },
  {
    key: "bodyguard",
    name: "🥷 Bodyguard",
    description: "Thieves are 40% less likely to rob you. Lasts 14 days.",
    basePrice: 25_000,
    type: "security",
    durationDays: 14,
    securityReduction: 0.4,
  },

  // ---- Perks (spend your fortune in style) ----
  {
    key: "nickname",
    name: "✏️ Custom Nickname",
    description: "The bot sets any server nickname you want.",
    basePrice: 2_000,
    type: "perk",
    consumable: true,
    needsText: true,
  },
  {
    key: "role_color",
    name: "🎨 Custom Role Color",
    description: "Your name glows in a color of your choice for 30 days.",
    basePrice: 6_000,
    type: "perk",
    durationDays: 30,
    needsColor: true,
  },
  {
    key: "custom_role",
    name: "👑 Custom Role",
    description: "Your own role with a custom name (and color) for 30 days.",
    basePrice: 12_000,
    type: "perk",
    durationDays: 30,
    needsText: true,
  },
  {
    key: "custom_emoji",
    name: "😀 Custom Emoji",
    description: "Upload a permanent server emoji. Provide an image + name.",
    basePrice: 15_000,
    type: "perk",
    needsText: true,
    needsImage: true,
  },
  {
    key: "custom_sticker",
    name: "🖼️ Custom Sticker",
    description: "Upload a permanent server sticker. Provide an image + name.",
    basePrice: 20_000,
    type: "perk",
    needsText: true,
    needsImage: true,
  },
  {
    key: "announcement",
    name: "📢 Funny Announcement",
    description: "The bot loudly announces your message in this channel.",
    basePrice: 3_000,
    type: "perk",
    consumable: true,
    needsText: true,
  },
  {
    key: "rent_text_channel",
    name: "💬 Rent a Chat Channel",
    description: "Your own private text channel for 7 days. You pick the name.",
    basePrice: 12_000,
    type: "perk",
    durationDays: 7,
    needsText: true,
  },
  {
    key: "rent_voice_channel",
    name: "🔊 Rent a Voice Channel",
    description: "Your own private voice channel for 7 days. You pick the name.",
    basePrice: 9_000,
    type: "perk",
    durationDays: 7,
    needsText: true,
  },
  {
    key: "vip",
    name: "💎 VIP",
    description: "The shiny VIP role, shown separately in the member list. 30 days.",
    basePrice: 50_000,
    type: "perk",
    durationDays: 30,
  },
];

export function findShopItem(key: string): ShopItemDef | undefined {
  return SHOP_ITEMS.find((item) => item.key === key);
}
