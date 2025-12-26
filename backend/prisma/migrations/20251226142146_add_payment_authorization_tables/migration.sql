-- AlterTable
ALTER TABLE "X402PaymentSession" ADD COLUMN "authorizationId" TEXT;
ALTER TABLE "X402PaymentSession" ADD COLUMN "executionMode" TEXT;

-- CreateTable
CREATE TABLE "PaymentAuthorization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'USER_INITIATED',
    "maxAmountPerInvoice" TEXT NOT NULL,
    "dailyLimit" TEXT NOT NULL,
    "monthlyLimit" TEXT NOT NULL,
    "allowedCurrencies" TEXT NOT NULL,
    "allowedChains" TEXT NOT NULL,
    "allowedInvoiceStatuses" TEXT NOT NULL,
    "autoApproveFinancedInvoices" BOOLEAN NOT NULL DEFAULT false,
    "autoApproveTokenizedInvoices" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    CONSTRAINT "PaymentAuthorization_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentPaymentExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sessionId" TEXT,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "txHash" TEXT,
    "executionStatus" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentPaymentExecution_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "PaymentAuthorization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentPaymentExecution_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthorizationAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorizationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthorizationAuditLog_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "PaymentAuthorization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PaymentAuthorization_companyId_idx" ON "PaymentAuthorization"("companyId");

-- CreateIndex
CREATE INDEX "PaymentAuthorization_active_idx" ON "PaymentAuthorization"("active");

-- CreateIndex
CREATE INDEX "PaymentAuthorization_mode_idx" ON "PaymentAuthorization"("mode");

-- CreateIndex
CREATE INDEX "AgentPaymentExecution_authorizationId_idx" ON "AgentPaymentExecution"("authorizationId");

-- CreateIndex
CREATE INDEX "AgentPaymentExecution_invoiceId_idx" ON "AgentPaymentExecution"("invoiceId");

-- CreateIndex
CREATE INDEX "AgentPaymentExecution_executionStatus_idx" ON "AgentPaymentExecution"("executionStatus");

-- CreateIndex
CREATE INDEX "AgentPaymentExecution_createdAt_idx" ON "AgentPaymentExecution"("createdAt");

-- CreateIndex
CREATE INDEX "AgentPaymentExecution_txHash_idx" ON "AgentPaymentExecution"("txHash");

-- CreateIndex
CREATE INDEX "AuthorizationAuditLog_authorizationId_idx" ON "AuthorizationAuditLog"("authorizationId");

-- CreateIndex
CREATE INDEX "AuthorizationAuditLog_action_idx" ON "AuthorizationAuditLog"("action");

-- CreateIndex
CREATE INDEX "AuthorizationAuditLog_timestamp_idx" ON "AuthorizationAuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "X402PaymentSession_executionMode_idx" ON "X402PaymentSession"("executionMode");

-- CreateIndex
CREATE INDEX "X402PaymentSession_authorizationId_idx" ON "X402PaymentSession"("authorizationId");
