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

### Money between players
| Command | What it does |
| --- | --- |
| `/give @user amount` | Donate CASH (the taxman takes a random 7–10% cut) |
| `/loan offer @user amount rate` | Offer a loan; interest grows every 20 min; they must accept |
| `/loan repay [amount]` | Pay back your debt (partial or full) |
| `/loan status` | What you owe and what you're owed |
| `/loan forgive @user` | Wipe someone's remaining debt to you |

While in debt, **everything the borrower earns** (math, trivia, daily) is
garnished straight to the lender until the debt is cleared. Debt is capped at
5× the original loan.

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
| `/grantrolls` | (Admins) gift a player extra job rolls |

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

### Option B — Google Cloud (free tier, recommended)

A Compute Engine **e2-micro** VM is part of Google's always-free tier and is
perfect for this bot. One-time setup, then the bot runs forever without your
computer.

**1. Create the VM** at https://console.cloud.google.com
- Create a project → Compute Engine → Create Instance.
- Machine type: `e2-micro`. Region: `us-west1`, `us-central1`, or `us-east1`
  (only these are free-tier). Boot disk: Debian 12, 30 GB standard.
- Everything else default → Create. Click **SSH** to open a terminal in the browser.

**2. Install Node.js and git on the VM** (paste into the SSH window):

```bash
sudo apt update && sudo apt install -y git build-essential && curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
```

**3. Get the code and set it up:**

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git cashbot && cd cashbot
```

- Create the secrets file: `nano .env`, paste the same contents as your local
  `.env` (token, IDs...), save with Ctrl+O Enter, exit with Ctrl+X.
  Secrets are never in git — this file is recreated by hand on each machine.

```bash
npm install && npm run db:deploy && npm run deploy
```

**4. Keep it running forever with pm2:**

```bash
sudo npm install -g pm2 && pm2 start npm --name cashbot -- start && pm2 save && pm2 startup
```

- `pm2 startup` prints one `sudo ...` command — paste and run it. That makes
  the bot auto-start even if Google reboots the VM.
- Check on it anytime with `pm2 logs cashbot` / `pm2 status`.

**Updating later:** push changes to GitHub from your computer, then on the VM:

```bash
cd cashbot && git pull && npm install && npm run db:deploy && npm run deploy && pm2 restart cashbot
```

**Keeping your existing economy:** the database is NOT in git (on purpose).
To move current balances to the server, copy your local `dev.db` into the
`cashbot` folder on the VM (with `gcloud compute scp dev.db NAME:~/cashbot/`
or the SSH window's Upload File button) before starting the bot.
IMPORTANT: only one machine should run the bot at a time — stop it locally.

### Backups
The entire economy lives in one file: `dev.db` in the project folder. Copy it
somewhere safe now and then. Restoring = putting the file back.

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
