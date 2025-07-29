-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductOptionSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "applyToAll" BOOLEAN NOT NULL DEFAULT true,
    "productTags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ProductOptionSet" ("active", "createdAt", "id", "name", "shop", "updatedAt") SELECT "active", "createdAt", "id", "name", "shop", "updatedAt" FROM "ProductOptionSet";
DROP TABLE "ProductOptionSet";
ALTER TABLE "new_ProductOptionSet" RENAME TO "ProductOptionSet";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
