// Aggregation logic for AI Lifecycle Intelligence

import {
  Invoice,
  AgentDecision,
  PoolState,
  UtilizationPoint,
  LifecycleMetrics,
  RiskMetrics,
  FinancingMetrics,
  PoolStressMetrics,
  DecisionVelocityMetrics,
  InvoiceStatus,
  AgentActionType,
  AILifecycleData,
} from "./ai-analytics-types";

export type { AILifecycleData };

/**
 * Compute risk score from invoice data (fallback when agent decision doesn't have it)
 */
function computeRiskScore(invoice: Invoice): number {
  let score = 0;

  // Overdue factor
  if (invoice.dueDate) {
    const now = Date.now() / 1000;
    const overdueDays = Math.max(0, (now - invoice.dueDate) / (24 * 60 * 60));
    score += Math.min(60, overdueDays * 5); // Max 60 points for overdue
  }

  // Partial payment factor (reduces risk)
  if (invoice.repaidAmount && invoice.principal > 0) {
    const paidRatio = invoice.repaidAmount / invoice.principal;
    if (paidRatio > 0.5) {
      score -= 10; // More than 50% paid reduces risk
    }
  }

  // High value factor
  const highValueThreshold = 1000000; // Adjust based on your scale
  if (invoice.principal > highValueThreshold) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * A) Lifecycle Flow Metrics
 */
export function computeLifecycleMetrics(
  invoices: Invoice[],
  _decisions: AgentDecision[]
): LifecycleMetrics {
  const statusCounts: Record<string, number> = {};
  const statusTimestamps: Record<string, number[]> = {};

  invoices.forEach((inv) => {
    const status = inv.status.toUpperCase();
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    // Track timestamps for this status
    if (!statusTimestamps[status]) {
      statusTimestamps[status] = [];
    }
    statusTimestamps[status].push(inv.updatedAt || inv.createdAt);
  });

  // Calculate average time in current state
  const avgTimeInState: Record<string, number> = {};
  Object.keys(statusCounts).forEach((status) => {
    const timestamps = statusTimestamps[status] || [];
    if (timestamps.length > 0) {
      const now = Date.now() / 1000;
      const avgAge = timestamps.reduce((sum, ts) => sum + (now - ts), 0) / timestamps.length;
      avgTimeInState[status] = avgAge / (24 * 60 * 60); // Convert to days
    }
  });

  // Identify bottlenecks
  const bottlenecks: Array<{ label: string; count: number; threshold: number }> = [];

  // Tokenized older than 7 days without financing
  const tokenizedStuck = invoices.filter((inv) => {
    if (inv.status.toUpperCase() !== "TOKENIZED") return false;
    const age = (Date.now() / 1000 - (inv.updatedAt || inv.createdAt)) / (24 * 60 * 60);
    return age > 7 && !inv.financedAmount;
  });
  if (tokenizedStuck.length > 0) {
    bottlenecks.push({
      label: "Tokenized >7d without financing",
      count: tokenizedStuck.length,
      threshold: 7,
    });
  }

  // Financed older than 90 days without repayment
  const financedStuck = invoices.filter((inv) => {
    if (inv.status.toUpperCase() !== "FINANCED") return false;
    const age = (Date.now() / 1000 - (inv.updatedAt || inv.createdAt)) / (24 * 60 * 60);
    return age > 90 && (!inv.repaidAmount || inv.repaidAmount < inv.principal * 0.1);
  });
  if (financedStuck.length > 0) {
    bottlenecks.push({
      label: "Financed >90d without repayment",
      count: financedStuck.length,
      threshold: 90,
    });
  }

  return {
    statusCounts,
    avgTimeInState,
    bottlenecks,
    totalActive: invoices.length,
  };
}

/**
 * B) Risk Landscape Metrics
 */
export function computeRiskMetrics(
  invoices: Invoice[],
  decisions: AgentDecision[]
): RiskMetrics {
  // Map decisions to invoices by invoiceId
  const decisionMap = new Map<string, AgentDecision>();
  decisions.forEach((d) => {
    if (d.invoiceId && (!decisionMap.has(d.invoiceId) || d.ts > decisionMap.get(d.invoiceId)!.ts)) {
      decisionMap.set(d.invoiceId, d);
    }
  });

  // Calculate risk scores
  const invoicesWithRisk: Array<{ invoiceId: string; riskScore: number; status: InvoiceStatus }> = [];
  let totalRisk = 0;
  let countWithRisk = 0;

  invoices.forEach((inv) => {
    const decision = decisionMap.get(inv.invoiceId);
    const riskScore = decision?.riskScore ?? computeRiskScore(inv);

    invoicesWithRisk.push({
      invoiceId: inv.invoiceId,
      riskScore,
      status: inv.status,
    });

    totalRisk += riskScore;
    countWithRisk++;
  });

  const avgRiskScore = countWithRisk > 0 ? totalRisk / countWithRisk : 0;

  // Bucket by risk level
  const buckets = { low: 0, medium: 0, high: 0 };
  invoicesWithRisk.forEach((inv) => {
    if (inv.riskScore <= 30) buckets.low++;
    else if (inv.riskScore <= 50) buckets.medium++;
    else buckets.high++;
  });

  // Count blocked actions in last 24h
  const last24h = Date.now() / 1000 - 24 * 60 * 60;
  const blockedActions24h = decisions.filter(
    (d) =>
      (d.actionType === "FINANCE_BLOCKED" || d.actionType === "SAFETY_BLOCKED") &&
      d.ts >= last24h
  ).length;

  return {
    buckets,
    avgRiskScore,
    blockedActions24h,
    invoicesWithRisk,
  };
}

