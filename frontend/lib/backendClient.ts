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
