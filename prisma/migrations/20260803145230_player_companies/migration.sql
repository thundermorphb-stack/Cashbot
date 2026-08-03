-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Stock" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "genre" TEXT NOT NULL DEFAULT 'tech',
    "ownerId" TEXT,
    "price" INTEGER NOT NULL,
    "prevPrice" INTEGER NOT NULL,
    "basePrice" INTEGER NOT NULL DEFAULT 100,
    "volatility" REAL NOT NULL DEFAULT 0.1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Stock" ("key", "prevPrice", "price", "updatedAt") SELECT "key", "prevPrice", "price", "updatedAt" FROM "Stock";
DROP TABLE "Stock";
ALTER TABLE "new_Stock" RENAME TO "Stock";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
