import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './env';
import { registerRoutes } from './routes';

async function main() {
    const app = Fastify({ logger: true });

    await app.register(cors, {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    });

    await app.register(swagger, {
        openapi: {
            info: {
                title: 'TIFA API',
                version: '1.0.0',
            },
        },
    });

    await app.register(swaggerUi, {
        routePrefix: '/docs',
    });

    await registerRoutes(app);

    // Start Listeners
    try {
        const { startEventListeners } = require('./onchain/listener');
        startEventListeners();
    } catch (e) {
        console.warn("Retrying listener setup or skipping if provider unavailable:", e);
    }

    try {
        const address = await app.listen({ port: env.PORT, host: '0.0.0.0' });
        console.log(`TIFA backend running at ${address}`);
        console.log(`Swagger docs at ${address}/docs`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

main();
