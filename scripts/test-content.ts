// Self-test for the math questions and trivia bank. Run with: npm run content:test
// - Generates every math question style 2000 times and re-solves each one
//   to prove the stored answer is right and fits Discord's pop-up size limit.
// - Checks every trivia question is well-formed.

import { GENERATORS } from "../src/commands/math.ts";
import { TRIVIA } from "../src/data/trivia.ts";

let failures = 0;

function check(label: string, ok: boolean) {
  if (!ok) {
    console.log(`❌ ${label}`);
    failures++;
  }
}

// ---- Math questions ----
const MODAL_LABEL_LIMIT = 45; // Discord's max length for a pop-up field label

// Independently re-solve a question from its text, to catch generator bugs.
function solve(question: string): number | null {
  let m;
  if ((m = question.match(/^(\d+) \+ (\d+)$/))) return +m[1] + +m[2];
  if ((m = question.match(/^(\d+) - (\d+)$/))) return +m[1] - +m[2];
  if ((m = question.match(/^(\d+) \+ (\d+) - (\d+)$/))) return +m[1] + +m[2] - +m[3];
  if ((m = question.match(/^(\d+) × (\d+)$/))) return +m[1] * +m[2];
  if ((m = question.match(/^(\d+)% of (\d+)$/))) return (+m[1] * +m[2]) / 100;
  if ((m = question.match(/^(\d+)²$/))) return +m[1] * +m[1];
  if ((m = question.match(/^(\d+)x \+ (\d+) = (\d+)x(?: ([+-]) (\d+))?/))) {
    const d = m[4] ? (m[4] === "-" ? -+m[5] : +m[5]) : 0;
    return (d - +m[2]) / (+m[1] - +m[3]);
  }
  if ((m = question.match(/^\((\d+) × (\d+)\) - \((\d+) × (\d+)\)$/)))
    return +m[1] * +m[2] - +m[3] * +m[4];
  if ((m = question.match(/^remainder of (\d+) ÷ (\d+)$/))) return +m[1] % +m[2];
  return null;
}

let mathCount = 0;
for (const [difficulty, generators] of Object.entries(GENERATORS)) {
  for (const generate of generators) {
    for (let i = 0; i < 2000; i++) {
      const { question, answer } = generate();
      mathCount++;
      const expected = solve(question);
      check(`[${difficulty}] "${question}" is solvable by the checker`, expected !== null);
      check(`[${difficulty}] "${question}" stored answer ${answer} matches ${expected}`, expected === answer);
      check(`[${difficulty}] "${question}" answer is a whole number`, Number.isInteger(answer));
      check(
        `[${difficulty}] "${question}" fits in the pop-up label`,
        `What is: ${question}`.length <= MODAL_LABEL_LIMIT
      );
      if (failures > 10) {
        console.log("Too many failures, stopping early.");
        process.exit(1);
      }
    }
  }
}
console.log(`✅ ${mathCount} generated math questions all correct and within size limits`);

// ---- Trivia bank ----
const BUTTON_LABEL_LIMIT = 80; // Discord's max length for a button label
let triviaCount = 0;
for (const [category, questions] of Object.entries(TRIVIA)) {
  for (const q of questions) {
    triviaCount++;
    check(`[${category}] "${q.question}" has 3 wrong answers`, q.wrong.length === 3);
    const all = [q.correct, ...q.wrong];
    check(`[${category}] "${q.question}" has no duplicate answers`, new Set(all).size === 4);
    for (const answer of all) {
      check(`[${category}] answer "${answer}" fits on a button`, answer.length <= BUTTON_LABEL_LIMIT);
    }
  }
}
console.log(`✅ ${triviaCount} trivia questions all well-formed`);

if (failures > 0) {
  console.log(`\n${failures} problem(s) found.`);
  process.exit(1);
}
console.log("\nContent test finished.");
