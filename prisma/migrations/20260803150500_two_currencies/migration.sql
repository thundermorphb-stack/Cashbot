-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Loan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lenderId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "principal" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'cash',
    "ratePct" REAL NOT NULL,
    "repaid" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Loan" ("borrowerId", "id", "lenderId", "principal", "ratePct", "repaid", "startedAt") SELECT "borrowerId", "id", "lenderId", "principal", "ratePct", "repaid", "startedAt" FROM "Loan";
DROP TABLE "Loan";
ALTER TABLE "new_Loan" RENAME TO "Loan";
CREATE INDEX "Loan_borrowerId_idx" ON "Loan"("borrowerId");
CREATE INDEX "Loan_lenderId_idx" ON "Loan"("lenderId");
CREATE TABLE "new_Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'cash',
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "createdAt", "id", "reason", "userId") SELECT "amount", "createdAt", "id", "reason", "userId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet" INTEGER NOT NULL DEFAULT 500,
    "coins" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_User" ("bonusRolls", "createdAt", "id", "jobBonus", "jobId", "jobRerollsResetAt", "jobRerollsUsed", "level", "totalEarned", "totalSpent", "wallet", "xp") SELECT "bonusRolls", "createdAt", "id", "jobBonus", "jobId", "jobRerollsResetAt", "jobRerollsUsed", "level", "totalEarned", "totalSpent", "wallet" + "bank", "xp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

