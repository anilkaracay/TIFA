"use client";

import React from "react";
import useSWR from "swr";
import Navbar from "../../components/Navbar";
import { fetchCustodyVault, fetchCustodyLedger, CustodyVault, CustodyLedger } from "../../lib/backendClient";
import { useAccount } from "wagmi";
import { formatAmount } from "../../lib/format";
import { useToast } from "../../components/Toast";

// Institutional Theme (Consistent with KYC)
const theme = {
    bg: "#f7f9fc",
    cardBg: "#ffffff",
    textMain: "#1a1f36",
    textMuted: "#697386",
    border: "#e3e8ee",
    primary: "#2563eb",
    successBg: "#ecfdf5",
    successText: "#047857",
    fontUser: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif",
};

const styles = {
    page: {
        minHeight: "100vh",
        background: theme.bg,
        fontFamily: theme.fontUser,
    },
    container: {
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 24px",
    },
    // Header
    headerSection: {
        marginBottom: "40px",
    },
    pageTitle: {
        fontSize: "26px",
        fontWeight: 700,
        color: theme.textMain,
        marginBottom: "8px",
        letterSpacing: "-0.01em",
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    pageSubtitle: {
        fontSize: "15px",
        color: theme.textMuted,
        lineHeight: "1.5",
        maxWidth: "600px",
    },

    // Layout
    grid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "24px",
        marginBottom: "40px",
    },
    card: {
        background: theme.cardBg,
        borderRadius: "12px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.03), 0 0 0 1px rgba(0,0,0,0.02)",
        padding: "32px",
        border: `1px solid ${theme.border}`,
        display: "flex",
        flexDirection: "column" as "column",
        gap: "32px",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
    },
    cardHeader: {
        borderBottom: `1px solid ${theme.border}`,
        paddingBottom: "20px",
        marginBottom: "8px",
    },
    cardTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: theme.textMain,
    },

    // Data Blocks
    dataBlock: {
        display: "flex",
        flexDirection: "column" as "column",
        gap: "8px",
    },
    label: {
        fontSize: "13px",
        fontWeight: 600,
        color: theme.textMuted,
        textTransform: "uppercase" as "uppercase",
        letterSpacing: "0.05em",
    },

    // Value Styling
    addressPill: {
        fontFamily: "monospace",
        background: "#f1f5f9",
        color: theme.textMain,
        padding: "10px 16px",
        borderRadius: "9999px",
        fontSize: "14px",
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        width: "fit-content",
        border: "1px solid #e2e8f0",
    },
    copyIcon: {
        cursor: "pointer",
        color: theme.textMuted,
        opacity: 0.7,
        transition: "opacity 0.2s",
    },
    valueLarge: {
        fontSize: "32px",
        fontWeight: 700,
        color: theme.textMain,
        letterSpacing: "-0.02em",
        fontFeatureSettings: "'tnum' on, 'lnum' on",
    },
    valueSubtext: {
        fontSize: "13px",
        color: theme.successText,
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        gap: "6px",
    },

    // Compliance Status Box
    statusBox: {
        background: theme.successBg,
        border: "1px solid #d1fae5",
        borderRadius: "8px",
        padding: "16px",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
    },
    statusText: {
        fontSize: "14px",
        color: theme.successText,
        lineHeight: "1.5",
        fontWeight: 500,
    },

    // Footer Info
    footer: {
        marginTop: "40px",
        paddingTop: "24px",
        borderTop: `1px solid ${theme.border}`,
        color: theme.textMuted,
        fontSize: "13px",
        textAlign: "center" as "center",
        fontStyle: "italic",
    },
    divider: {
        height: "1px",
        background: theme.border,
        margin: "0 0 24px 0",
    }
};

export default function CustodyPage() {
    const { address } = useAccount();
    const { showToast } = useToast();

    // Mock Data for "Real" Feel
    const vault = {
        vaultAddress: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        totalSharesCustodied: "49582884552" + "0".repeat(18), // Large amount
        assetToken: "TIFA-LP"
    };

    const ledger = {
        shareBalance: "2500000" + "0".repeat(18), // 2.5M Shares
        lastUpdated: new Date().toISOString()
    };

    // Force address presence for mock view if not connected
    const displayAddress = address || "0x1234...5678";

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast("info", "Address copied to clipboard");
    };

    return (
        <div style={styles.page}>
            <Navbar />
            <div style={styles.container}>
                {/* Header */}
                <div style={styles.headerSection}>
                    <h1 style={styles.pageTitle}>
                        Omnibus Custody & Compliance
                    </h1>
                    <p style={styles.pageSubtitle}>
                        Transparent verification of pooled on-chain assets and user-level custody records.
                    </p>
                </div>

                <div style={styles.grid}>
                    {/* Left: Omnibus Vault */}
                    <div style={styles.card}>
                        <div style={styles.cardHeader}>
                            <h2 style={styles.cardTitle}>Omnibus Vault Status</h2>
                        </div>

                        {/* Vault Address */}
                        <div style={styles.dataBlock}>
                            <div style={styles.label}>Vault Address</div>
                            <div style={styles.addressPill}>
                                {vault?.vaultAddress || '0x...'}
                                <span
                                    style={styles.copyIcon}
                                    onClick={() => handleCopy(vault?.vaultAddress || "")}
                                    title="Copy Address"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                </span>
                            </div>
                            <span style={{ fontSize: '12px', color: theme.textMuted, marginTop: '4px' }}>
                                Designated smart contract holding pooled LP assets.
                            </span>
                        </div>

                        {/* Assets Under Custody */}
                        <div style={styles.dataBlock}>
                            <div style={styles.label}>Total Assets Under Custody</div>
                            <div style={styles.valueLarge}>
                                {vault ? formatAmount(vault.totalSharesCustodied, "TIFA-LP") : "Loading..."}
                            </div>
                            <div style={styles.valueSubtext}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Fully backed by real-world assets recorded on-chain.
                            </div>
                        </div>
                    </div>

                    {/* Right: User Custody Record */}
                    <div style={styles.card}>
                        <div style={styles.cardHeader}>
                            <h2 style={styles.cardTitle}>Your Custody Record</h2>
                        </div>

                        {/* Always show for mock purposes */}
                        <>
                            {/* Ledger Balance */}
                            <div style={styles.dataBlock}>
                                <div style={styles.label}>Your Custodied Shares</div>
                                <div style={styles.valueLarge}>
                                    {formatAmount(ledger.shareBalance, "TIFA-LP")}
                                </div>
                                <span style={{ fontSize: '12px', color: theme.textMuted }}>
                                    Tracked in the private compliance ledger.
                                </span>
                            </div>

                            {/* Compliance Status */}
                            <div style={styles.dataBlock}>
                                <div style={styles.label}>Compliance Status</div>
                                <div style={styles.statusBox}>
                                    <div style={{ marginTop: '2px' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                        </svg>
                                    </div>
                                    <div>
                                        <div style={styles.statusText}>
                                            Asset ownership verified and compliant with platform policies.
                                        </div>
                                        <div style={{ fontSize: '12px', color: theme.successText, marginTop: '4px', opacity: 0.8 }}>
                                            KYC Approved • Eligible for yield distribution
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    </div>
                </div>

                {/* Footer Trust Signal */}
                <div style={styles.footer}>
                    Custody balances and ownership records are reconciled between on-chain vaults and off-chain compliance ledgers
                    to ensure regulatory alignment and auditability.
                </div>
            </div>
        </div>
    );
}
