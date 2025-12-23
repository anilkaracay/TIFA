import { FastifyInstance } from 'fastify';
import { registerInvoiceRoutes } from './invoices';
import { registerCompanyRoutes } from './companies';
import { registerAgentRoutes } from "./agent";
import { registerAnalyticsRoutes } from './analytics';
import { registerLPRoutes } from './lp';

export async function registerRoutes(app: FastifyInstance) {
    await app.register(registerInvoiceRoutes, { prefix: '/invoices' });
    await app.register(registerCompanyRoutes, { prefix: '/companies' });
    await app.register(registerAgentRoutes, { prefix: '/agent' });
    await app.register(registerAnalyticsRoutes, { prefix: '/analytics' });
    await app.register(registerLPRoutes, { prefix: '/lp' });
    await app.register(registerLPRoutes, { prefix: '/pool' }); // Pool overview at /pool/overview
}

