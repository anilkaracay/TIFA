"use client";

import React from "react";
import Link from "next/link";
import useSWR from "swr";
import Navbar from "../../components/Navbar";
import { fetchKycProfile } from "../../lib/backendClient";
import { useAccount } from "wagmi";

// Institutional Theme
const theme = {
    bg: "#f7f9fc",
    cardBg: "#ffffff",
    textMain: "#1a1f36",
    textMuted: "#697386",
    border: "#e3e8ee",
    primary: "#2563eb",
    primaryHover: "#1d4ed8",
    successText: "#047857",
    successBg: "#ecfdf5",
    warningText: "#b45309",
    warningBg: "#fffbeb",
    fontUser: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif",
};

const styles = {
    page: {
        minHeight: "100vh",
        background: theme.bg,
        fontFamily: theme.fontUser,
    },
    container: {
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "60px 24px",
    },

    // Header
    header: {
        textAlign: "center" as "center",
        marginBottom: "40px",
    },
    title: {
        fontSize: "32px",
        fontWeight: 700,
        color: theme.textMain,
        marginBottom: "12px",
        letterSpacing: "-0.01em",
    },
    subtitle: {
        fontSize: "18px",
        color: theme.textMuted,
        lineHeight: "1.5",
        maxWidth: "600px",
        margin: "0 auto 8px auto",
    },
    caption: {
        fontSize: "13px",
        color: theme.textMuted,
        opacity: 0.8,
        letterSpacing: "0.02em",
    },

    // Status Strip
    statusStrip: {
        display: "flex",
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: "12px",
        padding: "20px 32px",
        marginBottom: "48px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
        alignItems: "center",
        justifyContent: "space-between",
    },
    statusItem: {
        flex: 1,
        display: "flex",
        flexDirection: "column" as "column",
        gap: "6px",
        borderRight: `1px solid ${theme.border}`,
        paddingRight: "24px",
    },
    lastStatusItem: {
        borderRight: "none",
        paddingRight: 0,
        paddingLeft: "24px",
        alignItems: "flex-end", // Align text right for the last item? Or keep left. Let's keep flex-start but maybe pad.
        // Actually, let's keep all standard left aligned for consistency.
    },
    statusLabel: {
        fontSize: "12px",
        fontWeight: 600,
        color: theme.textMuted,
        textTransform: "uppercase" as "uppercase",
        letterSpacing: "0.05em",
    },
    statusValue: {
        fontSize: "15px",
        fontWeight: 600,
        color: theme.textMain,
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    statusSubtext: {
        fontSize: "13px",
        color: theme.textMuted,
    },
    badge: (color: string, bg: string) => ({
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: "9999px",
        fontSize: "12px",
        fontWeight: 600,
        color: color,
        backgroundColor: bg,
    }),

    // Modules Grid
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "32px",
    },
    card: {
        background: theme.cardBg,
        borderRadius: "16px",
        padding: "32px",
        border: `1px solid ${theme.border}`,
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.03)",
        transition: "all 0.2s ease",
        display: "flex",
        flexDirection: "column" as "column",
        height: "100%",
        textDecoration: "none",
        position: "relative" as "relative",
    },
    iconBox: {
        width: "48px",
        height: "48px",
        borderRadius: "12px",
        background: "#f0fdf4", // vary by card? let's stick to theme or light blue
        color: theme.textMain,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "24px",
        border: `1px solid ${theme.border}`,
    },
    cardTitle: {
        fontSize: "18px",
        fontWeight: 700,
        color: theme.textMain,
        marginBottom: "12px",
    },
    cardDesc: {
        fontSize: "15px",
        color: theme.textMuted,
        lineHeight: "1.6",
        marginBottom: "32px",
        flex: 1, // pushes footer down
    },
    cardFooter: {
        paddingTop: "20px",
        borderTop: `1px solid ${theme.border}`,
        display: "flex",
        alignItems: "center",
        color: theme.primary,
        fontWeight: 600,
        fontSize: "15px",
        gap: "6px",
    },
};

