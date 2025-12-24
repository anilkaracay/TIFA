import { FastifyInstance } from 'fastify';
import { registerInvoiceRoutes } from './invoices';
import { registerCompanyRoutes } from './companies';
import { registerAgentRoutes } from "./agent";
import { registerAnalyticsRoutes } from './analytics';
import { registerLPRoutes } from './lp';
import { registerSafetyRoutes } from './safety';
import { registerTruthRoutes } from './truth';
import { registerAdminRoutes } from './admin';

export async function registerRoutes(app: FastifyInstance) {
    await app.register(registerInvoiceRoutes, { prefix: '/invoices' });
    await app.register(registerCompanyRoutes, { prefix: '/companies' });
    await app.register(registerAgentRoutes, { prefix: '/agent' });
    await app.register(registerAnalyticsRoutes, { prefix: '/analytics' });
    await app.register(registerLPRoutes, { prefix: '/lp' });
    await app.register(registerLPRoutes, { prefix: '/pool' }); // Pool overview at /pool/overview
    await app.register(registerSafetyRoutes, { prefix: '/pool' }); // Safety endpoints at /pool/limits, /pool/issuer/:address/exposure
    await app.register(registerTruthRoutes, { prefix: '/truth' }); // Truth endpoints at /truth/pool, /truth/invoice/:id, /truth/lp/:wallet
    await app.register(registerAdminRoutes, { prefix: '/admin' }); // Admin endpoints
}

