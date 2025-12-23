-- CreateTable
CREATE TABLE "LPPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet" TEXT NOT NULL,
    "shares" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "LPPosition_wallet_idx" ON "LPPosition"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "LPPosition_wallet_key" ON "LPPosition"("wallet");
