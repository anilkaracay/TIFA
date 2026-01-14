import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { roleResolutionMiddleware, requireRole, requireWallet } from '../middleware/roleAuth';
import { Role } from '../auth/roles';
import { kycService } from '../compliance/kyc';

export async function registerComplianceRoutes(app: FastifyInstance) {
    // Apply role resolution
    app.addHook('onRequest', roleResolutionMiddleware);

    // GET /compliance/kyc/me - Get my profile
    app.get('/kyc/me', async (req, reply) => {
        // Identify subject: Wallet for LP, CompanyId for Issuer (if available in req context or implied by wallet)
        // For now, simplify: use Wallet if available (LP flow), or try to infer context.
        // Or accept ?subjectType=LP|ISSUER

        const query = z.object({
            subjectType: z.enum(['LP', 'ISSUER']).default('LP'),
            companyId: z.string().optional()
        }).parse(req.query);

        let subjectId = req.wallet;

        if (query.subjectType === 'ISSUER') {
            // If issuer, we expect companyId. If not provided, maybe linked to wallet? 
            // For now existing auth isn't strict on company-wallet link in all middleware.
            if (!query.companyId && !req.wallet) {
                return reply.code(400).send({ error: "CompanyId or Wallet required for Issuer lookup" });
            }
            // If query.companyId is passed, use it (assuming valid auth logic handles ownership)
            // In a real app we'd verify wallet owns company.
            subjectId = query.companyId || req.wallet;
        }

        if (!subjectId) {
            return reply.code(400).send({ error: "Wallet required for LP lookup" });
        }

        const profile = await kycService.getProfile(subjectId, query.subjectType);
        return { profile };
    });

    // POST /compliance/kyc/submit - Submit my profile
    app.post('/kyc/submit', async (req, reply) => {
        const body = z.object({
            subjectType: z.enum(['LP', 'ISSUER']),
            companyId: z.string().optional(),
            legalName: z.string(),
            country: z.string(),
            contactName: z.string(),
            contactEmail: z.string().email(),
            registrationNumber: z.string().optional(),
            metadata: z.record(z.any()).optional(),
            wallet: z.string().optional() // Allow wallet in body
        }).parse(req.body);

        let subjectId = req.wallet || body.wallet; // Fallback to body wallet
        if (body.subjectType === 'ISSUER') {
            subjectId = body.companyId || req.wallet || body.wallet;
        }

        if (!subjectId) {
            return reply.code(400).send({ error: "Identity required" });
        }

        try {
            const profile = await kycService.submitProfile(subjectId, body.subjectType, body);
            return { success: true, profile };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    // ADMIN ROUTES

    // GET /compliance/admin/kyc - List pending
    app.get('/admin/kyc', { preHandler: [requireWallet, requireRole(Role.ADMIN)] }, async (req, reply) => {
        const profiles = await kycService.listPendingProfiles();
        return { profiles };
    });

    // POST /compliance/admin/kyc/:id/approve
    app.post('/admin/kyc/:id/approve', { preHandler: [requireWallet, requireRole(Role.ADMIN)] }, async (req, reply) => {
        const { id } = z.object({ id: z.string() }).parse(req.params);
        if (!req.wallet) return reply.code(401);

        try {
            const profile = await kycService.approveProfile(id, req.wallet); // Admin wallet as ID
            return { success: true, profile };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    // POST /compliance/admin/kyc/:id/reject
    app.post('/admin/kyc/:id/reject', { preHandler: [requireWallet, requireRole(Role.ADMIN)] }, async (req, reply) => {
        const { id } = z.object({ id: z.string() }).parse(req.params);
        const { reason } = z.object({ reason: z.string() }).parse(req.body);
        if (!req.wallet) return reply.code(401);

        try {
            const profile = await kycService.rejectProfile(id, reason, req.wallet);
            return { success: true, profile };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });
}
