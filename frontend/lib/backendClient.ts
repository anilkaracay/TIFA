const BACKEND_URL = "http://localhost:4000";

export type InvoiceStatus = "pending" | "approved" | "rejected" | "paid" | "partially_paid" | "financed" | "tokenized";

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
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch invoices");
    return res.json();
}

export async function fetchInvoiceDetail(id: string): Promise<InvoiceDetail> {
    const res = await fetch(`${BACKEND_URL} /invoices/${id} `, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch invoice detail");
    return res.json();
}

export async function recordPayment(id: string, payload: { amount: string; currency: string; paidAt: string }) {
    const res = await fetch(`${BACKEND_URL} /invoices/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to record payment");
    return res.json();
}

export async function fetchInvoices(params?: { status?: string; companyId?: string }) {
    // Use URL constructor for safer query param handling
    const url = new URL("/invoices", BACKEND_URL);
    if (params?.status) url.searchParams.set("status", params.status);
    if (params?.companyId) url.searchParams.set("companyId", params.companyId);

    try {
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to fetch invoices: ${res.statusText}`);
        const data = await res.json();
        return data as Invoice[];
    } catch (err) {
        console.error("Fetch error:", err);
        return []; // Return empty on error to avoid crashing UI immediately, or rethrow handled by SWR
    }
}

export async function tokenizeInvoice(id: string) {
    const res = await fetch(`${BACKEND_URL}/invoices/${id}/tokenize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Failed to tokenize invoice: ${res.statusText}`);
    }
    return res.json();
}

export async function requestFinancing(id: string) {
    const res = await fetch(`${BACKEND_URL}/invoices/${id}/finance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // optional amount
    });
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Failed to request financing: ${res.statusText}`);
    }
    return res.json();
}

export async function createInvoice(data: any) {
    const res = await fetch(`${BACKEND_URL}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Failed to create invoice: ${res.statusText}`);
    }
    return res.json();
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
        cache: "no-store"
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

export async function depositLiquidity(amount: string): Promise<{ success: boolean; txHash: string; lpShares: string }> {
    const res = await fetch(`${BACKEND_URL}/lp/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Deposit failed");
    }
    return res.json();
}

export async function withdrawLiquidity(lpShares: string): Promise<{ success: boolean; txHash: string }> {
    const res = await fetch(`${BACKEND_URL}/lp/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lpShares }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Withdraw failed");
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
