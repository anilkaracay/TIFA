import { getChainId } from '@wagmi/core';
import { config } from './wagmi';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:4000";


function getAuthHeaders(walletAddress?: string): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (walletAddress) {
        headers['x-wallet-address'] = walletAddress;
    }
    try {
        const chainId = getChainId(config as any);
        if (chainId) {
            headers['x-chain-id'] = chainId.toString();
        }
    } catch (e) {
        console.warn("Failed to get chain ID for headers", e);
    }
    return headers;
}

// Role-related types
export interface UserRoleResponse {
    wallet: string;
    role: string;
    isAdmin: boolean;
    readOnly: boolean;
}

export async function fetchUserRole(walletAddress: string): Promise<UserRoleResponse> {
    const res = await fetch(`${BACKEND_URL}/admin/status?wallet=${walletAddress}`, {
        cache: 'no-store',
    });
    if (!res.ok) {
        throw new Error('Failed to fetch user role');
    }
    return res.json();
}

export type InvoiceStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID" | "PARTIALLY_PAID" | "FINANCED" | "TOKENIZED" | "DEFAULTED" | "ISSUED";

// Compliance types
export interface KycProfile {
    id: string;
    status: 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW';
    legalName?: string;
    rejectionReason?: string;
}

export interface YieldSummary {
    accruedYield: string;
    claimedYield: string;
    heldYield: string;
}

// Compliance types
export interface KycProfile {
    id: string;
    status: 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW';
    legalName?: string;
    rejectionReason?: string;
}

export interface YieldSummary {
    accruedYield: string;
    claimedYield: string;
    heldYield: string;
}

export interface Invoice {
    id: string;
    externalId: string;
    companyId: string;
    debtorId: string;
    currency: string;
    amount: string;
    dueDate: string;
    status: InvoiceStatus;
    isFinanced: boolean;
    cumulativePaid: string;
    tokenId?: string;
    invoiceIdOnChain?: string;
    createdAt: string;
    updatedAt: string;
    usedCredit?: string; // Debt amount in cents
    maxCreditLine?: string; // Max credit line in cents
    riskScore?: number;
}

export type InvoicePayment = {
    id: string;
    amount: string;
    currency: string;
    paidAt: string;
    psp?: string | null;
};

export type InvoiceDetail = Invoice & {
    payments: InvoicePayment[];
    invoiceIdOnChain?: string | null;
    tokenId?: string | null;
    tokenAddress?: string | null;
};

export async function fetchInvoicesForCompany(companyId: string): Promise<Invoice[]> {
    // If companyId is 'all', we might want to fetch all, or just let backend handle it
    const url = new URL("/invoices", BACKEND_URL);
    if (companyId && companyId !== 'all') {
        url.searchParams.set("companyId", companyId);
    }
    const res = await fetch(url.toString(), { next: { revalidate: 3 } });
    if (!res.ok) throw new Error("Failed to fetch invoices");
    return res.json();
}

export async function fetchInvoiceDetail(id: string): Promise<InvoiceDetail> {
    const res = await fetch(`${BACKEND_URL}/invoices/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch invoice detail");
    return res.json();
}

export async function recordPayment(id: string, payload: { amount: string; currency: string; paidAt: string; psp?: string; transactionId?: string }, walletAddress?: string) {
    const headers = getAuthHeaders(walletAddress);
    const res = await fetch(`${BACKEND_URL}/invoices/${id}/payments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            transactionId: payload.transactionId || `TXN-${Date.now()}`,
            amount: payload.amount,
            currency: payload.currency,
            paidAt: payload.paidAt,
            psp: payload.psp,
        }),
    });
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || errBody.message || "Failed to record payment");
    }
    return res.json();
}

export async function payRecourse(id: string, payload: { amount: string; currency?: string; paidAt?: string; txHash?: string }, walletAddress?: string) {
    const headers = getAuthHeaders(walletAddress);
    const res = await fetch(`${BACKEND_URL}/invoices/${id}/recourse-payment`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            amount: payload.amount,
            currency: payload.currency || 'MNT',
            paidAt: payload.paidAt || new Date().toISOString(),
            txHash: payload.txHash,
        }),
    });
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || errBody.message || "Failed to pay recourse");
    }
    return res.json();
}

