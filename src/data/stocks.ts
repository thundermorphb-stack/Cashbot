// The stock market's content: the 5 default companies and the genre system
// used to generate names for player-founded businesses.
// Company names are always built by the bot (prefix + suffix per genre),
// and no two companies can ever share a name.

export interface StockDef {
  key: string; // stable id — never change once people own shares
  name: string;
  genre: GenreKey;
  basePrice: number;
  volatility: number; // 0.08 = calm utility, 0.25 = meme-stock chaos
}

// These 5 exist from day one and stay listed UNTIL the server has 10
// player-owned companies — then they're delisted (investors are paid out).
export const DEFAULT_STOCKS: StockDef[] = [
  { key: "technova", name: "TechNova", genre: "tech", basePrice: 100, volatility: 0.12 },
  { key: "pixelforge", name: "PixelForge Games", genre: "gaming", basePrice: 75, volatility: 0.15 },
  { key: "voltcore", name: "VoltCore Energy", genre: "energy", basePrice: 120, volatility: 0.08 },
  { key: "snackfactory", name: "The Snack Factory", genre: "food", basePrice: 60, volatility: 0.1 },
  { key: "dogemax", name: "DogeMax Meme Fund", genre: "meme", basePrice: 40, volatility: 0.25 },
];

export const GENRES = {
  tech: {
    label: "Technology",
    emoji: "📱",
    prefixes: ["Quantum", "Neo", "Cyber", "Byte", "Cloud", "Nano", "Hyper"],
    suffixes: ["Systems", "Labs", "Dynamics", "Logic", "Works", "Core", "Soft"],
  },
  gaming: {
    label: "Gaming",
    emoji: "🎮",
    prefixes: ["Pixel", "Retro", "Epic", "Turbo", "Shadow", "Neon", "Loot"],
    suffixes: ["Studios", "Games", "Arcade", "Interactive", "Forge", "Play", "Quest"],
  },
  energy: {
    label: "Energy",
    emoji: "⚡",
    prefixes: ["Volt", "Solar", "Fusion", "Thunder", "Atomic", "Green", "Plasma"],
    suffixes: ["Power", "Energy", "Grid", "Reactor", "Fuel", "Watt", "Charge"],
  },
  food: {
    label: "Food & Drink",
    emoji: "🍔",
    prefixes: ["Crispy", "Golden", "Sugar", "Spicy", "Cosmic", "Happy", "Crunchy"],
    suffixes: ["Bites", "Kitchen", "Snacks", "Diner", "Farms", "Treats", "Feast"],
  },
  meme: {
    label: "Meme Economy",
    emoji: "🐕",
    prefixes: ["Doge", "Stonk", "Yolo", "Moon", "Giga", "Sigma", "Meme"],
    suffixes: ["Capital", "Holdings", "Fund", "Ventures", "Industries", "Empire", "Inc"],
  },
  fashion: {
    label: "Fashion",
    emoji: "👗",
    prefixes: ["Velvet", "Gilded", "Urban", "Royal", "Chic", "Luxe", "Silk"],
    suffixes: ["Couture", "Threads", "Styles", "Wear", "Boutique", "Trends", "Attire"],
  },
  space: {
    label: "Space",
    emoji: "🚀",
    prefixes: ["Astro", "Lunar", "Orbit", "Star", "Nova", "Cosmo", "Rocket"],
    suffixes: ["Dynamics", "Ventures", "Industries", "Expeditions", "Command", "Fleet", "Horizons"],
  },
  crypto: {
    label: "Crypto",
    emoji: "🪙",
    prefixes: ["Block", "Hash", "Ledger", "Coin", "Ether", "Satoshi", "Vault"],
    suffixes: ["Chain", "Mining", "Exchange", "Protocol", "Capital", "Network", "Reserve"],
  },
  media: {
    label: "Entertainment",
    emoji: "🎬",
    prefixes: ["Silver", "Prime", "Mega", "Global", "Starlight", "Echo", "Viral"],
    suffixes: ["Studios", "Media", "Pictures", "Broadcasting", "Entertainment", "Films", "Network"],
  },
} as const;

export type GenreKey = keyof typeof GENRES;

export function genreEmoji(genre: string): string {
  return GENRES[genre as GenreKey]?.emoji ?? "🏢";
}
