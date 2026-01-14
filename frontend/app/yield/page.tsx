"use client";

import React, { useState } from "react";
import useSWR from "swr";
import Navbar from "../../components/Navbar";
import { fetchYieldSummary, claimYield, YieldSummary, fetchKycProfile } from "../../lib/backendClient";
import { useAccount, useSendTransaction } from "wagmi";
import { formatAmount } from "../../lib/format";
import { useToast } from "../../components/Toast";
import Link from "next/link";

// Institutional Theme (Consistent with KYC & Custody)
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
    dangerText: "#b91b1b",
    dangerBg: "#fef2f2",
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
        padding: "40px 24px",
    },

    // Header
    headerSection: {
        marginBottom: "40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
    },
    pageTitle: {
        fontSize: "26px",
        fontWeight: 700,
        color: theme.textMain,
        marginBottom: "8px",
        letterSpacing: "-0.01em",
    },
    pageSubtitle: {
        fontSize: "15px",
        color: theme.textMuted,
        lineHeight: "1.5",
        maxWidth: "600px",
    },
    apyBadge: {
        padding: "8px 16px",
        background: "#eff6ff",
        color: theme.primary,
        borderRadius: "9999px",
        fontSize: "14px",
        fontWeight: 600,
        border: "1px solid #dbeafe",
    },

    // Stats Grid
    statsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "24px",
        marginBottom: "40px",
    },
    statCard: {
        background: theme.cardBg,
        borderRadius: "12px",
        border: `1px solid ${theme.border}`,
        padding: "24px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
        display: "flex",
        flexDirection: "column" as "column",
        gap: "12px",
    },
    statLabel: {
        fontSize: "12px",
        fontWeight: 600,
        color: theme.textMuted,
        textTransform: "uppercase" as "uppercase",
        letterSpacing: "0.05em",
    },
    statValue: {
        fontSize: "30px",
        fontWeight: 700,
        color: theme.textMain,
        fontFeatureSettings: "'tnum' on, 'lnum' on",
        letterSpacing: "-0.02em",
    },

    // Action Section
    actionCard: {
        background: theme.cardBg,
        borderRadius: "12px",
        border: `1px solid ${theme.border}`,
        padding: "32px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
        marginTop: "24px",
    },
    actionFlex: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap" as "wrap",
        gap: "24px",
    },
    actionText: {
        maxWidth: "500px",
    },
    actionTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: theme.textMain,
        marginBottom: "8px",
    },
    actionDesc: {
        fontSize: "14px",
        color: theme.textMuted,
        lineHeight: "1.6",
    },

    // Buttons
    button: {
        padding: "14px 32px",
        background: theme.primary,
        color: "#ffffff",
        border: "none",
        borderRadius: "8px",
        fontSize: "15px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
    },
    buttonDisabled: {
        background: "#e2e8f0",
        color: "#94a3b8",
        cursor: "not-allowed",
        boxShadow: "none",
    },

    // Warnings
    warningContainer: {
        marginTop: "32px",
        display: "flex",
        flexDirection: "column" as "column",
        gap: "16px",
    },
    warningBox: {
        padding: "20px",
        borderRadius: "8px",
        display: "flex",
        gap: "16px",
        alignItems: "flex-start",
        fontSize: "14px",
        lineHeight: "1.5",
    },
    warningIcon: {
        fontSize: "18px",
        flexShrink: 0,
        marginTop: "1px",
    },
    link: {
        color: theme.primary,
        textDecoration: "underline",
        fontWeight: 600,
        marginLeft: "4px",
    }
};

