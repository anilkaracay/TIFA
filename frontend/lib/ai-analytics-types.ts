// Type definitions for AI Lifecycle Intelligence

export type InvoiceStatus = 
  | "ISSUED" | "TOKENIZED" | "FINANCED" | "REPAID" | "DEFAULTED" | "PARTIALLY_PAID" | "PAID"
  | "pending" | "approved" | "rejected" | "paid" | "partially_paid" | "financed" | "tokenized";

export interface Invoice {
  id: string;
  invoiceId: string;        // display id (externalId)
  issuer: string;
  status: InvoiceStatus;
  principal: number;
  financedAmount?: number;
  repaidAmount?: number;
  createdAt: number;        // unix seconds
  dueDate?: number;         // unix seconds
  lastPaymentAt?: number;   // unix seconds
  updatedAt?: number;       // unix seconds
}

export type AgentActionType =
  | "STATUS_UPDATE"
  | "FINANCE"
  | "FINANCE_BLOCKED"
  | "SAFETY_BLOCKED"
  | "FINANCE_FAILED";

export interface AgentDecision {
  id: string;
  ts: number;               // unix seconds
  actionType: AgentActionType;
  invoiceId: string;
  riskScore?: number;
  message?: string;
  reason?: string;
  txHash?: string;
  agentName?: string;
  createdAt?: string;       // ISO string (from backend)
}

export interface PoolState {
  totalLiquidity: number;
  totalBorrowed: number;
  availableLiquidity: number;
  utilizationPct: number;        // 0-100
  paused: boolean;
  nav?: number;
  maxUtilizationPct?: number;    // 80
  utilizationLimitPct?: number;  // 75
  maxSingleLoan?: number;
  maxIssuerExposure?: number;
}

export interface UtilizationPoint {
  timestamp: number;  // unix seconds
  value: number;      // 0-100
}

export interface LifecycleMetrics {
  statusCounts: Record<string, number>;
  avgTimeInState: Record<string, number>;  // days
  bottlenecks: Array<{
    label: string;
    count: number;
    threshold: number;  // days
  }>;
  totalActive: number;
}

export interface RiskMetrics {
  buckets: {
    low: number;      // 0-30
    medium: number;   // 31-50
    high: number;     // 51+
  };
  avgRiskScore: number;
  blockedActions24h: number;
  invoicesWithRisk: Array<{
    invoiceId: string;
    riskScore: number;
    status: InvoiceStatus;
  }>;
}

export interface FinancingMetrics {
  decisions24h: Record<AgentActionType, number>;
  autoFinancedCount: number;
  blockedByLiquidity: number;
  blockedBySafety: number;
  avgLTV?: number;  // if available
}

export interface PoolStressMetrics {
  currentUtilization: number;
  maxUtilization60min: number;
  blockedTx24h: number;
  defaultBuffer?: number;
  maxIssuerExposure?: number;
  protectionActive: boolean;
  utilizationSeries: UtilizationPoint[];
}

export interface DecisionVelocityMetrics {
  decisionsPerMinute: Array<{
    minute: number;  // unix seconds
    count: number;
  }>;
  avgEvaluationTime?: number;  // ms, if available
  signalsProcessed: number;
  activeAgents: number;
}

export interface AILifecycleData {
  invoices: Invoice[];
  decisions: AgentDecision[];
  poolState: PoolState;
  utilizationSeries: UtilizationPoint[];
  lifecycle: LifecycleMetrics;
  risk: RiskMetrics;
  financing: FinancingMetrics;
  poolStress: PoolStressMetrics;
  decisionVelocity: DecisionVelocityMetrics;
}