export async function declareDefault(id: string, payload: { reason?: string; lossAmount?: string }, walletAddress?: string) {
    const headers = getAuthHeaders(walletAddress);
    const res = await fetch(`${BACKEND_URL}/invoices/${id}/declare-default`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || errBody.message || "Failed to declare default");
    }
    return res.json();
}

export async function notifyRepayment(id: string, payload: { txHash: string; amount?: string }, walletAddress?: string) {
    const headers = getAuthHeaders(walletAddress);
    const res = await fetch(`${BACKEND_URL}/invoices/${id}/repay-notification`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || errBody.message || "Failed to notify repayment");
    }
    return res.json();
}

export async function fetchInvoices(params?: { status?: string; companyId?: string }) {
    // Use URL constructor for safer query param handling
    const url = new URL("/invoices", BACKEND_URL);
    if (params?.status) url.searchParams.set("status", params.status);
    if (params?.companyId) url.searchParams.set("companyId", params.companyId);

    try {
        const res = await fetch(url.toString(), { next: { revalidate: 3 } });
        if (!res.ok) throw new Error(`Failed to fetch invoices: ${res.statusText}`);
        const data = await res.json();
        return data as Invoice[];
    } catch (err) {
        console.error("Fetch error:", err);
        return []; // Return empty on error to avoid crashing UI immediately, or rethrow handled by SWR
    }
}

export async function tokenizeInvoice(id: string, walletAddress?: string) {
    const headers = getAuthHeaders(walletAddress);
    const res = await fetch(`${BACKEND_URL}/invoices/${id}/tokenize`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
    });
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || errBody.message || `Failed to tokenize invoice: ${res.statusText}`);
    }
    return res.json();
}

export async function requestFinancing(id: string, walletAddress?: string, txHash?: string, amount?: string) {
    const headers = getAuthHeaders(walletAddress);
    const body: any = {};
    if (txHash) {
        body.txHash = txHash;
    }
    if (amount) {
        body.amount = amount;
    }
    const res = await fetch(`${BACKEND_URL}/invoices/${id}/finance`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || errBody.message || `Failed to request financing: ${res.statusText}`);
    }
    return res.json();
}

export async function createInvoice(data: any, walletAddress?: string) {
    const headers = getAuthHeaders(walletAddress);

    const url = `${BACKEND_URL}/invoices`;
    console.log('[createInvoice] Request:', {
        url,
        method: 'POST',
        headers,
        body: data
    });

    try {
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(data),
        });

        console.log('[createInvoice] Response:', {
            status: res.status,
            statusText: res.statusText,
            ok: res.ok,
            url: res.url
        });

        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            const errorMsg = errBody.error || errBody.message || `Failed to create invoice: ${res.statusText}`;
            console.error('[createInvoice] Error:', {
                status: res.status,
                statusText: res.statusText,
                url,
                error: errBody,
                walletAddress,
                requestBody: data
            });
            throw new Error(errorMsg);
        }
        return res.json();
    } catch (e: any) {
        console.error('[createInvoice] Fetch error:', e);
        throw e;
    }
}

export interface PoolOverview {
    totalLiquidity: string;
    totalBorrowed: string;
    totalPrincipalOutstanding: string;
    totalInterestAccrued: string;
    totalLosses: string;
    protocolFeesAccrued: string;
    availableLiquidity: string;
    utilization: string;
    utilizationPercent: string;
    maxUtilization: string;
    maxUtilizationPercent: string;
    lpTokenSupply: string;
    nav: string;
    lpSharePrice: string;
    borrowAprWad: string;
    protocolFeeBps: string;
    poolStartTime: string;
    apr: string;
    apy: string;
    totalLiquidityFormatted: string;
    totalBorrowedFormatted: string;
    totalPrincipalOutstandingFormatted: string;
    totalInterestAccruedFormatted: string;
    totalLossesFormatted: string;
    protocolFeesAccruedFormatted: string;
    availableLiquidityFormatted: string;
    lpTokenSupplyFormatted: string;
    navFormatted: string;
    lpSharePriceFormatted: string;
}

