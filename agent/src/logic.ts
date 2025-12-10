import { differenceInDays } from "date-fns";
import { SubgraphInvoice } from "./subgraphClient";

export function daysOverdue(dueDate: string | number): number {
    const now = new Date();
    // Subgraph timestamps are seconds, but dueDate usually passed as seconds if strict
    // However, the Subgraph schema defined dueDate as BigInt (uint256). 
    // If we store it as seconds (standard EVM), we multiply by 1000.
    // Let's assume input from subgraph is stringified seconds.
    const d = new Date(Number(dueDate) * 1000);
    return differenceInDays(now, d);
}

// Compute a 0-100 risk score
export function computeRiskScore(inv: SubgraphInvoice): number {
    const amount = BigInt(inv.amount);
    const paid = BigInt(inv.cumulativePaid);
    const overdue = daysOverdue(inv.dueDate);

    let score = 0;

    // Overdue — huge risk factor
    if (overdue > 0) {
        score += Math.min(60, overdue * 5); // 5 points per day, max 60
    }

    // Partial payment — reduces risk
    if (amount > 0n && paid > amount / 2n) {
        score -= 10;
    }

    // Value risk (High value = higher exposure, simple heuristic)
    // E.g. > 1000 tokens (assuming 18 decimals, 1000 * 1e18)
    const highValueThreshold = 1000n * 10n ** 18n;
    if (amount > highValueThreshold) {
        score += 10;
    }

    // Cap between 0 and 100
    return Math.max(0, Math.min(score, 100));
}

export function determineAction(inv: SubgraphInvoice): {
    nextStatus?: string;
    shouldFinance?: boolean;
} {
    const overdue = daysOverdue(inv.dueDate);
    const amount = BigInt(inv.amount);
    const paid = BigInt(inv.cumulativePaid);

    // Status transitions
    // If subgraph says PAID, we don't need to do anything (unless we want to verify)
    // But usually we just react to non-PAID states.

    if (inv.status === 'PAID') return {};

    if (overdue > 30) {
        // Late > 30 days -> Default
        if (inv.status !== 'DEFAULTED') {
            return { nextStatus: "DEFAULTED" };
        }
    } else if (paid > 0n && paid < amount) {
        if (inv.status !== 'PARTIALLY_PAID' && inv.status !== 'DEFAULTED') {
            return { nextStatus: "PARTIALLY_PAID" };
        }
    } else if (paid >= amount) {
        if (inv.status !== 'PAID') {
            return { nextStatus: "PAID" };
        }
    }

    // Financing Logic
    // Auto-finance if:
    // 1. Status is TOKENIZED (ready)
    // 2. Not already financed
    // 3. Not overdue
    // 4. (Optional) Risk score < 50
    if (inv.status === "TOKENIZED" && !inv.isFinanced && overdue <= 0) {
        const risk = computeRiskScore(inv);
        if (risk < 50) {
            return { shouldFinance: true };
        }
    }

    return {};
}
