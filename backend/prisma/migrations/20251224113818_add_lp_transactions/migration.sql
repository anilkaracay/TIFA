-- CreateTable
CREATE TABLE "LPTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "lpShares" TEXT NOT NULL,
    "sharePrice" TEXT NOT NULL,
    "balanceImpact" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Settled',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LPTransaction_wallet_fkey" FOREIGN KEY ("wallet") REFERENCES "LPPosition" ("wallet") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LPTransaction_wallet_idx" ON "LPTransaction"("wallet");

-- CreateIndex
CREATE INDEX "LPTransaction_txHash_idx" ON "LPTransaction"("txHash");

-- CreateIndex
CREATE INDEX "LPTransaction_createdAt_idx" ON "LPTransaction"("createdAt");
