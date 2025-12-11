import { env } from "./env";

export async function logAgentDecision(payload: {
    invoiceId?: string;
    invoiceExternalId?: string;
    invoiceOnChainId?: string;
    actionType: string;
    previousStatus?: string;
    nextStatus?: string;
    riskScore?: number;
    txHash?: string;
    message?: string;
}) {
    try {
        const response = await fetch(`${env.BACKEND_URL}/agent/decisions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Failed to log decision: ${response.statusText}`);
        }
    } catch (err) {
        console.error("[Agent] Failed to log decision", err);
    }
}
