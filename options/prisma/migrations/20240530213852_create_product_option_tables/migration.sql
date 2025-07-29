-- CreateTable
CREATE TABLE "ProductOptionSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Option" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "values" TEXT,
    "dependOnOptionId" TEXT,
    "showWhenValue" TEXT,
    "productOptionSetId" TEXT NOT NULL,
    "price" REAL,
    CONSTRAINT "Option_productOptionSetId_fkey" FOREIGN KEY ("productOptionSetId") REFERENCES "ProductOptionSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
