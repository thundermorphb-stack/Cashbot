// The fictional stock market.
// volatility = how wildly the price swings each ~15 minutes.
// Prices can never fall below 25% or rise above 400% of the base price.

export interface StockDef {
  key: string; // stable id — never change once people own shares
  name: string;
  basePrice: number;
  volatility: number; // 0.08 = calm utility, 0.25 = meme-stock chaos
}

export const STOCKS: StockDef[] = [
  { key: "technova", name: "📱 TechNova", basePrice: 100, volatility: 0.12 },
  { key: "pixelforge", name: "🎮 PixelForge Games", basePrice: 75, volatility: 0.15 },
  { key: "voltcore", name: "⚡ VoltCore Energy", basePrice: 120, volatility: 0.08 },
  { key: "snackfactory", name: "🍫 The Snack Factory", basePrice: 60, volatility: 0.1 },
  { key: "dogemax", name: "🐕 DogeMax Meme Fund", basePrice: 40, volatility: 0.25 },
];

export function findStock(key: string): StockDef | undefined {
  return STOCKS.find((stock) => stock.key === key);
}