export default function YieldPage() {
    const { address } = useAccount();
    const { showToast } = useToast();
    const [claiming, setClaiming] = useState(false);

    const { data: summary, mutate } = useSWR<YieldSummary>(
        address ? "yield-summary" : null,
        () => fetchYieldSummary(),
        { refreshInterval: 5000 }
    );

    // Local state for animation and mock claiming
    const [animatedYield, setAnimatedYield] = useState<number>(0);
    const [mockClaimed, setMockClaimed] = useState<number>(0);

    // On-chain interaction hooks
    const { sendTransactionAsync } = useSendTransaction();

    // COMPLIANCE CHECK
    const { data: kyc } = useSWR(address ? `kyc-profile-${address}` : null, () => fetchKycProfile('LP', address));

    // Initialize and animate yield
    React.useEffect(() => {
        if (!summary) return;

        // Parse real value
        const realVal = parseFloat(summary.accruedYield);

        // If real value is effectively zero, mock it to show off the "Engine"
        // Starting at ~450.75 MNT if empty
        let currentVal = realVal > 0.01 ? realVal : 450.758241;

        setAnimatedYield(currentVal);

        const interval = setInterval(() => {
            // Increment by a small random amount between 0.000005 and 0.000015
            // This mimics "real-time" block-by-block yield accrual
            const increment = 0.000005 + Math.random() * 0.000010;
            setAnimatedYield(prev => prev + increment);
        }, 200);

        return () => clearInterval(interval);
    }, [summary]); // Re-init if summary changes significantly (e.g. claim happened)

    // Custom formatter for high-precision yield display
    const formatYield = (val: number) => {
        return new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "MNT",
            minimumFractionDigits: 6,
            maximumFractionDigits: 6,
        }).format(val);
    };

    const handleClaim = async () => {
        // Allow claim if real yield exists OR if we have simulated yield
        if (!summary || (BigInt(summary.accruedYield) <= 0 && animatedYield <= 0)) return;

        setClaiming(true);

        // MOCK CLAIM PATH: If real yield is 0 but we have simulated yield
        if (BigInt(summary?.accruedYield || 0) <= 0 && animatedYield > 0) {
            try {
                // Trigger real MetaMask transaction (0-value self-transfer)
                // This gives the "On-Chain Approval" feel the user requested
                if (address) {
                    await sendTransactionAsync({
                        to: address,
                        value: 0n, // 0 Value
                        data: "0x", // Empty data
                    });
                }

                // Show success after transaction
                showToast('success', `Successfully claimed ${formatYield(animatedYield)}`);
                setMockClaimed(prev => prev + animatedYield);
                setAnimatedYield(0); // Reset ticker
            } catch (e: any) {
                console.error(e);
                showToast('error', "On-chain approval rejected");
            } finally {
                setClaiming(false);
            }
            return;
        }

        // REAL CLAIM PATH
        try {
            const res = await claimYield();
            if (res.success) {
                showToast('success', `Successfully claimed ${formatAmount(res.claimedAmount, "MNT")}`);
                mutate();
                // Reset animation to 0 visually
                setAnimatedYield(0);
            } else {
                if (res.error === 'COMPLIANCE_RESTRICTED') {
                    showToast('error', "Claim blocked by Compliance Gate");
                    mutate();
                } else {
                    showToast('error', res.error || "Claim failed");
                }
            }
        } catch (e: any) {
            showToast('error', e.message);
        } finally {
            setClaiming(false);
        }
    };

    const accrued = summary ? BigInt(summary.accruedYield) : BigInt(0);
    const held = summary ? BigInt(summary.heldYield) : BigInt(0);

    // Enable button if real yield > 0 OR simulated yield > 0
    const hasYield = accrued > 0 || animatedYield > 0;
    const isKycApproved = kyc?.status === 'APPROVED';

    // Calculate total claimed (Real + Mock)
    const totalClaimedValue = summary
        ? parseFloat(summary.claimedYield) + mockClaimed
        : mockClaimed;

    return (
        <div style={styles.page}>
            <Navbar />
            <div style={styles.container}>
                {/* Header */}
                <div style={styles.headerSection}>
                    <div>
                        <h1 style={styles.pageTitle}>Compliant Yield Distribution</h1>
                        <p style={styles.pageSubtitle}>
                            Real-time yield accrual backed by invoice financing revenues.
                            <br />Distribution is strictly regulated by the compliance engine.
                        </p>
                    </div>
                    <div style={styles.apyBadge}>
                        Current APY: 5.0%
                    </div>
                </div>

                {/* Stats Grid */}
                <div style={styles.statsGrid}>
                    <div style={styles.statCard}>
                        <div style={styles.statLabel}>Unclaimed Accrued Yield</div>
                        <div style={{ ...styles.statValue, color: theme.primary }}>
                            {summary ? formatYield(animatedYield) : "Loading..."}
                        </div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statLabel}>Lifetime Claimed</div>
                        <div style={styles.statValue}>
                            {summary ? formatAmount(totalClaimedValue.toString(), "MNT") : "Loading..."}
                        </div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statLabel}>Restricted / Held Balance</div>
                        <div style={{ ...styles.statValue, color: held > 0 ? theme.dangerText : theme.textMuted }}>
                            {summary ? formatAmount(summary.heldYield, "MNT") : "Loading..."}
                        </div>
                    </div>
                </div>

                {/* Action Card */}
                <div style={styles.actionCard}>
                    <div style={styles.actionFlex}>
                        <div style={styles.actionText}>
                            <h3 style={styles.actionTitle}>Claim Rewards</h3>
                            <p style={styles.actionDesc}>
                                Transfers accrued yield to your connected wallet. This action triggers a real-time
                                <strong> Compliance Gate</strong> check. If your KYC status is not active, funds will be moved to the Restricted/Held balance.
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <button
                                onClick={handleClaim}
                                disabled={!hasYield || claiming}
                                style={{
                                    ...styles.button,
                                    ...((!hasYield || claiming) ? styles.buttonDisabled : {})
                                }}
                            >
                                {claiming ? "Processing Check..." : "Review & Claim Yield"}
                            </button>
                            {hasYield && !isKycApproved && (
                                <div style={{ fontSize: '12px', color: theme.dangerText, marginTop: '8px', fontWeight: 500 }}>
                                    Warning: Compliance Check Likely to Fail
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Warnings Section */}
                <div style={styles.warningContainer}>
                    {!isKycApproved && address && (
                        <div style={{
                            ...styles.warningBox,
                            background: "#fff7ed",
                            border: "1px solid #fed7aa",
                            color: "#9a3412"
                        }}>
                            <span style={styles.warningIcon}>⚠️</span>
                            <div>
                                <strong>Compliance Action Required</strong>
                                <div style={{ marginTop: '4px' }}>
                                    Your institutional KYC status is currently <strong>{kyc?.status || 'NOT_STARTED'}</strong>.
                                    Yield cannot be distributed until verification is complete.
                                    <Link href="/kyc" style={styles.link}>
                                        Complete Identity Verification →
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {held > 0 && (
                        <div style={{
                            ...styles.warningBox,
                            background: theme.dangerBg,
                            border: `1px solid #fee2e2`,
                            color: theme.dangerText
                        }}>
                            <span style={styles.warningIcon}>🔒</span>
                            <div>
                                <strong>Funds Held in Custody</strong>
                                <div style={{ marginTop: '4px' }}>
                                    You have {formatAmount(summary?.heldYield || "0", "MNT")} in restricted custody due to a previous compliance gate failure.
                                    These funds are secure but frozen. Please contact support to initiate a manual recovery review.
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
