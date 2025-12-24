export enum Role {
    ISSUER = 'ISSUER',
    LP = 'LP',
    ADMIN = 'ADMIN',
    UNKNOWN = 'UNKNOWN',
}

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

import { fetchUserRole } from './backendClient';

export async function resolveUserRole(walletAddress: string): Promise<Role> {
    if (!walletAddress) return Role.UNKNOWN;
    
    try {
        const data = await fetchUserRole(walletAddress);
        return (data.role as Role) || Role.UNKNOWN;
    } catch (e) {
        console.warn('[RoleResolver] Failed to resolve role:', e);
        return Role.UNKNOWN;
    }
}

