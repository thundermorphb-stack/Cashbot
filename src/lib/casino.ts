// Casino rules. The game math is pure (and tested); the house always has
// a small edge, and every net loss removes CASH from circulation — the
// casino quietly fights inflation while it empties wallets.

export const CASINO_CHANNEL_KEY = "casino_channel";
export const MIN_BET = 10;
export const MAX_BET = 100_000;

// ---- Game 1: guess a number between 1 and 3 ----
// Win chance 1/3, payout 2.5× the bet (house keeps the difference).
export const NUMBER_PAYOUT = 2.5;

export function playNumberGuess(bet: number, guess: number, rolled: number) {
  const win = guess === rolled;
  return { win, rolled, payout: win ? Math.round(bet * NUMBER_PAYOUT) : 0 };
}

// ---- Game 2: coinflip ----
// Win chance 1/2, payout 1.9× the bet.
export const COINFLIP_PAYOUT = 1.9;

export function playCoinflip(bet: number, guess: "heads" | "tails", flip: "heads" | "tails") {
  const win = guess === flip;
  return { win, flip, payout: win ? Math.round(bet * COINFLIP_PAYOUT) : 0 };
}

// ---- Game 3: card guessing ----
// Guess the rank, color, and suit of a hidden card.
// Each correct guess: +25% profit. Each wrong guess: -25%.
// Best case ×1.75 payout, worst case ×0.25 (you keep a quarter of your bet).

export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export type Suit = (typeof SUITS)[number];

export const SUIT_EMOJI: Record<Suit, string> = {
  spades: "♠️",
  hearts: "♥️",
  diamonds: "♦️",
  clubs: "♣️",
};

export const RANK_NAMES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function suitColor(suit: Suit): "red" | "black" {
  return suit === "hearts" || suit === "diamonds" ? "red" : "black";
}

export interface Card {
  rank: number; // 1-13 (A=1, J=11, Q=12, K=13)
  suit: Suit;
}

export function drawCard(rng: () => number = Math.random): Card {
  return {
    rank: 1 + Math.floor(rng() * 13),
    suit: SUITS[Math.floor(rng() * 4)],
  };
}

export function formatCard(card: Card): string {
  return `${RANK_NAMES[card.rank - 1]}${SUIT_EMOJI[card.suit]} (${suitColor(card.suit)})`;
}

export function playCards(
  bet: number,
  guess: { rank: number; color: "red" | "black"; suit: Suit },
  card: Card
) {
  const rankOk = guess.rank === card.rank;
  const colorOk = guess.color === suitColor(card.suit);
  const suitOk = guess.suit === card.suit;
  const correct = [rankOk, colorOk, suitOk].filter(Boolean).length;
  // +25% per correct, -25% per wrong: 3 correct → ×1.75, 0 correct → ×0.25
  const multiplier = 1 + 0.25 * correct - 0.25 * (3 - correct);
  return {
    card,
    rankOk,
    colorOk,
    suitOk,
    correct,
    multiplier,
    payout: Math.round(bet * multiplier),
  };
}
