"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { fetchKycProfile, submitKycProfile, KycProfile } from "../../lib/backendClient";
import { useAccount } from "wagmi";
import { useToast } from "../../components/Toast";
import Navbar from "../../components/Navbar";

// Institutional Fintech Theme
const theme = {
    bg: "#f7f9fc", // Very subtle blue-grey
    cardBg: "#ffffff",
    textMain: "#1a1f36", // Stripe-like dark
    textMuted: "#697386", // Slate grey
    border: "#e3e8ee",
    primary: "#2563eb", // Institutional Blue
    primaryHover: "#1d4ed8",
    danger: "#d93025",
    success: "#0b875a",
    focusRing: "rgba(37, 99, 235, 0.2)",
    fontUser: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif",
};

const styles = {
    page: {
        minHeight: "100vh",
        background: theme.bg,
        fontFamily: theme.fontUser,
        display: "flex",
        flexDirection: "column" as "column",
    },
    mainContent: {
        flex: 1,
        display: "flex",
        justifyContent: "center",
        padding: "60px 20px",
    },
    container: {
        width: "100%",
        maxWidth: "560px", // Specific width request
    },
    card: {
        background: theme.cardBg,
        borderRadius: "12px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.03), 0 0 0 1px rgba(0,0,0,0.02)",
        padding: "40px 48px",
        transition: "all 0.2s ease",
    },
    header: {
        marginBottom: "36px",
        textAlign: "left" as "left",
        borderBottom: `1px solid ${theme.border}`,
        paddingBottom: "24px",
        position: "relative" as "relative",
    },
    title: {
        fontSize: "24px",
        fontWeight: 700,
        color: theme.textMain,
        marginBottom: "8px",
        letterSpacing: "-0.01em",
    },
    subtitle: {
        fontSize: "15px",
        color: theme.textMuted,
        lineHeight: "1.5",
        maxWidth: "90%",
    },
    // Status Badge - Pill shaped
    statusBadge: {
        position: "absolute" as "absolute",
        top: "0",
        right: "0",
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 12px",
        borderRadius: "9999px",
        fontSize: "12px",
        fontWeight: 600,
        textTransform: "uppercase" as "uppercase",
        letterSpacing: "0.03em",
    },
    status_NOT_STARTED: { background: "#f3f4f6", color: "#4b5563", border: "1px solid #e5e7eb" },
    status_PENDING: { background: "#fff7ed", color: "#c2410c", border: "1px solid #ffedd5" },
    status_APPROVED: { background: "#ecfdf5", color: "#047857", border: "1px solid #d1fae5" },
    status_REJECTED: { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fee2e2" },

    sectionHeader: {
        fontSize: "11px",
        fontWeight: 700,
        color: theme.textMuted,
        textTransform: "uppercase" as "uppercase",
        letterSpacing: "0.08em",
        marginBottom: "16px",
        marginTop: "12px",
    },
    formGroup: {
        marginBottom: "24px",
    },
    label: {
        display: "block",
        fontSize: "14px",
        fontWeight: 500,
        color: "#374151", // Slightly darker than muted
        marginBottom: "6px",
    },
    input: {
        width: "100%",
        padding: "10px 12px",
        fontSize: "15px",
        color: theme.textMain,
        background: "#ffffff",
        border: `1px solid ${theme.border}`,
        borderRadius: "6px",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        outline: "none",
    },
    inputFocus: {
        borderColor: theme.primary,
        boxShadow: `0 0 0 3px ${theme.focusRing}`,
    },

    // Primary Button
    button: {
        width: "100%",
        padding: "14px",
        background: theme.primary,
        color: "#ffffff",
        border: "none",
        borderRadius: "8px",
        fontSize: "15px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "transform 0.1s, background 0.2s, box-shadow 0.2s",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
        marginTop: "12px",
    },
    buttonDisabled: {
        background: "#e2e8f0",
        color: "#94a3b8",
        cursor: "not-allowed",
        boxShadow: "none",
    },

    // Trust Signals
    trustBox: {
        marginTop: "24px",
        paddingTop: "20px",
        borderTop: `1px solid ${theme.border}`,
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
    },
    trustIcon: {
        color: theme.textMuted,
        flexShrink: 0,
    },
    trustText: {
        fontSize: "12px",
        color: theme.textMuted,
        lineHeight: "1.5",
    },

    // Read only view
    readOnlyField: {
        padding: "12px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "6px",
        color: theme.textMain,
        fontSize: "15px",
    }
};

export default function KycPage() {
    const { address } = useAccount();
    const { showToast } = useToast();
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        legalName: "",
        registrationNumber: "",
        country: "",
        contactName: "",
        contactEmail: ""
    });

    const { data: profile, mutate } = useSWR<KycProfile | null>(
        address ? "kyc-profile" : null,
        () => fetchKycProfile('LP', address)
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await submitKycProfile({
                subjectType: 'LP',
                ...formData
            }, address);
            showToast('success', "Verification submitted successfully");
            mutate();
        } catch (err: any) {
            showToast('error', `Submission failed: ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const status = profile?.status || 'NOT_STARTED';
    const isReadOnly = status !== 'NOT_STARTED' && status !== 'REJECTED';

    // Helper for input styles with simple focus simulation via class/style logic 
    // (using standard style prop for simplicity here, assuming browser default focus ring replacement or specific CSS class if needed. 
    // Since we are using inline styles, we'll rely on CSS 'style' logic or simple focus-visible if avoiding CSS files.
    // For this specific 'Design' request, standard CSS in JS is fine, focus states are best handled by browser or external CSS for perf,
    // but I'll add a simple inline focus handler.)
    const [focusedField, setFocusedField] = useState<string | null>(null);

    const getInputStyle = (fieldName: string) => ({
        ...styles.input,
        ...(focusedField === fieldName ? styles.inputFocus : {})
    });

    return (
        <div style={styles.page}>
            <Navbar />

            <div style={styles.mainContent}>
                <div style={styles.container}>
                    <div style={styles.card}>
                        {/* Header */}
                        <div style={styles.header}>
                            <h1 style={styles.title}>Identity Verification (KYC)</h1>
                            <p style={styles.subtitle}>
                                Complete verification to access liquidity, yield distribution, and financing services.
                            </p>

                            <div style={{
                                ...styles.statusBadge,
                                ...(styles as any)[`status_${status}`] || styles.status_NOT_STARTED
                            }}>
                                Status: {status.replace('_', ' ')}
                            </div>
                        </div>

                        {status === 'REJECTED' && profile?.rejectionReason && (
                            <div style={{
                                background: '#fef2f2',
                                border: '1px solid #fee2e2',
                                padding: '16px',
                                borderRadius: '8px',
                                marginBottom: '24px',
                                color: '#991b1b',
                                fontSize: '14px',
                                display: 'flex',
                                gap: '12px'
                            }}>
                                <span>⚠️</span>
                                <div>
                                    <strong style={{ display: 'block', marginBottom: '4px' }}>Verification Rejected</strong>
                                    {profile.rejectionReason}
                                </div>
                            </div>
                        )}

                        {isReadOnly ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <div style={{ fontSize: '48px', marginBottom: '24px' }}>
                                    {status === 'APPROVED' ? '✅' : '⏳'}
                                </div>
                                <h3 style={{ fontSize: '20px', fontWeight: 600, color: theme.textMain, marginBottom: '12px' }}>
                                    {status === 'APPROVED' ? 'Verification Complete' : 'Under Review'}
                                </h3>
                                <p style={{ color: theme.textMuted, fontSize: '15px', lineHeight: '1.6', maxWidth: '400px', margin: '0 auto' }}>
                                    {status === 'APPROVED'
                                        ? "Your entity has been verified. You now have full access to deposit liquidity, generate yield, and access financing markets."
                                        : "Your information is legally being reviewed by our compliance team. This process typically takes 24-48 hours. You will be notified once complete."}
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                {/* Section 1: Entity Information */}
                                <div style={styles.sectionHeader}>Entity Information</div>

                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Legal / Entity Name</label>
                                    <input
                                        style={getInputStyle('legalName')}
                                        value={formData.legalName}
                                        onChange={e => setFormData({ ...formData, legalName: e.target.value })}
                                        onFocus={() => setFocusedField('legalName')}
                                        onBlur={() => setFocusedField(null)}
                                        required
                                        placeholder="e.g. Acme Capital Ltd."
                                    />
                                </div>

                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Registration Number <span style={{ color: theme.textMuted, fontWeight: 400 }}>(Optional)</span></label>
                                    <input
                                        style={getInputStyle('registrationNumber')}
                                        value={formData.registrationNumber}
                                        onChange={e => setFormData({ ...formData, registrationNumber: e.target.value })}
                                        onFocus={() => setFocusedField('registrationNumber')}
                                        onBlur={() => setFocusedField(null)}
                                        placeholder="e.g. 12345678"
                                    />
                                </div>

                                {/* Section 2: Jurisdiction */}
                                <div style={styles.sectionHeader}>Jurisdiction</div>

                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Country of Incorporation / Residence</label>
                                    <input
                                        style={getInputStyle('country')}
                                        value={formData.country}
                                        onChange={e => setFormData({ ...formData, country: e.target.value })}
                                        onFocus={() => setFocusedField('country')}
                                        onBlur={() => setFocusedField(null)}
                                        required
                                        placeholder="Select country..."
                                    />
                                </div>

                                {/* Section 3: Authorized Contact */}
                                <div style={styles.sectionHeader}>Authorized Contact</div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={styles.formGroup}>
                                        <label style={styles.label}>Contact Name</label>
                                        <input
                                            style={getInputStyle('contactName')}
                                            value={formData.contactName}
                                            onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                                            onFocus={() => setFocusedField('contactName')}
                                            onBlur={() => setFocusedField(null)}
                                            required
                                            placeholder="Full Name"
                                        />
                                    </div>
                                    <div style={styles.formGroup}>
                                        <label style={styles.label}>Contact Email</label>
                                        <input
                                            type="email"
                                            style={getInputStyle('contactEmail')}
                                            value={formData.contactEmail}
                                            onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                                            onFocus={() => setFocusedField('contactEmail')}
                                            onBlur={() => setFocusedField(null)}
                                            required
                                            placeholder="name@company.com"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    style={{
                                        ...styles.button,
                                        ...(submitting ? styles.buttonDisabled : {})
                                    }}
                                    disabled={submitting}
                                >
                                    {submitting ? "Processing..." : "Submit for Verification"}
                                </button>

                                {/* Trust Signals */}
                                <div style={styles.trustBox}>
                                    <div style={styles.trustIcon}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                        </svg>
                                    </div>
                                    <div style={styles.trustText}>
                                        Your information is reviewed by our compliance team and used solely for regulatory verification purposes.
                                        <br />Verification status is required to access yield distribution and LP services.
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
