// The command registry.
// When you create a new command file, import it here and add it to the list —
// that's all it takes to plug it into the bot.

import type { Command } from "../types.ts";
import { ping } from "./ping.ts";
import { balance } from "./balance.ts";
import { math } from "./math.ts";
import { trivia } from "./trivia.ts";
import { daily } from "./daily.ts";
import { job } from "./job.ts";
import { drop } from "./drop.ts";
import { steal } from "./steal.ts";
import { shop } from "./shop.ts";
import { buy } from "./buy.ts";
import { inventory } from "./inventory.ts";
import { stocks } from "./stocks.ts";
import { invest } from "./invest.ts";
import { portfolio } from "./portfolio.ts";
import { sell } from "./sell.ts";
import { leaderboard } from "./leaderboard.ts";

export const commands: Command[] = [
  ping,
  balance,
  math,
  trivia,
  daily,
  job,
  drop,
  steal,
  shop,
  buy,
  inventory,
  stocks,
  invest,
  portfolio,
  sell,
  leaderboard,
];
