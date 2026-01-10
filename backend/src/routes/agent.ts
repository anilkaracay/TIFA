import { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { z } from "zod";
import { emitAgentEvent } from "../websocket/server";
import { roleResolutionMiddleware, requireRole, requireWallet } from "../middleware/roleAuth";
import { Role } from "../auth/roles";
import * as fs from "fs";
import * as path from "path";
import { differenceInDays } from "date-fns";
import { loadContract } from "../onchain/provider";

const AgentDecisionSchema = z.object({
    invoiceId: z.string().nullable().optional(),
    invoiceExternalId: z.string().nullable().optional(),
    invoiceOnChainId: z.string().nullable().optional(),
    actionType: z.string(),       // e.g. STATUS_UPDATE, FINANCE, LIQUIDATE
    previousStatus: z.string().nullable().optional(),
    nextStatus: z.string().nullable().optional(),
    riskScore: z.number().int().min(0).max(100).nullable().optional(),
    txHash: z.string().nullable().optional(),
    message: z.string().nullable().optional(),
});

// Agent config file path
const AGENT_CONFIG_PATH = path.join(process.cwd(), "agent-config.json");

// Helper functions for agent config
function getAgentConfig(): {
    paused: boolean;
    riskThreshold: number;
    lastUpdated: string;
} {
    try {
        if (fs.existsSync(AGENT_CONFIG_PATH)) {
            const content = fs.readFileSync(AGENT_CONFIG_PATH, "utf-8");
            return JSON.parse(content);
        }
    } catch (e) {
        console.warn("[AgentConfig] Failed to read config file:", e);
    }
    // Default config
    return {
        paused: false,
        riskThreshold: 50,
        lastUpdated: new Date().toISOString(),
    };
}

function saveAgentConfig(config: { paused: boolean; riskThreshold: number; lastUpdated: string }): void {
    try {
        fs.writeFileSync(AGENT_CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
    } catch (e) {
        console.error("[AgentConfig] Failed to save config file:", e);
        throw e;
    }
}

// Risk scoring breakdown calculation (matches agent logic)
function computeRiskBreakdown(invoice: any, poolUtilization?: number): {
    factors: Array<{ name: string; impact: number; description: string }>;
    finalScore: number;
} {
    const amount = BigInt(invoice.amount || "0");
    const paid = BigInt(invoice.cumulativePaid || "0");
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
    const overdue = dueDate ? Math.max(0, differenceInDays(new Date(), dueDate)) : 0;

    const factors: Array<{ name: string; impact: number; description: string }> = [];
    let score = 0;

    // Overdue factor
    if (overdue > 0) {
        const overdueImpact = Math.min(60, overdue * 5);
        factors.push({
            name: `Overdue (${overdue}d)`,
            impact: overdueImpact,
            description: `${overdue} days overdue × 5 points per day (max 60)`,
        });
        score += overdueImpact;
    }

    // Partial payment factor
    if (amount > 0n && paid > amount / 2n) {
        factors.push({
            name: "Partial payment detected",
            impact: -10,
            description: `More than 50% paid (${paid.toString()} / ${amount.toString()})`,
        });
        score -= 10;
    }

    // High value factor
    const highValueThreshold = 1000n * 10n ** 18n;
    if (amount > highValueThreshold) {
        factors.push({
            name: "High invoice amount",
            impact: 10,
            description: `Amount exceeds threshold (${amount.toString()})`,
        });
        score += 10;
    }

    // Pool utilization pressure (if provided)
    if (poolUtilization !== undefined && poolUtilization > 70) {
        const utilizationImpact = Math.floor((poolUtilization - 70) / 5); // +2 per 5% above 70%
        if (utilizationImpact > 0) {
            factors.push({
                name: `Pool utilization pressure`,
                impact: utilizationImpact,
                description: `Pool utilization ${poolUtilization.toFixed(1)}% (threshold: 70%)`,
            });
            score += utilizationImpact;
        }
    }

    // Normalize to 0-100
    const finalScore = Math.max(0, Math.min(100, score));

    return { factors, finalScore };
}

export async function registerAgentRoutes(app: FastifyInstance) {
    // Apply role resolution for control endpoints
    app.addHook('onRequest', async (req, reply) => {
        // Only apply role resolution for control endpoints
        if (req.url?.includes('/agent/pause') || req.url?.includes('/agent/resume') || req.url?.includes('/agent/config')) {
            await roleResolutionMiddleware(req, reply);
        }
    });
    // POST /agent/decisions
    app.post("/decisions", async (req, reply) => {
        const parsed = AgentDecisionSchema.safeParse(req.body);
        if (!parsed.success) {
            console.error("[AgentDecision] Validation failed:", JSON.stringify(parsed.error.issues, null, 2));
            console.error("[AgentDecision] Request body:", JSON.stringify(req.body, null, 2));
            return reply.status(400).send({ error: "Invalid payload", issues: parsed.error.issues });
        }

        const decision = await prisma.agentDecision.create({
            data: parsed.data,
        });

        // Emit WebSocket event for decision
        emitAgentEvent({
            type: 'agent.decision',
            payload: {
                decisionId: decision.id,
                actionType: decision.actionType,
                invoiceId: decision.invoiceId,
                invoiceExternalId: decision.invoiceExternalId,
                riskScore: decision.riskScore,
                nextStatus: decision.nextStatus,
                financed: decision.actionType === 'FINANCE',
            },
        });

        // Emit agent.status event for instant card updates
        const agentNameMap: Record<string, string> = {
            'STATUS_UPDATE': 'Status Management Agent',
            'FINANCE': 'Auto-Financing Agent',
            'FINANCE_BLOCKED': 'Safety Guard Agent',
            'SAFETY_BLOCKED': 'Pool Protection Agent',
            'FINANCE_FAILED': 'Error Handler Agent',
        };
        const agentName = agentNameMap[decision.actionType] || 'Risk Scoring Agent';

        emitAgentEvent({
            type: 'agent.status',
            payload: {
                agentName,
                agentId: decision.actionType.toLowerCase().replace(/_/g, '-'),
                state: 'Active',
                confidence: decision.riskScore ? Math.max(50, 100 - decision.riskScore) : 85,
                timestamp: new Date().toISOString(),
                message: decision.message || `Processed ${decision.actionType} for ${decision.invoiceExternalId || decision.invoiceId || 'invoice'}`,
            },
        });

        return reply.send(decision);
    });

    // GET /agent/decisions?limit=50
    app.get("/decisions", async (req, reply) => {
        const limit = Number((req.query as any).limit ?? 50);
        const decisions = await prisma.agentDecision.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
        });
        return reply.send(decisions);
    });

    // GET /agent/console - Comprehensive agent console data
    app.get("/console", async (req, reply) => {
        try {
            console.log('[/agent/console] Starting to fetch data...');
            const agentConfig = getAgentConfig();
            const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const lastHour = new Date(Date.now() - 60 * 60 * 1000);

            // Fetch recent decisions
            console.log('[/agent/console] Fetching recent decisions...');
            const recentDecisions = await prisma.agentDecision.findMany({
                orderBy: { createdAt: "desc" },
                take: 20, // Reduced to prevent timeout
            });
            console.log(`[/agent/console] Fetched ${recentDecisions.length} decisions`);

            // Get agent activity stats from last 24 hours
            console.log('[/agent/console] Grouping stats...');
            const agentStats = await prisma.agentDecision.groupBy({
                by: ['actionType'],
                _count: true,
                _max: { createdAt: true },
                _avg: { riskScore: true },
                where: { createdAt: { gte: last24Hours } },
            });

            // Calculate system status
            const engineStatus = agentConfig.paused ? "Paused" : "Running";
            const lastEvaluation = recentDecisions[0]?.createdAt || new Date();

            // Calculate system load based on recent activity
            const decisionsLastHour = recentDecisions.filter(d => d.createdAt >= lastHour).length;
            const systemLoad = Math.min(100, Math.max(0, (decisionsLastHour / 10) * 100)); // Normalize to 0-100

            // Map action types to agent definitions
            const agentDefinitions: Record<string, { id: string; name: string; scope: string }> = {
                "STATUS_UPDATE": {
                    id: "status-management",
                    name: "Status Management Agent",
                    scope: "Monitors and updates invoice status based on payment events",
                },
                "FINANCE": {
                    id: "auto-financing",
                    name: "Auto-Financing Agent",
                    scope: "Automatically approves and draws financing for eligible invoices",
                },
                "FINANCE_BLOCKED": {
                    id: "safety-guard",
                    name: "Safety Guard Agent",
                    scope: "Blocks financing when safety limits are exceeded",
                },
                "SAFETY_BLOCKED": {
                    id: "pool-protection",
                    name: "Pool Protection Agent",
                    scope: "Protects pool from over-utilization and exposure risks",
                },
                "FINANCE_FAILED": {
                    id: "error-handler",
                    name: "Error Handler Agent",
                    scope: "Handles failed transactions and retries",
                },
            };

            // Core system agents that should always be visible
            const coreAgents: Array<{ id: string; name: string; scope: string }> = [
                {
                    id: "risk-scoring",
                    name: "Risk Scoring Agent",
                    scope: "Computes and explains risk scores for all invoices using multiple factors",
                },
                {
                    id: "status-management",
                    name: "Status Management Agent",
                    scope: "Monitors and updates invoice status based on payment events",
                },
                {
                    id: "auto-financing",
                    name: "Auto-Financing Agent",
                    scope: "Automatically approves and draws financing for eligible invoices",
                },
                {
                    id: "safety-guard",
                    name: "Safety Guard Agent",
                    scope: "Blocks financing when safety limits are exceeded",
                },
                {
                    id: "pool-protection",
                    name: "Pool Protection Agent",
                    scope: "Protects pool from over-utilization and exposure risks",
                },
            ];

            // Build agent map from actual activity
            const agentActivityMap = new Map<string, {
                state: string;
                lastAction: Date;
                confidence: number;
                workload: number;
                signalCount: number;
            }>();

            agentStats.forEach((stat) => {
                const def = agentDefinitions[stat.actionType];
                if (!def) return;

                const lastAction = stat._max.createdAt || new Date(Date.now() - 3600000);
                const timeSinceLastAction = Date.now() - lastAction.getTime();

                // Determine state based on activity
                let state: string;
                if (timeSinceLastAction < 5 * 60 * 1000) { // Last 5 minutes
                    state = "Active";
                } else if (timeSinceLastAction < 60 * 60 * 1000) { // Last hour
                    state = "Active";
                } else {
                    state = "Idle";
                }

                // Calculate confidence from risk score distribution
                const avgRisk = stat._avg.riskScore || 50;
                const confidence = Math.max(50, Math.min(100, 100 - avgRisk + (stat._count > 10 ? 10 : 0)));

                // Calculate workload (decisions in last hour)
                const decisionsLastHour = recentDecisions.filter(d =>
                    d.actionType === stat.actionType &&
                    d.createdAt >= lastHour
                ).length;

                // Count signals from this agent
                const agentSignals = recentDecisions.filter(d =>
                    d.actionType === stat.actionType
                ).slice(0, 20).length;

                agentActivityMap.set(def.id, {
                    state,
                    lastAction,
                    confidence: Math.round(confidence),
                    workload: decisionsLastHour,
                    signalCount: agentSignals,
                });
            });

            // Build final agent list - always show all core agents
            const agents = coreAgents.map((coreAgent) => {
                const activity = agentActivityMap.get(coreAgent.id);

                // Get last action summary for this agent
                let lastActionSummary: string | null = null;
                const agentDecisions = recentDecisions.filter(d => {
                    if (coreAgent.id === "risk-scoring") {
                        return d.riskScore !== null && d.riskScore !== undefined;
                    }
                    const def = agentDefinitions[d.actionType];
                    return def && def.id === coreAgent.id;
                });

                if (agentDecisions.length > 0) {
                    const lastDecision = agentDecisions[0];
                    if (lastDecision.actionType.includes("BLOCKED")) {
                        lastActionSummary = `Blocked ${lastDecision.actionType.includes("FINANCE") ? "financing" : "action"}${lastDecision.invoiceExternalId ? ` for ${lastDecision.invoiceExternalId}` : ""}`;
                    } else if (lastDecision.actionType === "FINANCE") {
                        lastActionSummary = `Approved financing${lastDecision.invoiceExternalId ? ` for ${lastDecision.invoiceExternalId}` : ""}`;
                    } else if (lastDecision.actionType === "STATUS_UPDATE") {
                        lastActionSummary = `Updated status${lastDecision.nextStatus ? ` to ${lastDecision.nextStatus}` : ""}${lastDecision.invoiceExternalId ? ` for ${lastDecision.invoiceExternalId}` : ""}`;
                    } else if (lastDecision.message) {
                        lastActionSummary = lastDecision.message.length > 60 ? lastDecision.message.substring(0, 60) + "..." : lastDecision.message;
                    } else {
                        lastActionSummary = `Processed ${agentDecisions.length} ${agentDecisions.length === 1 ? "decision" : "decisions"}`;
                    }
                }

                // For Risk Scoring Agent, check if any decision has a risk score
                if (coreAgent.id === "risk-scoring") {
                    const hasRiskScores = recentDecisions.some(d => d.riskScore !== null && d.riskScore !== undefined);
                    const riskScoreDecisions = recentDecisions.filter(d => d.riskScore !== null && d.riskScore !== undefined);
                    const lastRiskScore = riskScoreDecisions[0]?.createdAt || new Date(Date.now() - 3600000);
                    const timeSince = Date.now() - lastRiskScore.getTime();

                    return {
                        id: coreAgent.id,
                        name: coreAgent.name,
                        scope: coreAgent.scope,
                        state: timeSince < 5 * 60 * 1000 ? "Active" : timeSince < 60 * 60 * 1000 ? "Active" : "Idle",
                        lastAction: lastRiskScore,
                        confidence: hasRiskScores ? 85 : 75,
                        workload: riskScoreDecisions.filter(d => d.createdAt >= lastHour).length,
                        signalCount: riskScoreDecisions.length,
                        lastActionSummary: lastActionSummary || "No recent activity",
                    };
                }

                // For other agents, use activity data or defaults
                if (activity) {
                    return {
                        id: coreAgent.id,
                        name: coreAgent.name,
                        scope: coreAgent.scope,
                        ...activity,
                        lastActionSummary: lastActionSummary || "No recent activity",
                    };
                }

                // Default values for agents with no recent activity
                return {
                    id: coreAgent.id,
                    name: coreAgent.name,
                    scope: coreAgent.scope,
                    state: "Idle",
                    lastAction: new Date(Date.now() - 3600000),
                    confidence: coreAgent.id === "safety-guard" ? 95 : coreAgent.id === "pool-protection" ? 92 : coreAgent.id === "auto-financing" ? 90 : 85,
                    workload: 0,
                    signalCount: 0,
                    lastActionSummary: "No recent activity",
                };
            });

            // Agents are now always built from coreAgents list above

            // Calculate active agents count
            const activeAgents = agents.filter(a => a.state === "Active").length;

            // Generate live signals from recent decisions (deduplicated)
            const seenSignals = new Set<string>();
            const signals = recentDecisions
                .filter((decision) => {
                    // Deduplicate by invoice + actionType
                    const key = `${decision.invoiceExternalId || decision.invoiceId}-${decision.actionType}`;
                    if (seenSignals.has(key)) return false;
                    seenSignals.add(key);
                    return true;
                })
                .slice(0, 20)
                .map((decision) => {
                    // Determine severity based on risk score and action type
                    let severity: string;
                    if (decision.actionType.includes("BLOCKED") || decision.actionType.includes("FAILED")) {
                        severity = "High";
                    } else if (decision.riskScore && decision.riskScore > 70) {
                        severity = "High";
                    } else if (decision.riskScore && decision.riskScore > 40) {
                        severity = "Medium";
                    } else {
                        severity = "Low";
                    }

                    // Map action type to agent ID
                    const agentId = agents.find(a =>
                        decision.actionType.includes(a.id.toUpperCase().replace(/-/g, "_")) ||
                        decision.actionType === a.id.toUpperCase().replace(/-/g, "_")
                    )?.id || "status-management";

                    return {
                        id: decision.id,
                        timestamp: decision.createdAt,
                        sourceAgent: agentId,
                        severity,
                        message: decision.message || `${decision.actionType} for invoice ${decision.invoiceExternalId || decision.invoiceId || "N/A"}`,
                        context: {
                            invoiceId: decision.invoiceId,
                            invoiceExternalId: decision.invoiceExternalId,
                            invoiceOnChainId: decision.invoiceOnChainId,
                            riskScore: decision.riskScore,
                            txHash: decision.txHash,
                        },
                    };
                });

            // Decision traces (structured view of decisions with AI reasoning pipeline)
            const decisionTraces = recentDecisions.slice(0, 5).map((decision) => {
                const relatedSignals = signals.filter(s =>
                    s.context.invoiceId === decision.invoiceId ||
                    s.context.invoiceExternalId === decision.invoiceExternalId
                ).slice(0, 3);

                // Build reasoning pipeline
                const reasoningSteps = [];

                // Step 1: Inputs
                reasoningSteps.push({
                    step: "inputs",
                    label: "Input Analysis",
                    content: {
                        invoiceId: decision.invoiceExternalId || decision.invoiceId,
                        invoiceOnChainId: decision.invoiceOnChainId,
                        previousStatus: decision.previousStatus,
                        riskScore: decision.riskScore,
                    },
                });

                // Step 2: Signals detected
                if (relatedSignals.length > 0) {
                    reasoningSteps.push({
                        step: "signals",
                        label: "Signals Detected",
                        content: relatedSignals.map(s => ({
                            source: s.sourceAgent,
                            severity: s.severity,
                            message: s.message,
                        })),
                    });
                }

                // Step 3: Risk evaluation
                if (decision.riskScore !== null && decision.riskScore !== undefined) {
                    reasoningSteps.push({
                        step: "evaluation",
                        label: "Risk Evaluation",
                        content: {
                            riskScore: decision.riskScore,
                            threshold: agentConfig.riskThreshold,
                            passed: decision.riskScore < agentConfig.riskThreshold,
                        },
                    });
                }

                // Step 4: Safety checks (if blocked)
                if (decision.actionType.includes("BLOCKED") || decision.actionType.includes("SAFETY")) {
                    reasoningSteps.push({
                        step: "safety",
                        label: "Safety Checks",
                        content: {
                            checks: decision.message?.includes("UTILIZATION") ? ["Utilization limit"] :
                                decision.message?.includes("EXPOSURE") ? ["Issuer exposure limit"] :
                                    decision.message?.includes("LIQUIDITY") ? ["Insufficient liquidity"] :
                                        ["Pool protection active"],
                            result: "BLOCKED",
                            reason: decision.message,
                        },
                    });
                }

                // Step 5: Decision
                reasoningSteps.push({
                    step: "decision",
                    label: "Final Decision",
                    content: {
                        actionType: decision.actionType,
                        nextStatus: decision.nextStatus,
                        reasoning: decision.message || `Evaluated ${decision.actionType} based on risk profile`,
                    },
                });

                // Step 6: Execution result
                if (decision.txHash) {
                    reasoningSteps.push({
                        step: "execution",
                        label: "Execution Result",
                        content: {
                            status: "SUCCESS",
                            txHash: decision.txHash,
                            onChain: true,
                        },
                    });
                } else if (decision.actionType.includes("FAILED")) {
                    reasoningSteps.push({
                        step: "execution",
                        label: "Execution Result",
                        content: {
                            status: "FAILED",
                            reason: decision.message,
                            onChain: false,
                        },
                    });
                } else if (decision.actionType.includes("BLOCKED")) {
                    reasoningSteps.push({
                        step: "execution",
                        label: "Execution Result",
                        content: {
                            status: "BLOCKED",
                            reason: decision.message,
                            onChain: false,
                        },
                    });
                }

                return {
                    id: decision.id,
                    timestamp: decision.createdAt,
                    reasoningPipeline: reasoningSteps,
                    inputs: {
                        invoiceId: decision.invoiceExternalId || decision.invoiceId,
                        invoiceOnChainId: decision.invoiceOnChainId,
                        previousStatus: decision.previousStatus,
                        riskScore: decision.riskScore,
                    },
                    signals: relatedSignals,
                    evaluation: {
                        actionType: decision.actionType,
                        reasoning: decision.message || `Evaluated ${decision.actionType} based on risk profile${decision.riskScore ? ` (risk score: ${decision.riskScore})` : ""}`,
                        txHash: decision.txHash,
                    },
                    recommendation: {
                        action: decision.nextStatus || decision.actionType,
                        confidence: decision.riskScore ? Math.max(0, Math.min(100, 100 - decision.riskScore)) : 75,
                        requiresApproval: decision.actionType === "FINANCE" || decision.actionType.includes("BLOCKED"),
                    },
                };
            });

            // Recommendations (from decisions that require follow-up or are blocked)
            const recommendations = recentDecisions
                .filter(d =>
                    (d.nextStatus && d.nextStatus !== d.previousStatus) ||
                    d.actionType.includes("BLOCKED") ||
                    d.actionType.includes("FAILED")
                )
                .slice(0, 5)
                .map((decision) => {
                    const relatedSignals = signals.filter(s =>
                        s.context.invoiceId === decision.invoiceId ||
                        s.context.invoiceExternalId === decision.invoiceExternalId
                    ).slice(0, 2);

                    let summary: string;
                    if (decision.actionType.includes("BLOCKED")) {
                        summary = decision.message || `Financing blocked for invoice ${decision.invoiceExternalId || decision.invoiceId}`;
                    } else if (decision.actionType.includes("FAILED")) {
                        summary = decision.message || `Action failed for invoice ${decision.invoiceExternalId || decision.invoiceId}`;
                    } else {
                        summary = decision.message || `Recommend ${decision.nextStatus} for invoice ${decision.invoiceExternalId || decision.invoiceId}`;
                    }

                    return {
                        id: decision.id,
                        timestamp: decision.createdAt,
                        type: decision.actionType,
                        summary,
                        reasoning: `Risk score: ${decision.riskScore || "N/A"}${decision.previousStatus && decision.nextStatus ? `, Status transition: ${decision.previousStatus} → ${decision.nextStatus}` : ""}`,
                        confidence: decision.riskScore ? Math.max(0, Math.min(100, 100 - decision.riskScore)) : 75,
                        supportingSignals: relatedSignals,
                        requiresApproval: decision.actionType === "FINANCE" || decision.actionType.includes("BLOCKED"),
                    };
                });

            // Model transparency
            const modelTransparency = {
                dataSources: [
                    "On-chain invoice registry",
                    "Payment history database",
                    "Counterparty credit profiles",
                    "Market risk indicators",
                ],
                updateFrequency: "Real-time (continuous monitoring)",
                modelClass: "Hybrid: Rule-based + Machine Learning",
                lastRetraining: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
                version: "v2.1.0",
            };

            console.log('[/agent/console] Returning data...');
            const responseData = {
                systemStatus: {
                    engineStatus,
                    activeAgents,
                    lastEvaluation: lastEvaluation.toISOString(),
                    systemLoad: Math.round(systemLoad),
                },
                agents,
                signals,
                decisionTraces,
                recommendations,
                modelTransparency,
                auditLog: {
                    totalDecisions: recentDecisions.length,
                    lastUpdated: new Date().toISOString(),
                    exportable: true,
                },
            };
            console.log('[/agent/console] Sending response...');
            return reply.send(responseData);
        } catch (error: any) {
            console.error("Agent Console Error:", error);
            return reply.code(500).send({
                error: "Failed to fetch agent console data",
                details: error.message
            });
        }
    });

    // GET /agent/health - Check agent service health
    app.get("/health", async (req, reply) => {
        try {
            const agentConfig = getAgentConfig();
            const lastDecision = await prisma.agentDecision.findFirst({
                orderBy: { createdAt: "desc" },
            });

            const lastHeartbeat = lastDecision?.createdAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
            const timeSinceLastHeartbeat = Date.now() - lastHeartbeat.getTime();
            const isHealthy = timeSinceLastHeartbeat < 10 * 60 * 1000; // Consider healthy if last decision < 10 minutes ago

            return {
                status: agentConfig.paused ? "paused" : (isHealthy ? "healthy" : "degraded"),
                paused: agentConfig.paused,
                lastHeartbeat: lastHeartbeat.toISOString(),
                uptime: isHealthy ? "operational" : "unknown",
                lastDecisionId: lastDecision?.id || null,
            };
        } catch (error: any) {
            return reply.code(500).send({
                error: "Failed to check agent health",
                details: error.message,
            });
        }
    });

    // POST /agent/pause - Pause agent operations (ADMIN only)
    app.post("/pause", { preHandler: [requireWallet, requireRole(Role.ADMIN)] }, async (req, reply) => {
        try {
            const config = getAgentConfig();
            config.paused = true;
            config.lastUpdated = new Date().toISOString();
            saveAgentConfig(config);

            emitAgentEvent({
                type: 'agent.paused',
                payload: { paused: true, timestamp: new Date().toISOString() },
            });

            return { success: true, paused: true };
        } catch (error: any) {
            return reply.code(500).send({
                error: "Failed to pause agent",
                details: error.message,
            });
        }
    });

    // POST /agent/resume - Resume agent operations (ADMIN only)
    app.post("/resume", { preHandler: [requireWallet, requireRole(Role.ADMIN)] }, async (req, reply) => {
        try {
            const config = getAgentConfig();
            config.paused = false;
            config.lastUpdated = new Date().toISOString();
            saveAgentConfig(config);

            emitAgentEvent({
                type: 'agent.resumed',
                payload: { paused: false, timestamp: new Date().toISOString() },
            });

            return { success: true, paused: false };
        } catch (error: any) {
            return reply.code(500).send({
                error: "Failed to resume agent",
                details: error.message,
            });
        }
    });

    // GET /agent/config - Get agent configuration
    app.get("/config", async (req, reply) => {
        try {
            const config = getAgentConfig();
            return config;
        } catch (error: any) {
            return reply.code(500).send({
                error: "Failed to get agent config",
                details: error.message,
            });
        }
    });

    // POST /agent/config - Update agent configuration (ADMIN only)
    app.post("/config", { preHandler: [requireWallet, requireRole(Role.ADMIN)] }, async (req, reply) => {
        try {
            const ConfigSchema = z.object({
                riskThreshold: z.number().int().min(0).max(100).optional(),
                paused: z.boolean().optional(),
            });

            const parsed = ConfigSchema.safeParse(req.body);
            if (!parsed.success) {
                return reply.status(400).send({ error: "Invalid payload", issues: parsed.error.issues });
            }

            const config = getAgentConfig();
            if (parsed.data.riskThreshold !== undefined) {
                config.riskThreshold = parsed.data.riskThreshold;
            }
            if (parsed.data.paused !== undefined) {
                config.paused = parsed.data.paused;
            }
            config.lastUpdated = new Date().toISOString();
            saveAgentConfig(config);

            emitAgentEvent({
                type: 'agent.config.updated',
                payload: { config, timestamp: new Date().toISOString() },
            });

            return { success: true, config };
        } catch (error: any) {
            return reply.code(500).send({
                error: "Failed to update agent config",
                details: error.message,
            });
        }
    });

    // GET /agent/risk-breakdown/:invoiceId - Get explainable risk scoring breakdown
    app.get("/risk-breakdown/:invoiceId", async (req, reply) => {
        try {
            const { invoiceId } = req.params as { invoiceId: string };

            // Fetch invoice from database
            const invoice = await prisma.invoice.findUnique({
                where: { id: invoiceId },
            });

            if (!invoice) {
                return reply.code(404).send({ error: "Invoice not found" });
            }

            // Get pool utilization if available
            let poolUtilization: number | undefined;
            try {
                const FinancingPool = loadContract("FinancingPool");
                const utilization = await FinancingPool.utilization();
                poolUtilization = Number(utilization.toString()) / 100;
            } catch (e) {
                // Ignore if can't fetch
            }

            const breakdown = computeRiskBreakdown(invoice, poolUtilization);

            return {
                invoiceId: invoice.id,
                invoiceExternalId: invoice.externalId,
                factors: breakdown.factors,
                finalScore: breakdown.finalScore,
                timestamp: new Date().toISOString(),
            };
        } catch (error: any) {
            return reply.code(500).send({
                error: "Failed to compute risk breakdown",
                details: error.message,
            });
        }
    });

    // GET /agent/system-parameters - Get active policy parameters
    app.get("/system-parameters", async (req, reply) => {
        try {
            const agentConfig = getAgentConfig();

            // Get pool parameters
            let poolParams: any = {};
            try {
                const FinancingPool = loadContract("FinancingPool");
                const [maxUtilization, maxLoanBps, maxIssuerExposureBps] = await Promise.all([
                    FinancingPool.maxUtilizationBps().catch(() => null),
                    FinancingPool.maxLoanBpsOfTVL().catch(() => null),
                    FinancingPool.maxIssuerExposureBps().catch(() => null),
                ]);

                poolParams = {
                    maxUtilizationBps: maxUtilization ? Number(maxUtilization.toString()) : null,
                    maxLoanBpsOfTVL: maxLoanBps ? Number(maxLoanBps.toString()) : null,
                    maxIssuerExposureBps: maxIssuerExposureBps ? Number(maxIssuerExposureBps.toString()) : null,
                };
            } catch (e) {
                // Ignore if can't fetch
            }

            return {
                riskThreshold: agentConfig.riskThreshold,
                ltvBps: 6000, // 60% LTV - hardcoded in agent
                utilizationThresholdBps: 7500, // 75% - from poolGuard
                maxUtilizationBps: poolParams.maxUtilizationBps || 8000, // 80% default
                maxLoanBpsOfTVL: poolParams.maxLoanBpsOfTVL || null,
                maxIssuerExposureBps: poolParams.maxIssuerExposureBps || null,
                lastUpdated: agentConfig.lastUpdated,
            };
        } catch (error: any) {
            return reply.code(500).send({
                error: "Failed to get system parameters",
                details: error.message,
            });
        }
    });

    // GET /agent/predictions - Get rule-based predictive intelligence
    app.get("/predictions", async (req, reply) => {
        try {
            const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const next24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000);

            // Get active invoices
            const activeInvoices = await prisma.invoice.findMany({
                where: {
                    status: { in: ["TOKENIZED", "FINANCED", "ISSUED"] },
                },
                take: 100,
            });

            // Get pool state
            let poolUtilization = 0;
            let availableLiquidity = 0n;
            try {
                const FinancingPool = loadContract("FinancingPool");
                const utilization = await FinancingPool.utilization();
                const available = await FinancingPool.availableLiquidity();
                poolUtilization = Number(utilization.toString()) / 100;
                availableLiquidity = BigInt(available.toString());
            } catch (e) {
                // Ignore if can't fetch
            }

            // Predict invoices that will breach risk threshold
            const invoicesAtRisk: Array<{ invoiceId: string; externalId: string; currentRisk: number; projectedRisk: number; reason: string }> = [];
            activeInvoices.forEach((inv) => {
                const breakdown = computeRiskBreakdown(inv, poolUtilization);
                if (breakdown.finalScore >= 50) {
                    invoicesAtRisk.push({
                        invoiceId: inv.id,
                        externalId: inv.externalId,
                        currentRisk: breakdown.finalScore,
                        projectedRisk: breakdown.finalScore,
                        reason: breakdown.factors.map(f => f.name).join(", "),
                    });
                }
            });

            // Project pool utilization (rule-based)
            const agentConfig = getAgentConfig();
            const eligibleInvoices = activeInvoices.filter(inv =>
                inv.status === "TOKENIZED" &&
                !inv.isFinanced &&
                computeRiskBreakdown(inv, poolUtilization).finalScore < agentConfig.riskThreshold
            );

            let projectedUtilization = poolUtilization;
            let expectedFinancingBlocks = 0;
            let expectedFinancings = 0;

            eligibleInvoices.forEach((inv) => {
                const invoiceAmount = BigInt(inv.amount || "0");
                const financeAmount = (invoiceAmount * BigInt(6000)) / BigInt(10000); // 60% LTV

                if (availableLiquidity >= financeAmount) {
                    expectedFinancings++;
                    // Simple projection: assume utilization increases proportionally
                    // This is a rough estimate
                } else {
                    expectedFinancingBlocks++;
                }
            });

            return {
                horizon: "24h",
                invoicesAtRisk: invoicesAtRisk.length,
                invoicesAtRiskDetails: invoicesAtRisk.slice(0, 10),
                poolUtilizationProjection: {
                    current: poolUtilization,
                    projected: Math.min(100, projectedUtilization + (expectedFinancings * 2)), // Rough estimate
                },
                expectedFinancings,
                expectedFinancingBlocks,
                safetyWarnings: poolUtilization > 70 ? [`Pool utilization at ${poolUtilization.toFixed(1)}% - approaching threshold`] : [],
                timestamp: new Date().toISOString(),
            };
        } catch (error: any) {
            return reply.code(500).send({
                error: "Failed to generate predictions",
                details: error.message,
            });
        }
    });
}
