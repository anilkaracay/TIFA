import React, { useState } from 'react';
import { useKyc } from '@/hooks/useKyc';
import { KycStatusBanner } from './KycStatusBanner';
import { KycSubmissionModal } from './KycSubmissionModal';

interface KycGuardProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    subjectType?: 'LP' | 'ISSUER';
    requireApproved?: boolean; // If true, hides children completely. If false, might show children with a banner warning.
}

export const KycGuard: React.FC<KycGuardProps> = ({
    children,
    fallback,
    subjectType = 'LP',
    requireApproved = true
}) => {
    const { profile, loading, isApproved, refreshKyc } = useKyc(subjectType);
    const [showModal, setShowModal] = useState(false);

    if (loading) {
        return <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>Checking compliance status...</div>;
    }

    // Logic:
    // If approved -> Show children
    // If not approved AND requireApproved -> Show Banner (and hide children)
    // If not approved AND !requireApproved -> Show children + Banner (optional, but for now we focus on blocking)

    if (isApproved) {
        return <>{children}</>;
    }

    if (requireApproved) {
        // Render fallback or standard banner
        if (fallback) return <>{fallback}</>;

        return (
            <div style={{ padding: '40px 0', width: '100%' }}>
                <KycStatusBanner
                    status={profile?.status}
                    rejectionReason={profile?.rejectionReason}
                    onStartVerification={() => setShowModal(true)}
                />

                <KycSubmissionModal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        refreshKyc();
                        setShowModal(false);
                    }}
                    subjectType={subjectType}
                />
            </div>
        );
    }

    // If not strict, render children (perhaps with a banner inserted by parent)
    return <>{children}</>;
};
