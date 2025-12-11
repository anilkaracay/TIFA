import { FastifyInstance } from 'fastify';
import { registerInvoiceRoutes } from './invoices';
import { registerCompanyRoutes } from './companies';
import { registerAgentRoutes } from "./agent";

export async function registerRoutes(app: FastifyInstance) {
    await app.register(registerInvoiceRoutes, { prefix: '/invoices' });
    await app.register(registerCompanyRoutes, { prefix: '/companies' });
    await app.register(registerAgentRoutes, { prefix: '/agent' });
}
