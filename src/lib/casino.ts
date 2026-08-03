// Casino rules. The game math is pure (and tested); the house always has
// a small edge, and every net loss removes CASH from circulation — the
// casino quietly fights inflation while it empties wallets.

export const CASINO_CHANNEL_KEY = "casino_channel";
export const MIN_BET = 10;
export const MAX_BET = 100_000;

// Payouts scale with difficulty: the harder the game, the higher the profit.
//   Coinflip  (1-in-2 chance)  → 1.9× your bet
//   Number    (1-in-3 chance)  → 2.8× your bet
//   Cards     (hardest)        → up to 4.35× if you nail all three parts

// ---- Game 1: guess a number between 1 and 3 ----
export const NUMBER_PAYOUT = 2.8;

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
// Rewards scale with how hard each part is to hit; every miss costs -25%.
//   Color (1-in-2):  +25%      Suit (1-in-4): +60%      Rank (1-in-13): +250%
// Best case ×4.35 payout, worst case ×0.25 (you keep a quarter of your bet).

export const CARD_REWARDS = { rank: 2.5, color: 0.25, suit: 0.6 } as const;
export const CARD_PENALTY = 0.25;

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
  const multiplier =
    1 +
    (rankOk ? CARD_REWARDS.rank : -CARD_PENALTY) +
    (colorOk ? CARD_REWARDS.color : -CARD_PENALTY) +
    (suitOk ? CARD_REWARDS.suit : -CARD_PENALTY);
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
