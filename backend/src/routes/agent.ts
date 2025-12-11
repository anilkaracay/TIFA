import { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { z } from "zod";

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
}
