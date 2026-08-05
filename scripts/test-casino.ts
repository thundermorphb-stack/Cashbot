// Self-test for the casino games and the math answer parser.
// Run with: npm run casino:test

import { prisma } from "../src/lib/db.ts";
import {
  drawCard,
  playCards,
  playCoinflip,
  playNumberGuess,
  suitColor,
  NUMBER_PAYOUT,
  COINFLIP_PAYOUT,
} from "../src/lib/casino.ts";
import { getSetting, setSetting, deleteSetting } from "../src/lib/settings.ts";
import { parseAnswer } from "../src/commands/math.ts";

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (!ok) failures++;
}

// ---- Number guess ----
const numWin = playNumberGuess(100, 2, 2);
check(`number guess win pays ${NUMBER_PAYOUT}× (280)`, numWin.win && numWin.payout === 280);
check("number guess loss pays 0", !playNumberGuess(100, 1, 3).win && playNumberGuess(100, 1, 3).payout === 0);

// ---- Coinflip ----
const flipWin = playCoinflip(100, "heads", "heads");
check(`coinflip win pays ${COINFLIP_PAYOUT}× (190)`, flipWin.win && flipWin.payout === 190);
check("coinflip loss pays 0", playCoinflip(100, "heads", "tails").payout === 0);

// ---- Cards: every combination of right/wrong parts ----
const card = { rank: 12, suit: "hearts" } as const; // Q♥️ (red)

// Difficulty-scaled rewards: rank +350% (1-in-13), suit +80% (1-in-4),
// color +30% (1-in-2); every miss -25%.
const allRight = playCards(400, { rank: 12, color: "red", suit: "hearts" }, card);
check("all 3 correct → ×5.6 jackpot (2240 back from 400)", allRight.multiplier === 5.6 && allRight.payout === 2240);

const colorSuit = playCards(400, { rank: 5, color: "red", suit: "hearts" }, card);
check("color+suit right, rank wrong → ×1.85 (740 back)", colorSuit.multiplier === 1.85 && colorSuit.payout === 740);

const colorOnly = playCards(400, { rank: 5, color: "red", suit: "spades" }, card);
check("only color right → ×0.8 (320 back)", colorOnly.multiplier === 0.8 && colorOnly.payout === 320);

const rankOnly = playCards(400, { rank: 12, color: "black", suit: "spades" }, card);
check("only rank right → ×4.0 (1600 back)", rankOnly.multiplier === 4 && rankOnly.payout === 1600);

const allWrong = playCards(400, { rank: 5, color: "black", suit: "spades" }, card);
check("0 correct → ×0.25 (100 back)", allWrong.multiplier === 0.25 && allWrong.payout === 100);

check(
  "difficulty ladder holds: coinflip < number < cards jackpot",
  COINFLIP_PAYOUT < NUMBER_PAYOUT && NUMBER_PAYOUT < allRight.multiplier
);

// Suit → color consistency, and drawn cards are always valid.
check("hearts/diamonds are red, spades/clubs are black",
  suitColor("hearts") === "red" && suitColor("diamonds") === "red" &&
  suitColor("spades") === "black" && suitColor("clubs") === "black");

let drawsValid = true;
for (let i = 0; i < 10_000; i++) {
  const drawn = drawCard();
  if (drawn.rank < 1 || drawn.rank > 13) drawsValid = false;
}
check("10,000 drawn cards all have valid ranks 1-13", drawsValid);

// ---- Blackjack rules ----
const { handValue, isBlackjack, dealerPlay, settle } = await import("../src/lib/blackjack.ts");
const ace = { rank: 1, suit: "spades" } as const;
const king = { rank: 13, suit: "hearts" } as const;
const nine = { rank: 9, suit: "clubs" } as const;
const five = { rank: 5, suit: "diamonds" } as const;

check("A + K = 21 and is a natural blackjack", handValue([ace, king]) === 21 && isBlackjack([ace, king]));
check("A + 9 counts the ace as 11 (20)", handValue([ace, nine]) === 20);
check("K + 9 + A demotes the ace to 1 (20)", handValue([king, nine, ace]) === 20);
check("A + A + 9 = 21", handValue([ace, ace, nine]) === 21);
check("K + 9 + 5 busts at 24", handValue([king, nine, five]) === 24);
check("21 with three cards is NOT a natural", !isBlackjack([ace, ace, nine]));

check("natural blackjack pays 2.5× (250)", settle(100, [ace, king], [king, nine]).payout === 250);
check("normal win pays 2× (200)", settle(100, [king, nine], [king, five]).payout === 200);
check("push refunds the bet", settle(100, [king, nine], [nine, king]).payout === 100);
check("player bust loses even if dealer would bust too", settle(100, [king, nine, five], [king, nine, five]).payout === 0);
check("dealer bust pays the player", settle(100, [king, five], [king, nine, five]).payout === 200);

const dealerHand = dealerPlay([king, five], () => 0.999); // forced high draws
check("dealer always draws to 17 or more", handValue(dealerHand) >= 17);
check("dealer stands pat on 17+", dealerPlay([king, nine]).length === 2);

// ---- Casino channel setting ----
await setSetting("casino_channel", "123456789");
check("casino channel can be set and read", (await getSetting("casino_channel")) === "123456789");
await deleteSetting("casino_channel");
check("casino channel can be unset", (await getSetting("casino_channel")) === null);

// ---- The math answer parser understands humans ----
check('parses "1,050"', parseAnswer("1,050") === 1050);
check('parses " 42 "', parseAnswer(" 42 ") === 42);
check('parses "x=6"', parseAnswer("x=6") === 6);
check('parses "x = -6"', parseAnswer("x = -6") === -6);
check('parses "168.0"', parseAnswer("168.0") === 168);
check('parses "answer: 7"', parseAnswer("answer: 7") === 7);
check('parses en-dash negative "–6"', parseAnswer("–6") === -6);
check('parses "500 cash"', parseAnswer("500 cash") === 500);
check('rejects gibberish "hello"', parseAnswer("hello") === null);

await prisma.$disconnect();

if (failures > 0) {
  console.log(`\n${failures} problem(s) found.`);
  process.exit(1);
}
console.log("\nCasino test finished.");