export interface PoolMetrics {
    nav: string;
    navFormatted: string;
    sharePriceWad: string;
    sharePriceFormatted: string;
    totalPrincipalOutstanding: string;
    totalPrincipalOutstandingFormatted: string;
    totalInterestAccrued: string;
    totalInterestAccruedFormatted: string;
    totalLosses: string;
    totalLossesFormatted: string;
    protocolFeesAccrued: string;
    protocolFeesAccruedFormatted: string;
    utilization: string;
    utilizationPercent: string;
    apr: string;
    apy: string;
    borrowApr: string;
    protocolFeePercent: string;
    poolStartTime: string;
    poolAgeDays: string;
}

export interface PoolLimits {
    paused: boolean;
    utilization: number;
    utilizationPercent: number;
    maxUtilization: number;
    maxUtilizationPercent: number;
    nav: string;
    navFormatted: string;
    maxSingleLoan: string;
    maxSingleLoanFormatted: string;
    maxSingleLoanBps: number;
    maxIssuerExposure: string;
    maxIssuerExposureFormatted: string;
    maxIssuerExposureBps: number;
    totalLiquidity: string;
    totalBorrowed: string;
}

export interface IssuerExposure {
    issuer: string;
    currentExposure: string;
    currentExposureFormatted: string;
    maxAllowed: string;
    maxAllowedFormatted: string;
    maxAllowedBps: number;
    utilizationPercent: number;
    remainingCapacity: string;
    remainingCapacityFormatted: string;
}

