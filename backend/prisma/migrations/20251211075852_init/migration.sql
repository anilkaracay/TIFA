-- CreateTable
CREATE TABLE "AgentDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT,
    "invoiceExternalId" TEXT,
    "invoiceOnChainId" TEXT,
    "actionType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "nextStatus" TEXT,
    "riskScore" INTEGER,
    "txHash" TEXT,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
