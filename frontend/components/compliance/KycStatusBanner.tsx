import React from 'react';

interface KycStatusBannerProps {
    status?: 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW';
    rejectionReason?: string;
    onStartVerification: () => void;
    compact?: boolean;
}

export const KycStatusBanner: React.FC<KycStatusBannerProps> = ({
    status = 'NOT_STARTED',
    rejectionReason,
    onStartVerification,
    compact = false
}) => {
    if (status === 'APPROVED') return null; // Don't show anything if approved

    const containerStyle = {
        padding: compact ? '12px' : '16px',
        borderRadius: '8px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...getStyles(status)
    };

    return (
        <div style={containerStyle}>
            <div>
                <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getIcon(status)}
                    {getTitle(status)}
                </div>
                {!compact && (
                    <div style={{ fontSize: '13px', marginTop: '4px', opacity: 0.9 }}>
                        {getDescription(status, rejectionReason)}
                    </div>
                )}
            </div>

            {status === 'NOT_STARTED' && (
                <button
                    onClick={onStartVerification}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#0ea5e9', // Sky blue
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        marginLeft: '16px'
                    }}
                >
                    Verify Now &rarr;
                </button>
            )}

            {status === 'REJECTED' && (
                <button
                    onClick={onStartVerification} // Allow retry?
                    style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(0,0,0,0.1)',
                        background: 'rgba(255,255,255,0.2)',
                        color: 'inherit',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        marginLeft: '16px'
                    }}
                >
                    Retry
                </button>
            )}
        </div>
    );
};

function getStyles(status: string) {
    switch (status) {
        case 'NOT_STARTED':
            return { background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }; // Blue
        case 'PENDING':
        case 'PENDING_REVIEW':
            return { background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309' }; // Yellow
        case 'REJECTED':
            return { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }; // Red
        default:
            return {};
    }
}

function getIcon(status: string) {
    switch (status) {
        case 'NOT_STARTED': return '🛡️';
        case 'PENDING':
        case 'PENDING_REVIEW': return '⏳';
        case 'REJECTED': return '❌';
        default: return '';
    }
}

function getTitle(status: string) {
    switch (status) {
        case 'NOT_STARTED': return 'Identity Verification Required';
        case 'PENDING':
        case 'PENDING_REVIEW': return 'Verification in Progress';
        case 'REJECTED': return 'Verification Failed';
        default: return '';
    }
}

function getDescription(status: string, reason?: string) {
    switch (status) {
        case 'NOT_STARTED':
            return 'You must complete KYC verification to access financial services.';
        case 'PENDING':
        case 'PENDING_REVIEW':
            return 'Your documents are being reviewed. This usually takes 1-24 hours.';
        case 'REJECTED':
            return reason ? `Reason: ${reason}` : 'Your application was rejected. Please contact support.';
        default: return '';
    }
}