export async function fetchPoolLimits(): Promise<PoolLimits> {
    const res = await fetch(`${BACKEND_URL}/pool/limits`, {
        next: { revalidate: 3 }
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch pool limits");
    }
    return res.json();
}

export async function fetchIssuerExposure(issuerAddress: string): Promise<IssuerExposure> {
    const res = await fetch(`${BACKEND_URL}/pool/issuer/${issuerAddress}/exposure`, {
        cache: "no-store"
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch issuer exposure");
    }
    return res.json();
}

// Truth Service Types
export interface PoolTruthSnapshot {
    blockNumber: number;
    timestamp: number;
    nav: string;
    sharePriceWad: string;
    utilizationBps: number;
    totalPrincipalOutstanding: string;
    totalInterestAccrued: string;
    totalLosses: string;
    reserveBalance?: string;
    protocolFeesAccrued?: string;
    totalLiquidity: string;
    totalBorrowed: string;
}

export interface PoolIndexedSnapshot extends PoolTruthSnapshot {
    indexedBlockNumber: number;
    indexedAt: number;
    subgraphLagBlocks: number;
}

export interface TruthMismatch {
    field: string;
    onchain: string | number;
    indexed: string | number;
    diff: string | number;
}

// Risk Exposure Types
export interface RiskSnapshot {
    asOf: string;
    overall: {
        score: number;
        label: "Low" | "Medium" | "Elevated";
        trend: "up" | "down" | "stable";
        confidence: number;
    };
    sectors: Array<{
        name: string;
        allocationPct: number;
        riskMultiplier: number;
        drivers: string[];
        delta7d?: {
            allocationPct: number;
            riskMultiplier: number;
        };
    }>;
    structure: {
        recoursePct: number;
        nonRecoursePct: number;
        aiPreference?: "recourse" | "non-recourse" | null;
        delta7d?: {
            recoursePct: number;
            nonRecoursePct: number;
        };
    };
    stress: {
        defaultBuffer: {
            value: number;
            status: "safe" | "watch" | "critical";
            thresholds: { watch: number; critical: number };
            series: number[];
        };
        avgTenorDays: {
            value: number;
            status: "safe" | "watch" | "critical";
            thresholds: { watch: number; critical: number };
            series: number[];
        };
        top5Concentration: {
            value: number;
            status: "safe" | "watch" | "critical";
            thresholds: { watch: number; critical: number };
            series: number[];
        };
        overdueRate: {
            value: number;
            status: "safe" | "watch" | "critical";
            thresholds: { watch: number; critical: number };
            series: number[];
        };
    };
    observations: Array<{
        id: string;
        severity: "info" | "watch" | "alert";
        text: string;
        ts: string;
    }>;
    driversTop: string[];
}

export interface RiskHistory {
    points: Array<{
        ts: string;
        overallScore: number;
        sectorAllocations: Record<string, number>;
    }>;
    sectorChanges: Array<{
        name: string;
        allocationDelta: number;
        multiplierDelta: number;
    }>;
}

export interface RiskProjection {
    projectedPoints: Array<{
        ts: string;
        score: number;
    }>;
    assumptions: string[];
    explainability: string[];
}

export interface ReconciledPoolTruth {
    modeUsed: 'reconciled' | 'onchain-only' | 'subgraph-only';
    onchain: PoolTruthSnapshot;
    indexed?: PoolIndexedSnapshot;
    mismatches: TruthMismatch[];
    freshness: {
        subgraphLagBlocks: number;
        lastIndexedAt?: number;
        lastOnchainBlock: number;
    };
}

export interface InvoiceTruth {
    onchain: {
        exists: boolean;
        usedCredit: string;
        interestAccrued: string;
        maxCreditLine: string;
        isInDefault: boolean;
        recourseMode: number;
        dueDate: string;
    } | null;
    db: {
        id: string;
        externalId: string;
        status: string;
        isFinanced: boolean;
        amount: string;
        cumulativePaid: string;
    };
    dbOutOfSync: boolean;
    note?: string;
}

export interface LPPositionTruth {
    wallet: string;
    lpShares: string;
    underlyingValue: string;
    sharePriceWad: string;
    nav: string;
    computedFrom: string;
    note: string;
}

export interface PoolYieldTruth {
    windowDays: number;
    windowStartTimestamp: number;
    windowEndTimestamp: number;
    startBlock: number;
    endBlock: number;
    lpInterestPaid: string;
    avgNav: string;
    apr: string;
    apy: string;
    method: string;
    eventCount: number;
}

export async function fetchPoolTruth(): Promise<ReconciledPoolTruth> {
    const res = await fetch(`${BACKEND_URL}/truth/pool`, {
        cache: "no-store"
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch pool truth");
    }
    return res.json();
}

export async function fetchInvoiceTruth(invoiceId: string): Promise<InvoiceTruth> {
    const res = await fetch(`${BACKEND_URL}/truth/invoice/${invoiceId}`, {
        cache: "no-store"
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch invoice truth");
    }
    return res.json();
}

export async function fetchLPPositionTruth(wallet: string): Promise<LPPositionTruth> {
    const res = await fetch(`${BACKEND_URL}/truth/lp/${wallet}`, {
        cache: "no-store"
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch LP position truth");
    }
    return res.json();
}

export async function fetchPoolYieldTruth(windowDays: number = 7): Promise<PoolYieldTruth> {
    const res = await fetch(`${BACKEND_URL}/truth/pool/yield?windowDays=${windowDays}`, {
        cache: "no-store"
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch pool yield truth");
    }
    return res.json();
}

export interface LPPosition {
    wallet: string;
    lpShares: string;
    underlyingValue: string;
    sharePrice: string;
    lpSharesFormatted: string;
    underlyingValueFormatted: string;
    sharePriceFormatted: string;
    dbShares?: string;
}

export async function fetchPoolOverview(): Promise<PoolOverview> {
    const res = await fetch(`${BACKEND_URL}/pool/overview`, {
        next: { revalidate: 3 }
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch pool overview");
    }
    return res.json();
}

export async function fetchLPPosition(wallet?: string): Promise<LPPosition> {
    const url = new URL("/lp/position", BACKEND_URL);
    if (wallet) {
        url.searchParams.set("wallet", wallet);
    }
    const res = await fetch(url.toString(), {
        cache: "no-store"
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch LP position");
    }
    const data = await res.json();
    console.log("[fetchLPPosition] Received data:", data);
    return data;
}

export async function depositLiquidity(amount: string, wallet?: string): Promise<{ success: boolean; txHash: string; lpShares: string }> {
    const res = await fetch(`${BACKEND_URL}/lp/deposit`, {
        method: "POST",
        headers: getAuthHeaders(wallet),
        body: JSON.stringify({ amount }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Deposit failed");
    }
    return res.json();
}

export async function withdrawLiquidity(lpShares: string, wallet?: string): Promise<{ success: boolean; txHash: string }> {
    const res = await fetch(`${BACKEND_URL}/lp/withdraw`, {
        method: "POST",
        headers: getAuthHeaders(wallet),
        body: JSON.stringify({ lpShares }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Withdraw failed");
    }
    return res.json();
}

export interface LPTransaction {
    id: string;
    date: string;
    type: "Deposit" | "Withdrawal" | "Reinvest";
    amount: string;
    sharePrice: string;
    balanceImpact: string;
    status: "Settled" | "Pending";
    txHash: string;
}

export interface LPTransactionsResponse {
    transactions: LPTransaction[];
    total: number;
    limit: number;
    offset: number;
}

export async function fetchLPTransactions(wallet?: string, limit = 50, offset = 0): Promise<LPTransactionsResponse> {
    const url = new URL("/lp/transactions", BACKEND_URL);
    if (wallet) {
        url.searchParams.set("wallet", wallet);
    }
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("offset", offset.toString());

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch LP transactions");
    }
    return res.json();
}

export async function fetchPoolMetrics(): Promise<PoolMetrics> {
    const res = await fetch(`${BACKEND_URL}/pool/metrics`, {
        cache: "no-store"
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch pool metrics");
    }
    return res.json();
}

export interface PortfolioAnalytics {
    kpis: {
        currentUtilization: {
            value: number;
            target: number;
            delta: number;
        };
        netYield: {
            value: number;
            benchmark: number;
            delta: number;
        };
        defaultRate: {
            value: number;
            tolerance: number;
            delta: number;
        };
        avgInvoiceDuration: {
            value: number;
            historical: number;
            delta: number;
        };
    };
    yieldComposition: {
        grossYield: number;
        netYield: number;
        benchmarkYield: number;
    };
    utilizationTrend: Array<{
        month: string;
        utilization: number;
    }>;
    durationDistribution: Array<{
        label: string;
        min: number;
        max: number;
        count: number;
    }>;
    vintageAnalysis: Array<{
        vintage: string;
        originatedVolume: number;
        outstanding: number;
        defaultRate: number;
        performance: string;
    }>;
    metadata: {
        lastUpdated: string;
        dataCutoff: string;
        fundName: string;
    };
}

export async function fetchPortfolioAnalytics(): Promise<PortfolioAnalytics> {
    const res = await fetch(`${BACKEND_URL}/analytics/portfolio`, {
        cache: "no-store"
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        const errorMessage = error.error || "Failed to fetch portfolio analytics";
        const errorDetails = error.details ? `: ${error.details}` : "";
        throw new Error(`${errorMessage}${errorDetails}`);
    }
    return res.json();
}

export interface AgentConsoleData {
    systemStatus: {
        engineStatus: string;
        activeAgents: number;
        lastEvaluation: string;
        systemLoad: number;
    };
    agents: Array<{
        id: string;
        name: string;
        scope: string;
        state: string;
        lastAction: string | Date;
        confidence: number;
        workload?: number;
        signalCount?: number;
        lastActionSummary?: string;
    }>;
    signals: Array<{
        id: string;
        timestamp: string | Date;
        sourceAgent: string;
        severity: string;
        message: string;
        context: any;
    }>;
    decisionTraces: Array<{
        id: string;
        timestamp: string | Date;
        reasoningPipeline?: Array<{
            step: string;
            label: string;
            content: any;
        }>;
        inputs: any;
        signals: any[];
        evaluation: any;
        recommendation: any;
    }>;
    recommendations: Array<{
        id: string;
        timestamp: string | Date;
        type: string;
        summary: string;
        reasoning: string;
        confidence: number;
        supportingSignals: any[];
        requiresApproval: boolean;
    }>;
    modelTransparency: {
        dataSources: string[];
        updateFrequency: string;
        modelClass: string;
        lastRetraining: string;
        version: string;
    };
    auditLog: {
        totalDecisions: number;
        lastUpdated: string;
        exportable: boolean;
    };
}

export async function fetchAgentConsole(): Promise<AgentConsoleData> {
    // Add timeout to prevent infinite loading
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
        const res = await fetch(`${BACKEND_URL}/agent/console`, {
            cache: "no-store",
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            const errorMessage = error.error || "Failed to fetch agent console data";
            const errorDetails = error.details ? `: ${error.details}` : "";
            throw new Error(`${errorMessage}${errorDetails}`);
        }
        return res.json();
    } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('Request timeout - please try again');
        }
        throw err;
    }
}

export interface AgentHealth {
    status: "healthy" | "paused" | "degraded";
    paused: boolean;
    lastHeartbeat: string;
    uptime: string;
    lastDecisionId: string | null;
}

export async function fetchAgentHealth(): Promise<AgentHealth> {
    const res = await fetch(`${BACKEND_URL}/agent/health`, {
        cache: "no-store"
    });
    if (!res.ok) {
        throw new Error("Failed to fetch agent health");
    }
    return res.json();
}

export interface AgentConfig {
    paused: boolean;
    riskThreshold: number;
    lastUpdated: string;
}

export async function fetchAgentConfig(): Promise<AgentConfig> {
    const res = await fetch(`${BACKEND_URL}/agent/config`, {
        cache: "no-store"
    });
    if (!res.ok) {
        throw new Error("Failed to fetch agent config");
    }
    return res.json();
}

export async function pauseAgent(walletAddress: string): Promise<{ success: boolean; paused: boolean }> {
    const res = await fetch(`${BACKEND_URL}/agent/pause`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-wallet-address": walletAddress,
        },
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to pause agent");
    }
    return res.json();
}

export async function resumeAgent(walletAddress: string): Promise<{ success: boolean; paused: boolean }> {
    const res = await fetch(`${BACKEND_URL}/agent/resume`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-wallet-address": walletAddress,
        },
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to resume agent");
    }
    return res.json();
}

export async function updateAgentConfig(
    walletAddress: string,
    config: { riskThreshold?: number; paused?: boolean }
): Promise<{ success: boolean; config: AgentConfig }> {
    const res = await fetch(`${BACKEND_URL}/agent/config`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-wallet-address": walletAddress,
        },
        body: JSON.stringify(config),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to update agent config");
    }
    return res.json();
}

export interface RiskBreakdown {
    invoiceId: string;
    invoiceExternalId: string;
    factors: Array<{
        name: string;
        impact: number;
        description: string;
    }>;
    finalScore: number;
    timestamp: string;
}

export async function fetchRiskBreakdown(invoiceId: string): Promise<RiskBreakdown> {
    const res = await fetch(`${BACKEND_URL}/agent/risk-breakdown/${invoiceId}`, {
        cache: "no-store",
    });
    if (!res.ok) {
        throw new Error("Failed to fetch risk breakdown");
    }
    return res.json();
}

export interface SystemParameters {
    riskThreshold: number;
    ltvBps: number;
    utilizationThresholdBps: number;
    maxUtilizationBps: number;
    maxLoanBpsOfTVL: number | null;
    maxIssuerExposureBps: number | null;
    lastUpdated: string;
}

export async function fetchSystemParameters(): Promise<SystemParameters> {
    const res = await fetch(`${BACKEND_URL}/agent/system-parameters`, {
        cache: "no-store",
    });
    if (!res.ok) {
        throw new Error("Failed to fetch system parameters");
    }
    return res.json();
}

export interface PredictiveIntelligence {
    horizon: string;
    invoicesAtRisk: number;
    invoicesAtRiskDetails: Array<{
        invoiceId: string;
        externalId: string;
        currentRisk: number;
        projectedRisk: number;
        reason: string;
    }>;
    poolUtilizationProjection: {
        current: number;
        projected: number;
    };
    expectedFinancings: number;
    expectedFinancingBlocks: number;
    safetyWarnings: string[];
    timestamp: string;
}

export async function fetchPredictiveIntelligence(): Promise<PredictiveIntelligence> {
    const res = await fetch(`${BACKEND_URL}/agent/predictions`, {
        cache: "no-store",
    });
    if (!res.ok) {
        throw new Error("Failed to fetch predictive intelligence");
    }
    return res.json();
}

// Risk Exposure API functions
export async function fetchRiskSnapshot(poolId?: string): Promise<RiskSnapshot> {
    try {
        const url = new URL(`${BACKEND_URL}/lp/risk/snapshot`);
        if (poolId) {
            url.searchParams.set("poolId", poolId);
        }
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `Failed to fetch risk snapshot: ${res.statusText}`);
        }
        return res.json();
    } catch (e: any) {
        throw new Error(`Failed to fetch risk snapshot: ${e.message}`);
    }
}

export async function fetchRiskHistory(poolId?: string, range: string = "7d"): Promise<RiskHistory> {
    try {
        const url = new URL(`${BACKEND_URL}/lp/risk/history`);
        if (poolId) {
            url.searchParams.set("poolId", poolId);
        }
        url.searchParams.set("range", range);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `Failed to fetch risk history: ${res.statusText}`);
        }
        return res.json();
    } catch (e: any) {
        throw new Error(`Failed to fetch risk history: ${e.message}`);
    }
}

export async function fetchRiskProjection(poolId?: string, horizon: string = "7d"): Promise<RiskProjection> {
    try {
        const url = new URL(`${BACKEND_URL}/lp/risk/projection`);
        if (poolId) {
            url.searchParams.set("poolId", poolId);
        }
        url.searchParams.set("horizon", horizon);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `Failed to fetch risk projection: ${res.statusText}`);
        }
        return res.json();
    } catch (e: any) {
        throw new Error(`Failed to fetch risk projection: ${e.message}`);
    }
}

// Compliance API
export async function fetchKycProfile(subjectType: 'LP' | 'ISSUER' = 'LP', wallet?: string): Promise<KycProfile | null> {
    try {
        const res = await fetch(`${BACKEND_URL}/compliance/kyc/me?subjectType=${subjectType}`, {
            headers: getAuthHeaders(wallet)
        } as any);
        if (!res.ok) return null;
        const data = await res.json();
        return data.profile;
    } catch { return null; }
}

function getHeadersWithWallet(wallet?: string) {
    return { headers: getAuthHeaders(wallet) };
}

export async function submitKycProfile(data: any, wallet?: string): Promise<KycProfile> {
    const headers = getAuthHeaders(wallet);
    const payload = { ...data, wallet }; // Add wallet to body
    const res = await fetch(`${BACKEND_URL}/compliance/kyc/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return json.profile;
}

export async function fetchPendingKycProfiles(wallet?: string): Promise<any[]> {
    const res = await fetch(`${BACKEND_URL}/compliance/admin/kyc`, getHeadersWithWallet(wallet));
    if (!res.ok) throw new Error("Failed to fetch profiles");
    return (await res.json()).profiles;
}

export async function approveKycProfile(id: string, wallet?: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/compliance/admin/kyc/${id}/approve`, {
        method: 'POST',
        ...getHeadersWithWallet(wallet)
    });
    if (!res.ok) throw new Error("Failed to approve");
}

export async function rejectKycProfile(id: string, reason: string, wallet?: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/compliance/admin/kyc/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(wallet) },
        body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error("Failed to reject");
}

// Yield API
export async function fetchYieldSummary(wallet?: string): Promise<YieldSummary> {
    const res = await fetch(`${BACKEND_URL}/yield/summary`, getHeadersWithWallet(wallet));
    if (!res.ok) return { accruedYield: "0", claimedYield: "0", heldYield: "0" };
    return await res.json();
}

export async function claimYield(wallet?: string): Promise<{ success: boolean; claimedAmount: string; error?: string }> {
    const res = await fetch(`${BACKEND_URL}/yield/claim`, {
        method: 'POST',
        ...getHeadersWithWallet(wallet)
    });
    const data = await res.json();
    if (!res.ok) return { success: false, claimedAmount: "0", error: data.error || data.message || "Failed" };
    return data;
}

// Custody API
export interface CustodyVault {
    vaultAddress: string;
    totalSharesCustodied: string;
    poolId: string;
}

export interface CustodyLedger {
    poolId: string;
    wallet: string;
    shareBalance: string;
    status: string;
}

export async function fetchCustodyVault(): Promise<CustodyVault> {
    const res = await fetch(`${BACKEND_URL}/custody/vault`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch vault info");
    return res.json();
}

export async function fetchCustodyLedger(wallet?: string): Promise<CustodyLedger | null> {
    const res = await fetch(`${BACKEND_URL}/custody/ledger`, getHeadersWithWallet(wallet));
    if (!res.ok) return null;
    return res.json();
}
// Force rebuild to pick up NEXT_PUBLIC_BACKEND_URL env var
