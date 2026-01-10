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
    // x402 payment configuration
    X402_ENABLED: process.env.X402_ENABLED === 'true',
    X402_CHAIN: process.env.X402_CHAIN ?? 'base',
    X402_CURRENCY: process.env.X402_CURRENCY ?? 'USDC',
    X402_RECIPIENT: process.env.X402_RECIPIENT ?? '',
    X402_TTL_SECONDS: Number(process.env.X402_TTL_SECONDS ?? '300'),
    // Compliance Flags
    COMPLIANCE_ENABLED: process.env.COMPLIANCE_ENABLED === 'true',
    KYC_REQUIRED_FOR_LP: process.env.KYC_REQUIRED_FOR_LP !== 'false', // Default true if compliance enabled
    KYC_REQUIRED_FOR_ISSUER: process.env.KYC_REQUIRED_FOR_ISSUER === 'true',

    // Custody
    OMNIBUS_VAULT_ADDRESS: process.env.OMNIBUS_VAULT_ADDRESS ?? '0x0000000000000000000000000000000000000000',
};
