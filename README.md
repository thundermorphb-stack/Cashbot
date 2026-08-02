# 💵 CASH — Discord Economy Bot

A capitalist playground for your Discord server. Members earn CASH through
math and trivia, improve their income with jobs, rob each other, buy server
perks, and play the stock market — while inflation keeps the economy honest.

## Commands

### Earning
| Command | What it does |
| --- | --- |
| `/math` | Solve a math question (easy/medium/hard) for 10–100 CASH. 5 min cooldown |
| `/trivia` | Answer a trivia question for 20–50 CASH. 10 min cooldown |
| `/daily` | Free 100–500 CASH every 24 hours |
| 💵 Drops | CASH randomly appears in the drop channel — first click claims it |

### Jobs
| Command | What it does |
| --- | --- |
| `/job roll` | Roll a random job (5 rolls/day). Rarer jobs pay +5% up to +100% on everything you earn |
| `/job view` | Your current job and rolls left |

### Crime & Protection
| Command | What it does |
| --- | --- |
| `/steal @user amount` | Rob someone's wallet. Win: take 50–100% of the attempt. Lose: pay them 150% |
| 🛡️ Security items | Padlock → Bodyguard lower thieves' success chance against you (see `/shop`) |

### Spending
| Command | What it does |
| --- | --- |
| `/shop` | Browse items and see the live inflation report |
| `/buy` | Buy nicknames, role colors, custom roles, emojis, stickers, announcements, private channels, VIP, security |
| `/inventory` | What you own, with expiry countdowns (expired perks are auto-removed) |

### Investing
| Command | What it does |
| --- | --- |
| `/stocks` | Market board — 5 fictional companies, prices move every ~15 min |
| `/invest` | Buy shares |
| `/portfolio` | Your holdings and profit/loss |
| `/sell` | Sell shares (oldest lots first) |

### Other
| Command | What it does |
| --- | --- |
| `/balance` | Wallet, bank, net worth, job, level |
| `/leaderboard` | Richest, highest net worth, best jobs, best investors, top thieves |
| `/ping` | Is the bot alive? |
| `/drop` | (Admins) force a CASH drop in this channel |

### Economy rules
- New members start with **500 CASH** automatically.
- Every CASH movement is logged with a reason in the database.
- Only **wallet** money can be stolen — the bank is safe.
- Shop prices scale ×0.8–×3.0 with the total money in circulation.

## Setup guide (one time)

### 1. Install the tools
- Install [Node.js](https://nodejs.org) (LTS version).
- In this folder run:

```bash
npm install
```

### 2. Create the bot on Discord's website
1. Go to https://discord.com/developers/applications → **New Application** → name it `CASH`.
2. **General Information** page → copy **Application ID** → paste into `.env` as `CLIENT_ID`.
3. **Bot** page → **Reset Token** → copy the token → paste into `.env` as `DISCORD_TOKEN`.
   Treat the token like a password. Never share it or commit it.

### 3. Invite the bot to your server
1. **OAuth2** page → **OAuth2 URL Generator** → tick `bot` and `applications.commands`.
2. Bot permissions: tick `Send Messages`, `Embed Links`, `Manage Nicknames`,
   `Manage Roles`, `Manage Channels`, `Manage Expressions`.
3. Open the generated URL and invite the bot.

### 4. Fill in the rest of `.env`
- `GUILD_ID` — right-click your server icon → Copy Server ID
  (needs Developer Mode: User Settings → Advanced).
- `DROP_CHANNEL_ID` — optional; right-click a channel → Copy Channel ID
  to enable automatic money drops there.

### 5. Create the database and register commands

```bash
npx prisma migrate dev
```

```bash
npm run deploy
```

## Running the bot

```bash
npm start
```

Stop with `Ctrl+C`. For development, `npm run dev` restarts on code changes.

## Deployment guide (running 24/7)

`npm start` only runs while the terminal stays open. For always-on:

### Option A — pm2 on any machine you leave on (simple)

```bash
npm install -g pm2
```

```bash
pm2 start "npm start" --name cashbot
```

```bash
pm2 save
```

- `pm2 logs cashbot` shows the logs, `pm2 restart cashbot` restarts,
  `pm2 startup` prints one command to make it survive reboots.

### Option B — a cheap VPS (most reliable)
Rent a small Linux server (Hetzner/DigitalOcean/Oracle free tier), then:
1. Install Node.js LTS and git.
2. Copy this folder to the server (or `git clone` if you push it to GitHub —
   the `.gitignore` already keeps `.env` and the database out of git).
3. Recreate `.env` on the server, run `npm install`, `npx prisma migrate dev`,
   `npm run deploy`, then use pm2 as above.

### Backups
The entire economy lives in one file: `prisma/dev.db`. Copy it somewhere safe
now and then. Restoring = putting the file back.

## Maintenance

| Task | Command |
| --- | --- |
| Run every test | `npm run test:all` |
| Browse the database visually | `npm run db:studio` |
| Change the schema | edit `prisma/schema.prisma`, then `npm run db:migrate` |
| Add a slash command | new file in `src/commands/`, register it in `src/commands/index.ts`, run `npm run deploy` |
| Add trivia questions | edit `src/data/trivia.ts` |
| Add jobs / shop items / stocks | edit the files in `src/data/` |

## Project structure

```
src/
  index.ts            Starts the bot, routes commands, starts background jobs
  config.ts           Loads and checks .env settings
  logger.ts           Timestamped logging
  types.ts            Shared TypeScript types
  deploy-commands.ts  Registers slash commands with Discord
  commands/           One file per slash command (+ index.ts registry)
  lib/                Rules: economy, cooldowns, jobs, steal, shop, stocks
  features/           Background behavior: drops, perk delivery, expiry sweeper
  data/               Content you can edit: trivia, jobs, shop catalog, stocks
prisma/
  schema.prisma       Database blueprint
  dev.db              The actual database (back this up!)
scripts/              Self-tests (npm run test:all)
```
