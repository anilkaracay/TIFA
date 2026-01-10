"use client";

import React from 'react';
import { Role } from '../../lib/roles';
import { useAccount } from 'wagmi';
import useSWR from 'swr';
import { resolveUserRole } from '../../lib/roles';

interface RoleGateProps {
    allowed: Role[];
    children: React.ReactNode;
    fallback?: React.ReactNode;
    showDisabled?: boolean;
    disabledMessage?: string;
}

export function RoleGate({ 
    allowed, 
    children, 
    fallback = null,
    showDisabled = false,
    disabledMessage 
}: RoleGateProps) {
    const { address } = useAccount();
    
    const { data: role, isLoading } = useSWR<Role>(
        address ? ['user-role', address] : null,
        () => resolveUserRole(address!),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    if (!address) {
        return showDisabled ? (
            <div style={{ opacity: 0.5, pointerEvents: 'none' }} title="Connect wallet to access">
                {children}
            </div>
        ) : fallback;
    }

    if (isLoading) {
        return null; // Or loading spinner
    }

    const hasAccess = role && allowed.includes(role);

    if (!hasAccess) {
        if (showDisabled) {
            const message = disabledMessage || `This action requires: ${allowed.join(' or ')}`;
            return (
                <div style={{ opacity: 0.5, pointerEvents: 'none' }} title={message}>
                    {children}
                </div>
            );
        }
        return fallback;
    }

    return <>{children}</>;
}









