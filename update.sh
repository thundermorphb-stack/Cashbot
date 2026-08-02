#!/usr/bin/env bash
# Updates the bot on the server. Run from the cashbot folder:  ./update.sh
set -e # stop immediately if any step fails

echo "── Pulling latest code from GitHub..."
git pull

echo "── Installing any new dependencies..."
npm install

echo "── Applying any database changes..."
npm run db:deploy

echo "── Re-registering slash commands with Discord..."
npm run deploy

echo "── Restarting the bot..."
pm2 restart cashbot

echo "✅ Update complete. Check with: pm2 logs cashbot"