/**
 * C) Financing Intelligence Metrics
 */
export function computeFinancingMetrics(decisions: AgentDecision[]): FinancingMetrics {
  const last24h = Date.now() / 1000 - 24 * 60 * 60;
  const recentDecisions = decisions.filter((d) => d.ts >= last24h);

  const decisions24h: Record<AgentActionType, number> = {
    STATUS_UPDATE: 0,
    FINANCE: 0,
    FINANCE_BLOCKED: 0,
    SAFETY_BLOCKED: 0,
    FINANCE_FAILED: 0,
  };

  recentDecisions.forEach((d) => {
    const actionType = d.actionType as AgentActionType;
    if (decisions24h.hasOwnProperty(actionType)) {
      decisions24h[actionType]++;
    }
  });

  const autoFinancedCount = decisions24h.FINANCE;
  const blockedByLiquidity = recentDecisions.filter(
    (d) =>
      d.actionType === "FINANCE_BLOCKED" &&
      (d.reason?.toLowerCase().includes("liquidity") ||
        d.message?.toLowerCase().includes("liquidity"))
  ).length;

  const blockedBySafety = recentDecisions.filter(
    (d) =>
      (d.actionType === "FINANCE_BLOCKED" || d.actionType === "SAFETY_BLOCKED") &&
      (d.reason?.toLowerCase().includes("utilization") ||
        d.reason?.toLowerCase().includes("exposure") ||
        d.reason?.toLowerCase().includes("max loan") ||
        d.message?.toLowerCase().includes("utilization") ||
        d.message?.toLowerCase().includes("exposure"))
  ).length;

  // Calculate avg LTV if we have the data (would need to parse from decisions or invoices)
  // For now, return undefined
  const avgLTV = undefined;

  return {
    decisions24h,
    autoFinancedCount,
    blockedByLiquidity,
    blockedBySafety,
    avgLTV,
  };
}

/**
 * D) Pool Stress & Protection Metrics
 */
export function computePoolStressMetrics(
  poolState: PoolState,
  decisions: AgentDecision[],
  utilizationSeries: UtilizationPoint[]
): PoolStressMetrics {
  const currentUtilization = poolState.utilizationPct;

  // Max utilization in last 60 minutes
  const last60min = Date.now() / 1000 - 60 * 60;
  const recentPoints = utilizationSeries.filter((p) => p.timestamp >= last60min);
  const maxUtilization60min =
    recentPoints.length > 0
      ? Math.max(...recentPoints.map((p) => p.value))
      : currentUtilization;

  // Blocked transactions in last 24h
  const last24h = Date.now() / 1000 - 24 * 60 * 60;
  const blockedTx24h = decisions.filter(
    (d) =>
      (d.actionType === "FINANCE_BLOCKED" || d.actionType === "SAFETY_BLOCKED") &&
      d.ts >= last24h
  ).length;

  const protectionActive =
    currentUtilization >= (poolState.utilizationLimitPct || 75) ||
    poolState.paused ||
    currentUtilization >= (poolState.maxUtilizationPct || 80);

  return {
    currentUtilization,
    maxUtilization60min,
    blockedTx24h,
    defaultBuffer: poolState.nav ? poolState.nav / poolState.totalBorrowed : undefined,
    maxIssuerExposure: poolState.maxIssuerExposure,
    protectionActive,
    utilizationSeries,
  };
}

/**
 * E) Decision Velocity Metrics
 */
export function computeDecisionVelocityMetrics(
  decisions: AgentDecision[],
  activeAgents: number = 0
): DecisionVelocityMetrics {
  const last30min = Date.now() / 1000 - 30 * 60;
  const recentDecisions = decisions.filter((d) => d.ts >= last30min);

  // Group by minute
  const decisionsPerMinute: Array<{ minute: number; count: number }> = [];
  const minuteMap = new Map<number, number>();

  recentDecisions.forEach((d) => {
    const minute = Math.floor(d.ts / 60) * 60; // Round to minute
    minuteMap.set(minute, (minuteMap.get(minute) || 0) + 1);
  });

  minuteMap.forEach((count, minute) => {
    decisionsPerMinute.push({ minute, count });
  });

  // Sort by minute
  decisionsPerMinute.sort((a, b) => a.minute - b.minute);

  // Count unique agents if we have agentName
  const uniqueAgents = new Set<string>();
  recentDecisions.forEach((d) => {
    if (d.agentName) uniqueAgents.add(d.agentName);
  });
  const actualActiveAgents = uniqueAgents.size > 0 ? uniqueAgents.size : activeAgents;

  return {
    decisionsPerMinute,
    avgEvaluationTime: undefined, // Not available in current data
    signalsProcessed: recentDecisions.length,
    activeAgents: actualActiveAgents,
  };
}

/**
 * Main aggregation function
 */
export function aggregateAILifecycleData(
  invoices: Invoice[],
  decisions: AgentDecision[],
  poolState: PoolState,
  utilizationSeries: UtilizationPoint[],
  activeAgents: number = 0
): AILifecycleData {
  return {
    invoices,
    decisions,
    poolState,
    utilizationSeries,
    lifecycle: computeLifecycleMetrics(invoices, decisions),
    risk: computeRiskMetrics(invoices, decisions),
    financing: computeFinancingMetrics(decisions),
    poolStress: computePoolStressMetrics(poolState, decisions, utilizationSeries),
    decisionVelocity: computeDecisionVelocityMetrics(decisions, activeAgents),
  };
}

