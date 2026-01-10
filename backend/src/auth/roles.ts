import { prisma } from '../db';
import { env } from '../env';
import { loadContract } from '../onchain/provider';
import { ethers } from 'ethers';

export enum Role {
    ISSUER = 'ISSUER',
    LP = 'LP',
    ADMIN = 'ADMIN',
    UNKNOWN = 'UNKNOWN',
}

/**
 * Resolve user role from wallet address
 * Priority: ADMIN > ISSUER > LP > UNKNOWN
 */
export async function resolveUserRole(walletAddress: string): Promise<Role> {
    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        return Role.UNKNOWN;
    }

    const normalizedAddress = walletAddress.toLowerCase();

    // 1. Check if admin
    const adminWallets = (env.ADMIN_WALLETS || process.env.ADMIN_WALLETS || '').split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
    if (adminWallets.includes(normalizedAddress)) {
        return Role.ADMIN;
    }

    // 2. Check if issuer (linked to Company)
    try {
        const company = await prisma.company.findFirst({
            where: {
                OR: [
                    { id: normalizedAddress }, // Company ID might be wallet address
                    { externalId: normalizedAddress }, // Or external ID
                ],
            },
        });

        // Also check if wallet is issuer of any invoice
        const invoiceAsIssuer = await prisma.invoice.findFirst({
            where: {
                // Check if invoiceIdOnChain matches or if we have issuer mapping
                // For now, we'll check if company exists
            },
            include: { company: true },
        });

        // More direct: check if any invoice has this wallet as issuer (from on-chain)
        // Since we don't store issuer wallet directly, we check via company
        if (company) {
            return Role.ISSUER;
        }
    } catch (e) {
        console.warn('[RoleResolver] Error checking issuer:', e);
    }

    // 3. Check if LP (holds LP shares)
    try {
        const LPShareToken = loadContract('LPShareToken');
        const balance = await LPShareToken.balanceOf(walletAddress);
        if (balance.gt(0)) {
            return Role.LP;
        }
    } catch (e) {
        console.warn('[RoleResolver] Error checking LP:', e);
    }

    // 4. Default to UNKNOWN
    return Role.UNKNOWN;
}

/**
 * Check if user has required role(s)
 */
export function hasRole(userRole: Role, requiredRoles: Role[]): boolean {
    return requiredRoles.includes(userRole);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: Role): string {
    switch (role) {
        case Role.ISSUER:
            return 'Issuer';
        case Role.LP:
            return 'Liquidity Provider';
        case Role.ADMIN:
            return 'Admin';
        case Role.UNKNOWN:
            return 'Guest';
        default:
            return 'Unknown';
    }
}

/**
 * Get role description
 */
export function getRoleDescription(role: Role): string {
    switch (role) {
        case Role.ISSUER:
            return 'Issue and manage invoices, draw credit';
        case Role.LP:
            return 'Provide liquidity and earn yield';
        case Role.ADMIN:
            return 'Manage protocol parameters and emergency controls';
        case Role.UNKNOWN:
            return 'Read-only access';
        default:
            return '';
    }
}









