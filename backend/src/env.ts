import 'dotenv/config';

export const env = {
    PORT: Number(process.env.PORT ?? 4000),
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    DATABASE_URL: process.env.DATABASE_URL ?? 'file:./dev.db',
    BASE_SEPOLIA_RPC: process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org',
    PRIVATE_KEY: process.env.PRIVATE_KEY ?? '',
    SUBGRAPH_URL: process.env.SUBGRAPH_URL ?? '',
    ADMIN_WALLETS: process.env.ADMIN_WALLETS ?? '',
    RBAC_ENABLED: process.env.RBAC_ENABLED !== 'false', // Default: enabled, set RBAC_ENABLED=false to disable
};
