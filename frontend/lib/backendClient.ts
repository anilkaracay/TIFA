const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export type Invoice = {
    id: string;
    externalId: string;
    companyId: string;
    debtorId: string;
    currency: string;
    amount: string;
    dueDate: string;
    status: string;
    cumulativePaid: string;
    isFinanced: boolean;
    createdAt: string;
    updatedAt: string;
};

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