export default function ComplianceHubPage() {
    const { address } = useAccount();
    const { data: profile } = useSWR(address ? "kyc-profile" : null, () => fetchKycProfile());

    const status = profile?.status || 'NOT_STARTED';
    const isApproved = status === 'APPROVED';

    return (
        <div style={styles.page}>
            <Navbar />

            <div style={styles.container}>
                {/* Header */}
                <div style={styles.header}>
                    <h1 style={styles.title}>Compliance & Custody Center</h1>
                    <p style={styles.subtitle}>
                        Manage identity verification, monitor institutional custody, and access compliant yield distribution.
                    </p>
                    <div style={styles.caption}>
                        All critical financial actions are governed by real-time compliance and audit controls.
                    </div>
                </div>

                {/* Status Strip */}
                <div style={styles.statusStrip}>
                    {/* Identity Status */}
                    <div style={styles.statusItem}>
                        <div style={styles.statusLabel}>KYC Status</div>
                        <div>
                            {status === 'APPROVED' ? (
                                <span style={styles.badge(theme.successText, theme.successBg)}>
                                    ● APPROVED
                                </span>
                            ) : status === 'PENDING' ? (
                                <span style={styles.badge(theme.warningText, theme.warningBg)}>
                                    ● PENDING
                                </span>
                            ) : (
                                <span style={styles.badge(theme.textMuted, "#f3f4f6")}>
                                    ● NOT UTARTED
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Custody Model */}
                    <div style={styles.statusItem}>
                        <div style={styles.statusLabel}>Custody</div>
                        <div style={styles.statusValue}>Omnibus Vault</div>
                        <div style={styles.statusSubtext}>On-chain pooled custody</div>
                    </div>

                    {/* Yield Eligibility */}
                    <div style={{ ...styles.statusItem, borderRight: 'none' }}>
                        <div style={styles.statusLabel}>Yield Eligibility</div>
                        <div style={styles.statusValue}>
                            {isApproved ? (
                                <span style={{ color: theme.successText, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    ✓ Eligible
                                </span>
                            ) : (
                                <span style={{ color: theme.textMuted, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    ✕ Restricted
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modules Grid */}
                <div style={styles.grid}>
                    {/* KYC Module */}
                    <Link href="/kyc" style={styles.card} className="module-card">
                        <div style={{ ...styles.iconBox, background: '#eff6ff', color: theme.primary }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </div>
                        <h2 style={styles.cardTitle}>Identity Verification (KYC)</h2>
                        <p style={styles.cardDesc}>
                            Verify your legal entity to access liquidity pools, financing services, and compliant yield distribution.
                        </p>
                        <div style={styles.cardFooter}>
                            Manage Identity →
                        </div>
                    </Link>

                    {/* Custody Module */}
                    <Link href="/custody" style={styles.card} className="module-card">
                        <div style={{ ...styles.iconBox, background: '#f0fdf4', color: '#16a34a' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                        <h2 style={styles.cardTitle}>Omnibus Custody</h2>
                        <p style={styles.cardDesc}>
                            Audit on-chain assets in the omnibus vault and verify your personal shadow ledger balance records.
                        </p>
                        <div style={{ ...styles.cardFooter, color: '#16a34a' }}>
                            View Custody Records →
                        </div>
                    </Link>

                    {/* Yield Module */}
                    <Link href="/yield" style={styles.card} className="module-card">
                        <div style={{ ...styles.iconBox, background: '#fffbeb', color: '#d97706' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                        </div>
                        <h2 style={styles.cardTitle}>Compliant Yield</h2>
                        <p style={styles.cardDesc}>
                            Track accrued returns and claim yield distributions subject to real-time compliance gate checks.
                        </p>
                        <div style={{ ...styles.cardFooter, color: '#d97706' }}>
                            Manage Yield →
                        </div>
                    </Link>
                </div>

                {/* Trust & Controls Section */}
                <div style={{ marginTop: "80px", borderTop: `1px solid ${theme.border}`, paddingTop: "60px" }}>
                    <div style={{ textAlign: "center", marginBottom: "40px" }}>
                        <h2 style={{ fontSize: "22px", fontWeight: 700, color: theme.textMain, marginBottom: "8px" }}>
                            Compliance Enforcement & Audit Controls
                        </h2>
                        <p style={{ fontSize: "15px", color: theme.textMuted }}>
                            How identity, custody, and yield actions are governed across the platform.
                        </p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "40px" }}>
                        {/* Block 1 */}
                        <div>
                            <h3 style={{ fontSize: "16px", fontWeight: 600, color: theme.textMain, marginBottom: "12px" }}>
                                Real-Time Compliance Engine
                            </h3>
                            <p style={{ fontSize: "14px", color: theme.textMuted, lineHeight: "1.6" }}>
                                All critical actions — including yield claims, liquidity access, and payments — are evaluated in real time against identity and eligibility rules.
                            </p>
                        </div>
                        {/* Block 2 */}
                        <div style={{ borderLeft: `1px solid ${theme.border}`, paddingLeft: "40px" }}>
                            <h3 style={{ fontSize: "16px", fontWeight: 600, color: theme.textMain, marginBottom: "12px" }}>
                                Omnibus Custody Verification
                            </h3>
                            <p style={{ fontSize: "14px", color: theme.textMuted, lineHeight: "1.6" }}>
                                Assets are held in a pooled on-chain vault while individual ownership is tracked through a private shadow ledger for audit and reconciliation.
                            </p>
                        </div>
                        {/* Block 3 */}
                        <div style={{ borderLeft: `1px solid ${theme.border}`, paddingLeft: "40px" }}>
                            <h3 style={{ fontSize: "16px", fontWeight: 600, color: theme.textMain, marginBottom: "12px" }}>
                                Audit & Traceability
                            </h3>
                            <p style={{ fontSize: "14px", color: theme.textMuted, lineHeight: "1.6" }}>
                                Every compliance decision and asset movement is logged for audit, reporting, and regulatory review.
                            </p>
                        </div>
                    </div>

                    {/* Final Trust Footer */}
                    <div style={{
                        marginTop: "60px",
                        padding: "24px",
                        background: "#f8fafc",
                        border: `1px solid ${theme.border}`,
                        borderRadius: "8px",
                        textAlign: "center"
                    }}>
                        <p style={{ fontSize: "14px", fontWeight: 500, color: theme.textMain, marginBottom: "4px" }}>
                            This platform is designed for institutional-grade compliance, custody transparency, and controlled yield distribution.
                        </p>
                        <p style={{ fontSize: "13px", color: theme.textMuted, opacity: 0.8 }}>
                            Compliance status directly affects access to financial features and distributions.
                        </p>
                    </div>
                </div>

            </div>

            <style jsx global>{`
                .module-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px -6px rgba(0, 0, 0, 0.08);
                    border-color: ${theme.primary};
                }
            `}</style>
        </div>
    );
}
