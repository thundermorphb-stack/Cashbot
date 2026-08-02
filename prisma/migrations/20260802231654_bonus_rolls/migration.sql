-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet" INTEGER NOT NULL DEFAULT 500,
    "bank" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "jobBonus" REAL NOT NULL DEFAULT 0,
    "jobId" INTEGER,
    "jobRerollsUsed" INTEGER NOT NULL DEFAULT 0,
    "jobRerollsResetAt" DATETIME,
    "bonusRolls" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("bank", "createdAt", "id", "jobBonus", "jobId", "jobRerollsResetAt", "jobRerollsUsed", "level", "totalEarned", "totalSpent", "wallet", "xp") SELECT "bank", "createdAt", "id", "jobBonus", "jobId", "jobRerollsResetAt", "jobRerollsUsed", "level", "totalEarned", "totalSpent", "wallet", "xp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
