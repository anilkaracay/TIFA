import { FastifyRequest, FastifyReply } from 'fastify';
import { resolveUserRole } from '../auth/roles';
import { Role } from '../auth/roles';
import { env } from '../env';


declare module 'fastify' {
    interface FastifyRequest {
        role?: Role;
        wallet?: string;
    }
}

/**
 * Extract wallet address from request
 * Supports:
 * - Query parameter: ?wallet=0x...
 * - Header: x-wallet-address
 * - Body: { wallet: '0x...' }
 */
function extractWalletAddress(req: FastifyRequest): string | null {
    // Try query parameter first
    const queryWallet = (req.query as any)?.wallet;
    if (queryWallet && typeof queryWallet === 'string') {
        return queryWallet;
    }

    // Try header
    const headerWallet = req.headers['x-wallet-address'];
    if (headerWallet && typeof headerWallet === 'string') {
        return headerWallet;
    }

    // Try body
    const bodyWallet = (req.body as any)?.wallet;
    if (bodyWallet && typeof bodyWallet === 'string') {
        return bodyWallet;
    }

    return null;
}

/**
 * Role resolution middleware
 * Attaches req.role and req.wallet to request
 * If RBAC is disabled, sets role to ADMIN to allow all actions
 */
export async function roleResolutionMiddleware(
    req: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    // If RBAC is disabled, set role to ADMIN to allow all actions
    if (!env.RBAC_ENABLED) {
        req.role = Role.ADMIN;
        // Try to extract wallet but don't require it
        const walletAddress = extractWalletAddress(req);
        if (walletAddress) {
            req.wallet = walletAddress;
        }
        return;
    }

    const walletAddress = extractWalletAddress(req);

    if (walletAddress) {
        req.wallet = walletAddress;
        try {
            req.role = await resolveUserRole(walletAddress);
        } catch (e: any) {
            console.warn('[RoleAuth] Error resolving role:', e.message);
            req.role = Role.UNKNOWN;
        }
    } else {
        req.role = Role.UNKNOWN;
    }
}

/**
 * Require specific role(s) middleware
 * If RBAC is disabled, allows all requests
 */
export function requireRole(...allowedRoles: Role[]) {
    return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
        // If RBAC is disabled, allow all requests
        if (!env.RBAC_ENABLED) {
            return;
        }

        // First ensure role is resolved
        if (!req.role) {
            await roleResolutionMiddleware(req, reply);
        }

        if (!req.role || !allowedRoles.includes(req.role)) {
            reply.code(403);
            reply.send({
                error: 'ROLE_NOT_ALLOWED',
                message: `This endpoint requires one of: ${allowedRoles.join(', ')}`,
                expectedRole: allowedRoles,
                actualRole: req.role || 'UNKNOWN',
            });
            return;
        }
    };
}

/**
 * Require wallet address middleware
 * If RBAC is disabled, allows all requests
 */
export async function requireWallet(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    // If RBAC is disabled, allow all requests
    if (!env.RBAC_ENABLED) {
        return;
    }

    if (!req.wallet) {
        reply.code(400);
        reply.send({
            error: 'WALLET_REQUIRED',
            message: 'Wallet address is required. Provide via ?wallet=0x... or x-wallet-address header',
        });
        return;
    }
}

