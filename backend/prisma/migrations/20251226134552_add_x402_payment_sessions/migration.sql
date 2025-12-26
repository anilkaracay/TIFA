-- CreateTable
CREATE TABLE "X402PaymentSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "amountRequested" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "txHash" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "X402PaymentSession_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "X402PaymentSession_sessionId_key" ON "X402PaymentSession"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "X402PaymentSession_txHash_key" ON "X402PaymentSession"("txHash");

-- CreateIndex
CREATE INDEX "X402PaymentSession_invoiceId_idx" ON "X402PaymentSession"("invoiceId");

-- CreateIndex
CREATE INDEX "X402PaymentSession_sessionId_idx" ON "X402PaymentSession"("sessionId");

-- CreateIndex
CREATE INDEX "X402PaymentSession_txHash_idx" ON "X402PaymentSession"("txHash");

-- CreateIndex
CREATE INDEX "X402PaymentSession_status_idx" ON "X402PaymentSession"("status");

-- CreateIndex
CREATE INDEX "X402PaymentSession_expiresAt_idx" ON "X402PaymentSession"("expiresAt");
