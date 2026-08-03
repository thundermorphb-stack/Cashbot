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

// Difficulty-scaled rewards: rank +250% (1-in-13), suit +60% (1-in-4),
// color +25% (1-in-2); every miss -25%.
const allRight = playCards(400, { rank: 12, color: "red", suit: "hearts" }, card);
check("all 3 correct → ×4.35 jackpot (1740 back from 400)", allRight.multiplier === 4.35 && allRight.payout === 1740);

const colorSuit = playCards(400, { rank: 5, color: "red", suit: "hearts" }, card);
check("color+suit right, rank wrong → ×1.6 (640 back)", colorSuit.multiplier === 1.6 && colorSuit.payout === 640);

const colorOnly = playCards(400, { rank: 5, color: "red", suit: "spades" }, card);
check("only color right → ×0.75 (300 back)", colorOnly.multiplier === 0.75 && colorOnly.payout === 300);

const rankOnly = playCards(400, { rank: 12, color: "black", suit: "spades" }, card);
check("only rank right → ×3.0 (1200 back)", rankOnly.multiplier === 3 && rankOnly.payout === 1200);

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
