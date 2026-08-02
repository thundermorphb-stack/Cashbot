// Creates one shared database connection for the whole bot.
// Import `prisma` from this file whenever you need to read or write data.
// (This file only needs DATABASE_URL, so the database works even before
// the Discord token is set up.)

import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../generated/prisma/client.ts";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

export const prisma = new PrismaClient({ adapter });
