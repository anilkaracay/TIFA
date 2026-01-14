

export type AgentDecision = {
    id: string;
    invoiceId?: string | null;
    invoiceExternalId?: string | null;
    invoiceOnChainId?: string | null;
    actionType: string;
    previousStatus?: string | null;
    nextStatus?: string | null;
    riskScore?: number | null;
    txHash?: string | null;
    message?: string | null;
    createdAt: string;
};

export async function fetchAgentDecisions(limit = 50): Promise<AgentDecision[]> {
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
    const url = new URL("/agent/decisions", BACKEND_URL);
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
        throw new Error(`Failed to fetch agent decisions: ${res.statusText}`);
    }
    return res.json();
}
