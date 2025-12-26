// Data fetching functions for AI Lifecycle Intelligence

import { Invoice, AgentDecision, PoolState } from "./ai-analytics-types";
import { Invoice as BackendInvoice } from "./backendClient";

const BACKEND_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

/**
 * Fetch active invoices and normalize to AI analytics format
 */
export async function fetchActiveInvoices(): Promise<Invoice[]> {
  try {
    const res = await fetch(`${BACKEND_BASE}/invoices?limit=200`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch invoices");
    const data: BackendInvoice[] = await res.json();

    return data.map((inv): Invoice => {
      // Parse amounts (assuming they're in cents/wei, convert to number)
      const principal = parseFloat(inv.amount || "0");
      const financedAmount = inv.usedCredit ? parseFloat(inv.usedCredit) : undefined;
      const repaidAmount = inv.cumulativePaid ? parseFloat(inv.cumulativePaid) : undefined;

      // Normalize status
      let status = inv.status?.toUpperCase() || "ISSUED";

      // Map backend 'PAID' to frontend 'REPAID'
      if (status === "PAID") {
        status = "REPAID";
      }

      // Map 'PARTIALLY_PAID' to 'FINANCED'
      if (status === "PARTIALLY_PAID") {
        status = "FINANCED";
      }

      // Map pending/approved to ISSUED
      if (status === "PENDING" || status === "APPROVED") {
        status = "ISSUED";
      }

      // Auto-detect REPAID status if fully repaid (math override)
      if (repaidAmount !== undefined && principal > 0) {
        if (repaidAmount >= principal - 0.01) {
          status = "REPAID";
        }
      }

      // Parse timestamps
      const createdAt = inv.createdAt ? new Date(inv.createdAt).getTime() / 1000 : Date.now() / 1000;
      const updatedAt = inv.updatedAt ? new Date(inv.updatedAt).getTime() / 1000 : undefined;
      const dueDate = inv.dueDate ? new Date(inv.dueDate).getTime() / 1000 : undefined;

      return {
        id: inv.id,
        invoiceId: inv.externalId || inv.id,
        issuer: inv.companyId || "",
        status: status as any,
        principal,
        financedAmount,
        repaidAmount,
        createdAt,
        dueDate,
        updatedAt,
      };
    });
  } catch (error) {
    console.error("[AI Analytics] Failed to fetch invoices:", error);
    return [];
  }
}

/**
 * Fetch agent decisions
 */
export async function fetchAgentDecisions(limit: number = 200): Promise<AgentDecision[]> {
  try {
    const res = await fetch(`${BACKEND_BASE}/agent/decisions?limit=${limit}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch agent decisions");
    const data = await res.json();

    return data.map((d: any): AgentDecision => {
      const ts = d.createdAt
        ? new Date(d.createdAt).getTime() / 1000
        : Date.now() / 1000;

      return {
        id: d.id,
        ts,
        actionType: d.actionType || "STATUS_UPDATE",
        invoiceId: d.invoiceExternalId || d.invoiceId || "",
        riskScore: d.riskScore ?? undefined,
        message: d.message,
        reason: d.reason,
        txHash: d.txHash,
        agentName: d.agentName,
        createdAt: d.createdAt,
      };
    });
  } catch (error) {
    console.error("[AI Analytics] Failed to fetch agent decisions:", error);
    return [];
  }
}

/**
 * Fetch pool state and normalize
 */
export async function fetchPoolState(): Promise<PoolState> {
  try {
    const res = await fetch(`${BACKEND_BASE}/pool/overview`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch pool state");
    const data = await res.json();

    const totalLiquidity = parseFloat(data.totalLiquidity || "0");
    const totalBorrowed = parseFloat(data.totalBorrowed || "0");
    const availableLiquidity = parseFloat(data.availableLiquidity || "0");
    const utilizationPct = parseFloat(data.utilizationPercent || data.utilization || "0");
    const nav = data.nav ? parseFloat(data.nav) : undefined;
    const maxUtilizationPct = data.maxUtilizationPercent
      ? parseFloat(data.maxUtilizationPercent)
      : 80;

    // Try to get limits
    let utilizationLimitPct = 75;
    let maxSingleLoan: number | undefined;
    let maxIssuerExposure: number | undefined;

    try {
      const limitsRes = await fetch(`${BACKEND_BASE}/pool/limits`, {
        cache: "no-store",
      });
      if (limitsRes.ok) {
        const limits = await limitsRes.json();
        utilizationLimitPct = limits.utilizationLimitPct || 75;
        maxSingleLoan = limits.maxSingleLoan ? parseFloat(limits.maxSingleLoan) : undefined;
        maxIssuerExposure = limits.maxIssuerExposure ? parseFloat(limits.maxIssuerExposure) : undefined;
      }
    } catch (e) {
      // Limits endpoint is failing (500 error) - silently use defaults
      // This is expected if backend pool/limits endpoint is not implemented yet
    }

    return {
      totalLiquidity,
      totalBorrowed,
      availableLiquidity,
      utilizationPct,
      paused: false, // Check if pool is paused (might need separate endpoint)
      nav,
      maxUtilizationPct,
      utilizationLimitPct,
      maxSingleLoan,
      maxIssuerExposure,
    };
  } catch (error) {
    console.error("[AI Analytics] Failed to fetch pool state:", error);
    // Return default state
    return {
      totalLiquidity: 0,
      totalBorrowed: 0,
      availableLiquidity: 0,
      utilizationPct: 0,
      paused: false,
      maxUtilizationPct: 80,
      utilizationLimitPct: 75,
    };
  }
}

