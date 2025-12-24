import { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { z } from "zod";
import { emitAgentEvent } from "../websocket/server";

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

export async function registerAgentRoutes(app: FastifyInstance) {
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
            // Fetch recent decisions
            const recentDecisions = await prisma.agentDecision.findMany({
                orderBy: { createdAt: "desc" },
                take: 100,
            });

            // System status
            const engineStatus = "Running"; // Could be dynamic based on actual agent status
            const activeAgents = 5; // Number of active agents
            const lastEvaluation = recentDecisions[0]?.createdAt || new Date();
            const systemLoad = 45; // Percentage

            // Agent definitions
            const agents = [
                {
                    id: "credit-risk",
                    name: "Credit Risk Agent",
                    scope: "Monitors counterparty credit profiles and exposure limits",
                    state: "Active",
                    lastAction: recentDecisions.find(d => d.actionType.includes("RISK"))?.createdAt || new Date(Date.now() - 300000),
                    confidence: 87,
                },
                {
                    id: "liquidity-allocation",
                    name: "Liquidity Allocation Agent",
                    scope: "Optimizes capital deployment across invoice vintages",
                    state: "Active",
                    lastAction: recentDecisions.find(d => d.actionType.includes("ALLOCATION"))?.createdAt || new Date(Date.now() - 600000),
                    confidence: 92,
                },
                {
                    id: "default-early-warning",
                    name: "Default Early-Warning Agent",
                    scope: "Identifies invoices at risk of default",
                    state: "Alerting",
                    lastAction: recentDecisions.find(d => d.actionType.includes("DEFAULT"))?.createdAt || new Date(Date.now() - 120000),
                    confidence: 78,
                },
                {
                    id: "invoice-scoring",
                    name: "Invoice Scoring Agent",
                    scope: "Evaluates invoice quality and financing eligibility",
                    state: "Active",
                    lastAction: recentDecisions.find(d => d.actionType.includes("SCORE"))?.createdAt || new Date(Date.now() - 180000),
                    confidence: 85,
                },
                {
                    id: "compliance-guard",
                    name: "Compliance Guard Agent",
                    scope: "Ensures regulatory and policy compliance",
                    state: "Idle",
                    lastAction: recentDecisions.find(d => d.actionType.includes("COMPLIANCE"))?.createdAt || new Date(Date.now() - 3600000),
                    confidence: 95,
                },
            ];

            // Generate live signals from recent decisions
            const signals = recentDecisions.slice(0, 20).map((decision, idx) => {
                const severity = decision.riskScore && decision.riskScore > 70 ? "High" : decision.riskScore && decision.riskScore > 40 ? "Medium" : "Low";
                const agentMap: Record<string, string> = {
                    "RISK": "credit-risk",
                    "ALLOCATION": "liquidity-allocation",
                    "DEFAULT": "default-early-warning",
                    "SCORE": "invoice-scoring",
                    "COMPLIANCE": "compliance-guard",
                };
                const sourceAgent = Object.entries(agentMap).find(([key]) => 
                    decision.actionType.includes(key)
                )?.[1] || "credit-risk";

                return {
                    id: decision.id,
                    timestamp: decision.createdAt,
                    sourceAgent,
                    severity,
                    message: decision.message || `${decision.actionType} for invoice ${decision.invoiceExternalId || decision.invoiceId || "N/A"}`,
                    context: {
                        invoiceId: decision.invoiceId,
                        invoiceExternalId: decision.invoiceExternalId,
                        riskScore: decision.riskScore,
                    },
                };
            });

            // Decision traces (structured view of decisions)
            const decisionTraces = recentDecisions.slice(0, 10).map((decision) => {
                return {
                    id: decision.id,
                    timestamp: decision.createdAt,
                    inputs: {
                        invoiceId: decision.invoiceExternalId || decision.invoiceId,
                        previousStatus: decision.previousStatus,
                        riskScore: decision.riskScore,
                    },
                    signals: signals.filter(s => s.context.invoiceId === decision.invoiceId || s.context.invoiceExternalId === decision.invoiceExternalId).slice(0, 3),
                    evaluation: {
                        actionType: decision.actionType,
                        reasoning: decision.message || `Evaluated ${decision.actionType} based on risk profile`,
                    },
                    recommendation: {
                        action: decision.nextStatus || decision.actionType,
                        confidence: decision.riskScore ? 100 - decision.riskScore : 75,
                        requiresApproval: true,
                    },
                };
            });

            // Recommendations (read-only)
            const recommendations = recentDecisions
                .filter(d => d.nextStatus && d.nextStatus !== d.previousStatus)
                .slice(0, 5)
                .map((decision) => {
                    return {
                        id: decision.id,
                        timestamp: decision.createdAt,
                        type: decision.actionType,
                        summary: decision.message || `Recommend ${decision.nextStatus} for invoice ${decision.invoiceExternalId || decision.invoiceId}`,
                        reasoning: `Risk score: ${decision.riskScore || "N/A"}, Status transition: ${decision.previousStatus} → ${decision.nextStatus}`,
                        confidence: decision.riskScore ? 100 - decision.riskScore : 75,
                        supportingSignals: signals.filter(s => 
                            s.context.invoiceId === decision.invoiceId || 
                            s.context.invoiceExternalId === decision.invoiceExternalId
                        ).slice(0, 2),
                        requiresApproval: true,
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
                    systemLoad,
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
}
