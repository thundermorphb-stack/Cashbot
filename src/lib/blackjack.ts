// Blackjack rules (the classic casino game).
// Beat the dealer's hand without going over 21.
//   - Number cards = face value, J/Q/K = 10, Ace = 11 (or 1 if you'd bust)
//   - Dealer draws until reaching 17, then stands.
//   - Win pays 2× your bet; a natural blackjack (21 with 2 cards) pays 2.5×;
//     a tie ("push") refunds the bet.

import { drawCard, formatCard, type Card } from "./casino.ts";

export const WIN_PAYOUT = 2;
export const NATURAL_PAYOUT = 2.5;
export const DEALER_STANDS_AT = 17;

/** A single card's blackjack value (ace counts as 11 here). */
export function cardValue(rank: number): number {
  if (rank === 1) return 11; // ace
  return Math.min(10, rank); // J/Q/K → 10
}

/** Best possible hand total: aces drop from 11 to 1 to avoid busting. */
export function handValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += cardValue(card.rank);
    if (card.rank === 1) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

/** 21 from exactly two cards — the "natural". */
export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

/** The dealer's fixed strategy: draw until 17 or more. */
export function dealerPlay(startingCards: Card[], rng: () => number = Math.random): Card[] {
  const hand = [...startingCards];
  while (handValue(hand) < DEALER_STANDS_AT) {
    hand.push(drawCard(rng));
  }
  return hand;
}

export type BlackjackResult = "blackjack" | "win" | "push" | "lose";

/** Who won, and what the player gets back (0 on a loss). */
export function settle(bet: number, player: Card[], dealer: Card[]): { result: BlackjackResult; payout: number } {
  const playerValue = handValue(player);
  const dealerValue = handValue(dealer);

  if (playerValue > 21) return { result: "lose", payout: 0 };
  if (isBlackjack(player) && !isBlackjack(dealer)) {
    return { result: "blackjack", payout: Math.round(bet * NATURAL_PAYOUT) };
  }
  if (dealerValue > 21 || playerValue > dealerValue) {
    return { result: "win", payout: Math.round(bet * WIN_PAYOUT) };
  }
  if (playerValue === dealerValue) return { result: "push", payout: bet };
  return { result: "lose", payout: 0 };
}

/** "A♠️ K♥️ (21)" — with the dealer's second card hidden during play. */
export function formatHand(cards: Card[], hideAfterFirst = false): string {
  if (hideAfterFirst) {
    return `${formatCardShort(cards[0])} 🂠`;
  }
  return `${cards.map(formatCardShort).join(" ")}  (**${handValue(cards)}**)`;
}

function formatCardShort(card: Card): string {
  // formatCard includes the color in words; keep the table compact instead.
  return formatCard(card).replace(/ \((red|black)\)/, "");
}
