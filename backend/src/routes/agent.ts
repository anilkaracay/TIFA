import { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { z } from "zod";
import { emitAgentEvent } from "../websocket/server";
import { roleResolutionMiddleware, requireRole, requireWallet } from "../middleware/roleAuth";
import { Role } from "../auth/roles";
import * as fs from "fs";
import * as path from "path";

const AgentDecisionSchema = z.object({
    invoiceId: z.string().optional(),
    invoiceExternalId: z.string().optional(),
    invoiceOnChainId: z.string().optional(),
    actionType: z.string(),       // e.g. STATUS_UPDATE, FINANCE, LIQUIDATE
    previousStatus: z.string().optional(),
    nextStatus: z.string().optional(),
    riskScore: z.number().int().min(0).max(100).optional(),
    txHash: z.string().optional(),
    message: z.string().optional(),
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
            return reply.status(400).send({ error: "Invalid payload", issues: parsed.error.issues });
        }

        const decision = await prisma.agentDecision.create({
            data: parsed.data,
        });

        // Emit WebSocket event
        emitAgentEvent({
            type: 'agent.decision',
            payload: {
                decisionId: decision.id,
                actionType: decision.actionType,
                invoiceId: decision.invoiceId,
                invoiceExternalId: decision.invoiceExternalId,
                riskScore: decision.riskScore,
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
            const agentConfig = getAgentConfig();
            const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const lastHour = new Date(Date.now() - 60 * 60 * 1000);

            // Fetch recent decisions
            const recentDecisions = await prisma.agentDecision.findMany({
                orderBy: { createdAt: "desc" },
                take: 100,
            });

            // Get agent activity stats from last 24 hours
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

            // Build dynamic agent list from actual activity
            const agents = agentStats.map((stat) => {
                const def = agentDefinitions[stat.actionType] || {
                    id: stat.actionType.toLowerCase().replace(/_/g, "-"),
                    name: `${stat.actionType.replace(/_/g, " ")} Agent`,
                    scope: `Handles ${stat.actionType.replace(/_/g, " ")} actions`,
                };

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

                return {
                    id: def.id,
                    name: def.name,
                    scope: def.scope,
                    state,
                    lastAction,
                    confidence: Math.round(confidence),
                };
            });

            // If no agents found, add default agents based on recent decisions
            if (agents.length === 0 && recentDecisions.length > 0) {
                const uniqueActionTypes = [...new Set(recentDecisions.map(d => d.actionType))];
                uniqueActionTypes.forEach((actionType) => {
                    const def = agentDefinitions[actionType] || {
                        id: actionType.toLowerCase().replace(/_/g, "-"),
                        name: `${actionType.replace(/_/g, " ")} Agent`,
                        scope: `Handles ${actionType.replace(/_/g, " ")} actions`,
                    };
                    const relatedDecisions = recentDecisions.filter(d => d.actionType === actionType);
                    const lastAction = relatedDecisions[0]?.createdAt || new Date(Date.now() - 3600000);
                    const avgRisk = relatedDecisions.reduce((sum, d) => sum + (d.riskScore || 50), 0) / relatedDecisions.length;
                    
                    agents.push({
                        id: def.id,
                        name: def.name,
                        scope: def.scope,
                        state: "Active",
                        lastAction,
                        confidence: Math.round(Math.max(50, Math.min(100, 100 - avgRisk))),
                    });
                });
            }

            // If still no agents found (no decisions at all), show default system agents
            if (agents.length === 0) {
                agents.push(
                    {
                        id: "status-management",
                        name: "Status Management Agent",
                        scope: "Monitors and updates invoice status based on payment events",
                        state: "Idle",
                        lastAction: new Date(Date.now() - 3600000),
                        confidence: 85,
                    },
                    {
                        id: "auto-financing",
                        name: "Auto-Financing Agent",
                        scope: "Automatically approves and draws financing for eligible invoices",
                        state: "Idle",
                        lastAction: new Date(Date.now() - 3600000),
                        confidence: 90,
                    },
                    {
                        id: "safety-guard",
                        name: "Safety Guard Agent",
                        scope: "Blocks financing when safety limits are exceeded",
                        state: "Idle",
                        lastAction: new Date(Date.now() - 3600000),
                        confidence: 95,
                    },
                    {
                        id: "pool-protection",
                        name: "Pool Protection Agent",
                        scope: "Protects pool from over-utilization and exposure risks",
                        state: "Idle",
                        lastAction: new Date(Date.now() - 3600000),
                        confidence: 92,
                    }
                );
            }

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

            // Decision traces (structured view of decisions)
            const decisionTraces = recentDecisions.slice(0, 10).map((decision) => {
                const relatedSignals = signals.filter(s => 
                    s.context.invoiceId === decision.invoiceId || 
                    s.context.invoiceExternalId === decision.invoiceExternalId
                ).slice(0, 3);

                return {
                    id: decision.id,
                    timestamp: decision.createdAt,
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

            return {
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
}
