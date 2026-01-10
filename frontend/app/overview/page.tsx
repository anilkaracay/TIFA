"use client";

import { useChainId } from "wagmi";

import React, { useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { fetchInvoices, fetchPoolOverview, fetchPoolLimits, PoolOverview, PoolLimits, Invoice } from "../../lib/backendClient";
import { formatAmount, formatDate } from "../../lib/format";
import { useWebSocket } from "../../lib/websocketClient";
import AILifecycleSlider from "../../components/ai/AILifecycleSlider";
import LiveBadge from "../../components/ai/LiveBadge";

// Premium light fintech styling
const styles = {
    page: {
        minHeight: "100vh",
        background: "#f8f9fa",
        padding: "0",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
    },
    navbar: {
        background: "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
        padding: "0 48px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        height: "72px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        position: "sticky" as const,
        top: 0,
        zIndex: 1000,
    },
    navLeft: {
        display: "flex",
        alignItems: "center",
        gap: "48px",
    },
    navTitle: {
        fontSize: "22px",
        fontWeight: 700,
        color: "#0f172a",
        letterSpacing: "-0.02em",
        background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
    },
    navLinks: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
    },
    navLink: {
        textDecoration: "none",
        color: "#64748b",
        fontSize: "15px",
        fontWeight: 500,
        padding: "10px 16px",
        borderRadius: "8px",
        borderBottom: "none",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative" as const,
        letterSpacing: "-0.01em",
    },
    navLinkActive: {
        color: "#2563eb",
        background: "rgba(37, 99, 235, 0.08)",
        fontWeight: 600,
    },
    navRight: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
    },
    container: {
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "32px 40px",
        flex: 1,
        width: "100%",
    },
    statusBar: {
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        padding: "16px 24px",
        marginBottom: "24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "13px",
        color: "#666",
    },
    statusItem: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    statusDot: {
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: "#22c55e",
    },
    kpiGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "20px",
        marginBottom: "32px",
    },
    kpiCard: {
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        padding: "24px",
        position: "relative",
        minHeight: "140px",
        display: "flex",
        flexDirection: "column" as const,
        justifyContent: "space-between",
    },
    kpiTitle: {
        fontSize: "12px",
        color: "#666",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        marginBottom: "8px",
    },
    kpiValue: {
        fontSize: "32px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "4px",
    },
    kpiDelta: {
        fontSize: "12px",
        color: "#666",
    },
    kpiIcon: {
        position: "absolute",
        top: "24px",
        right: "24px",
        width: "32px",
        height: "32px",
        borderRadius: "4px",
        background: "#f0f0f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "16px",
    },
    sectionGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "20px",
        marginBottom: "32px",
    },
    sectionCard: {
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        padding: "24px",
    },
    sectionTitle: {
        fontSize: "16px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "4px",
    },
    sectionSubtitle: {
        fontSize: "12px",
        color: "#666",
        marginBottom: "20px",
    },
    distributionGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "12px",
        marginTop: "20px",
    },
    distributionItem: {
        textAlign: "center",
        padding: "16px",
        background: "#f8f9fa",
        borderRadius: "4px",
    },
    distributionLabel: {
        fontSize: "11px",
        color: "#666",
        textTransform: "uppercase",
        marginBottom: "8px",
    },
    distributionValue: {
        fontSize: "24px",
        fontWeight: 600,
        color: "#1a1a1a",
    },
    alertCard: {
        background: "#f8f9fa",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        padding: "16px",
        marginBottom: "16px",
    },
    alertTitle: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "4px",
    },
    alertDesc: {
        fontSize: "12px",
        color: "#666",
        marginBottom: "12px",
    },
    progressBar: {
        height: "8px",
        background: "#e0e0e0",
        borderRadius: "4px",
        overflow: "hidden",
        marginTop: "8px",
    },
    progressFill: {
        height: "100%",
        background: "#2563eb",
        borderRadius: "4px",
        transition: "width 0.3s ease",
    },
    eventTable: {
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        padding: "24px",
    },
    tableHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
    },
    tableTitle: {
        fontSize: "16px",
        fontWeight: 600,
        color: "#1a1a1a",
    },
    tableLink: {
        fontSize: "12px",
        color: "#2563eb",
        textDecoration: "none",
        cursor: "pointer",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
    },
    tableRow: {
        borderBottom: "1px solid #f0f0f0",
    },
    tableCell: {
        padding: "12px 0",
        fontSize: "13px",
        color: "#1a1a1a",
    },
    tableCellMuted: {
        fontSize: "12px",
        color: "#666",
    },
    badge: {
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 500,
        textTransform: "uppercase",
    },
    badgeIssuance: {
        background: "#f3e8ff",
        color: "#7c3aed",
    },
    badgeTokenization: {
        background: "#dbeafe",
        color: "#2563eb",
    },
    badgeFinancing: {
        background: "#dcfce7",
        color: "#16a34a",
    },
    badgeRepayment: {
        background: "#fef3c7",
        color: "#d97706",
    },
    badgeDefault: {
        background: "#fee2e2",
        color: "#dc2626",
    },
} as const;


export default function OverviewPage() {
    const chainId = useChainId();

    // WebSocket connection for real-time updates
    const { subscribe: subscribeWS, isConnected } = useWebSocket('global');

    // Fetch all invoices
    const { data: invoices, isLoading: invoicesLoading, mutate: mutateInvoices } = useSWR<Invoice[]>(
        ["all-invoices", chainId],
        () => fetchInvoices(),
        { refreshInterval: 0 } // Disabled polling, WebSocket will handle updates
    );

    // Fetch pool overview
    const { data: poolOverview, isLoading: poolLoading, mutate: mutatePoolOverview } = useSWR<PoolOverview>(
        ["pool-overview", chainId],
        () => fetchPoolOverview(),
        { refreshInterval: 0 }
    );

    // Fetch pool limits
    const { data: poolLimits, isLoading: limitsLoading } = useSWR<PoolLimits>(
        ["pool-limits", chainId],
        () => fetchPoolLimits(),
        { refreshInterval: 0 }
    );

    // Subscribe to WebSocket events
    React.useEffect(() => {
        console.log('[OverviewPage] MOUNTED');
        return () => console.log('[OverviewPage] UNMOUNTED');
    }, []);

    React.useEffect(() => {
        const unsubscribeInvoiceCreated = subscribeWS('invoice.created', () => {
            mutateInvoices();
        });

        const unsubscribeInvoiceStatusChanged = subscribeWS('invoice.status_changed', () => {
            mutateInvoices();
        });

        const unsubscribeInvoiceFinanced = subscribeWS('invoice.financed', () => {
            mutateInvoices();
            mutatePoolOverview();
        });

        const unsubscribePoolUtilization = subscribeWS('pool.utilization_changed', () => {
            mutatePoolOverview();
        });

        const unsubscribePoolLiquidity = subscribeWS('pool.liquidity_changed', () => {
            mutatePoolOverview();
        });

        const unsubscribeInvoiceRepaid = subscribeWS('invoice.repaid', () => {
            mutateInvoices();
            mutatePoolOverview();
        });

        const unsubscribeInvoicePayment = subscribeWS('invoice.payment_recorded', () => {
            mutateInvoices();
            mutatePoolOverview();
        });

        return () => {
            unsubscribeInvoiceCreated();
            unsubscribeInvoiceStatusChanged();
            unsubscribeInvoiceFinanced();
            unsubscribePoolUtilization();
            unsubscribePoolLiquidity();
            unsubscribeInvoiceRepaid();
            unsubscribeInvoicePayment();
        };
    }, [subscribeWS, mutateInvoices, mutatePoolOverview]);

    // Calculate metrics
    const metrics = useMemo(() => {
        if (!invoices || !poolOverview) return null;

        const activeInvoices = invoices.filter(inv => {
            const status = (inv.status || "").toUpperCase();
            return status === "ISSUED" || status === "TOKENIZED" || status === "FINANCED" ||
                status === "PARTIALLY_PAID" || status === "PENDING" || status === "APPROVED" ||
                inv.isFinanced === true;
        }).length;

        const totalFinanced = invoices
            .filter(inv => {
                const hasFinanced = inv.isFinanced === true;
                const hasUsedCredit = inv.usedCredit && inv.usedCredit !== "0";
                return hasFinanced && hasUsedCredit;
            })
            .reduce((sum, inv) => {
                // usedCredit comes from backend as string in cents (e.g., "6000000" for 60000 TL)
                // Always divide by 100 to convert from cents to TL
                const usedCreditNum = parseFloat(inv.usedCredit || "0");
                return sum + (usedCreditNum / 100);
            }, 0);

        const statusDistribution = {
            ISSUED: invoices.filter(inv => {
                const status = (inv.status || "").toUpperCase();
                return status === "ISSUED" || status === "PENDING" || status === "APPROVED";
            }).length,
            TOKENIZED: invoices.filter(inv => {
                const status = (inv.status || "").toUpperCase();
                return status === "TOKENIZED";
            }).length,
            FINANCED: invoices.filter(inv => {
                const status = (inv.status || "").toUpperCase();
                return (status === "FINANCED" || inv.isFinanced === true) &&
                    inv.usedCredit && inv.usedCredit !== "0";
            }).length,
            REPAID: invoices.filter(inv => {
                const status = (inv.status || "").toUpperCase();
                return status === "PAID" || status === "REPAID" || status === "PARTIALLY_PAID";
            }).length,
            DEFAULTED: invoices.filter(inv => {
                const status = (inv.status || "").toUpperCase();
                return status === "DEFAULTED";
            }).length,
        };

        // Upcoming maturities (within 7 days) - return list with details
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const upcomingMaturitiesList = invoices
            .filter(inv => {
                const dueDate = new Date(inv.dueDate);
                const status = (inv.status || "").toUpperCase();
                return dueDate >= now && dueDate <= sevenDaysFromNow && status !== "PAID";
            })
            .map(inv => ({
                ...inv,
                daysUntilDue: Math.ceil((new Date(inv.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            }))
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        const upcomingMaturities = upcomingMaturitiesList.length;

        // Debug logging
        console.log('[Overview] Metrics calculation:', {
            invoicesCount: invoices.length,
            invoices: invoices.map(inv => ({
                id: inv.id,
                externalId: inv.externalId,
                status: inv.status,
                isFinanced: inv.isFinanced,
                usedCredit: inv.usedCredit,
                maxCreditLine: inv.maxCreditLine,
            })),
            activeInvoices,
            totalFinanced,
            poolOverview: {
                availableLiquidityFormatted: poolOverview.availableLiquidityFormatted,
                utilizationPercent: poolOverview.utilizationPercent,
                availableLiquidity: poolOverview.availableLiquidity,
                utilization: poolOverview.utilization,
            },
            statusDistribution,
        });

        const utilization = poolOverview.utilizationPercent
            ? parseFloat(poolOverview.utilizationPercent)
            : (poolOverview.utilization ? parseFloat(poolOverview.utilization) : 0);

        const maxUtilization = poolOverview.maxUtilizationPercent
            ? parseFloat(poolOverview.maxUtilizationPercent)
            : 80.0; // Default 80%

        return {
            activeInvoices,
            totalFinanced,
            liquidityAvailable: poolOverview.availableLiquidityFormatted
                ? parseFloat(poolOverview.availableLiquidityFormatted)
                : (poolOverview.availableLiquidity ? parseFloat(poolOverview.availableLiquidity) / 1e18 : 0),
            utilization,
            maxUtilization,
            availableCapacity: maxUtilization - utilization,
            statusDistribution,
            upcomingMaturities,
            upcomingMaturitiesList,
        };
    }, [invoices, poolOverview]);

    // Recent events (from invoices)
    const recentEvents = useMemo(() => {
        if (!invoices) return [];

        return invoices
            .slice()
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 10)
            .map(inv => {
                let eventType = "Issuance";
                if (inv.status === "TOKENIZED") eventType = "Tokenization";
                else if (inv.status === "FINANCED" || inv.isFinanced) eventType = "Financing";
                else if (inv.status === "PAID" || inv.status === "PARTIALLY_PAID") eventType = "Repayment";
                else if (inv.status === "DEFAULTED") eventType = "Default";

                return {
                    timestamp: inv.updatedAt,
                    eventType,
                    description: `Invoice ${inv.externalId} ${eventType.toLowerCase()}`,
                    referenceId: inv.id,
                    txHash: inv.invoiceIdOnChain,
                };
            });
    }, [invoices]);

    return (
        <div style={styles.page}>
            <Navbar />

            {/* Main Content */}
            <div style={styles.container}>
                {(!invoices && invoicesLoading) || (!poolOverview && poolLoading) || (!poolLimits && limitsLoading) ? (
                    <div style={{ textAlign: "center", padding: "60px", color: "#666" }}>
                        Loading system overview...
                    </div>
                ) : (
                    <>
                        {/* 1. Top System Status Bar */}
                        <div style={styles.statusBar}>
                            <div style={styles.statusItem}>
                                <span style={styles.statusDot}></span>
                                <span><strong>Engine Status:</strong> Running-Nominal</span>
                            </div>
                            <div style={styles.statusItem}>
                                <span><strong>Last Decision:</strong> {recentEvents[0] ? new Date(recentEvents[0].timestamp).toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " UTC" : "N/A"}</span>
                            </div>
                            <div style={styles.statusItem}>
                                <span><strong>Active Rules:</strong> {poolLimits ? "Production" : "N/A"}</span>
                            </div>
                            <div style={styles.statusItem}>
                                <span><strong>System Load:</strong> {metrics ? `${metrics.utilization.toFixed(1)}%` : "N/A"}</span>
                            </div>
                        </div>

                        {/* 2. Key System Metrics */}
                        <div style={styles.kpiGrid}>
                            <div style={styles.kpiCard}>
                                <div style={styles.kpiTitle}>Total Active Invoices</div>
                                <div style={styles.kpiValue}>{metrics?.activeInvoices || 0}</div>
                                <div style={styles.kpiDelta}>Current period</div>
                                <div style={styles.kpiIcon}>📄</div>
                            </div>
                            <div style={styles.kpiCard}>
                                <div style={styles.kpiTitle}>Total Financed Amount</div>
                                <div style={styles.kpiValue}>
                                    {metrics?.totalFinanced ? formatAmount(metrics.totalFinanced.toString(), "TRY") : "₺0"}
                                </div>
                                <div style={styles.kpiDelta}>Outstanding principal</div>
                            </div>
                            <div style={styles.kpiCard}>
                                <div style={styles.kpiTitle}>Liquidity Available</div>
                                <div style={styles.kpiValue}>
                                    {metrics?.liquidityAvailable ? formatAmount(metrics.liquidityAvailable.toString(), "TRY") : "₺0"}
                                </div>
                                <div style={styles.kpiDelta}>Pool capacity</div>
                            </div>
                            <div style={styles.kpiCard}>
                                <div style={styles.kpiTitle}>Utilization Ratio</div>
                                <div style={styles.kpiValue}>
                                    {metrics?.utilization.toFixed(1) || "0.0"}%
                                    {metrics && metrics.maxUtilization && (
                                        <span style={{ fontSize: "14px", color: "#666", fontWeight: 400, marginLeft: "8px" }}>
                                            / {metrics.maxUtilization.toFixed(0)}% max
                                        </span>
                                    )}
                                </div>
                                <div style={styles.progressBar}>
                                    <div style={{
                                        ...styles.progressFill,
                                        width: `${Math.min(metrics?.utilization || 0, 100)}%`,
                                        background: metrics?.utilization
                                            ? (metrics.utilization < 50 ? "#22c55e" : metrics.utilization < 75 ? "#f59e0b" : "#ef4444")
                                            : "#2563eb"
                                    }}></div>
                                </div>
                                {metrics && metrics.utilization > 0 && (
                                    <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                                        Total Borrowed / Total Liquidity
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. System Distribution & Alerts */}
                        <div style={styles.sectionGrid}>
                            {/* Left: AI Lifecycle Intelligence Slider */}
                            <div style={{ ...styles.sectionCard, position: "relative", overflow: "hidden" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", position: "relative", zIndex: 2 }}>
                                    <div>
                                        <div style={styles.sectionTitle}>AI Lifecycle Intelligence</div>
                                        <div style={styles.sectionSubtitle}>Autonomous monitoring and decision analytics</div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>

                                        <LiveBadge isLive={isConnected} lastUpdated={new Date()} />
                                    </div>
                                </div>

                                {/* AI Lifecycle Slider */}
                                <AILifecycleSlider activeAgents={0} />
                            </div>

                            {/* Right: System Alerts & Allocation */}
                            <div>
                                {/* Upcoming Maturities */}
                                <div style={styles.sectionCard}>
                                    <div style={{ marginBottom: "20px" }}>
                                        <div style={{
                                            fontSize: "18px",
                                            fontWeight: 600,
                                            color: "#0f172a",
                                            marginBottom: "4px",
                                            letterSpacing: "-0.01em"
                                        }}>
                                            Upcoming Maturity
                                        </div>
                                        <div style={{
                                            fontSize: "13px",
                                            color: "#64748b"
                                        }}>
                                            {metrics?.upcomingMaturities || 0} invoices maturing within 7 days
                                        </div>
                                    </div>
                                    {metrics && metrics.upcomingMaturitiesList && metrics.upcomingMaturitiesList.length > 0 ? (
                                        <div style={{ marginTop: "16px" }}>
                                            {metrics.upcomingMaturitiesList.slice(0, 5).map((inv, idx) => {
                                                const isUrgent = inv.daysUntilDue <= 3;
                                                const statusColors: Record<string, string> = {
                                                    FINANCED: "#16a34a",
                                                    TOKENIZED: "#2563eb",
                                                    ISSUED: "#64748b",
                                                    REPAID: "#22c55e",
                                                    DEFAULTED: "#ef4444"
                                                };
                                                const statusBgColors: Record<string, string> = {
                                                    FINANCED: "rgba(22, 163, 74, 0.1)",
                                                    TOKENIZED: "rgba(37, 99, 235, 0.1)",
                                                    ISSUED: "rgba(100, 116, 139, 0.1)",
                                                    REPAID: "rgba(34, 197, 94, 0.1)",
                                                    DEFAULTED: "rgba(239, 68, 68, 0.1)"
                                                };
                                                const statusColor = statusColors[inv.status] || "#64748b";
                                                const statusBgColor = statusBgColors[inv.status] || "rgba(100, 116, 139, 0.1)";

                                                return (
                                                    <Link
                                                        key={inv.id}
                                                        href={`/invoices/${inv.id}`}
                                                        style={{
                                                            display: "block",
                                                            padding: "12px 0",
                                                            borderBottom: idx < 4 ? "1px solid #f0f0f0" : "none",
                                                            textDecoration: "none",
                                                            color: "#1a1a1a",
                                                            transition: "background 0.2s ease"
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = "#f8f9fa";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = "transparent";
                                                        }}
                                                    >
                                                        <div style={{
                                                            display: "flex",
                                                            justifyContent: "space-between",
                                                            alignItems: "center"
                                                        }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{
                                                                    fontWeight: 600,
                                                                    fontSize: "13px",
                                                                    color: "#1a1a1a",
                                                                    marginBottom: "4px"
                                                                }}>
                                                                    {inv.externalId}
                                                                </div>
                                                                <div style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: "8px",
                                                                    flexWrap: "wrap" as const
                                                                }}>
                                                                    <span style={{
                                                                        fontSize: "12px",
                                                                        color: "#666"
                                                                    }}>
                                                                        {formatAmount(inv.amount, inv.currency)}
                                                                    </span>
                                                                    <span style={{
                                                                        display: "inline-flex",
                                                                        alignItems: "center",
                                                                        padding: "2px 6px",
                                                                        borderRadius: "3px",
                                                                        fontSize: "10px",
                                                                        fontWeight: 600,
                                                                        color: statusColor,
                                                                        background: statusBgColor,
                                                                        textTransform: "uppercase" as const
                                                                    }}>
                                                                        {inv.status}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div style={{
                                                                textAlign: "right",
                                                                marginLeft: "16px",
                                                                flexShrink: 0
                                                            }}>
                                                                <div style={{
                                                                    fontWeight: 600,
                                                                    fontSize: "12px",
                                                                    color: isUrgent ? "#ef4444" : "#666",
                                                                    marginBottom: "2px"
                                                                }}>
                                                                    {inv.daysUntilDue === 0 ? "Today" : inv.daysUntilDue === 1 ? "1 day" : `${inv.daysUntilDue} days`}
                                                                </div>
                                                                <div style={{
                                                                    fontSize: "11px",
                                                                    color: "#999"
                                                                }}>
                                                                    {formatDate(inv.dueDate)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                            {metrics.upcomingMaturitiesList.length > 5 && (
                                                <div style={{
                                                    fontSize: "12px",
                                                    color: "#666",
                                                    textAlign: "center",
                                                    marginTop: "12px",
                                                    paddingTop: "12px"
                                                }}>
                                                    +{metrics.upcomingMaturitiesList.length - 5} more invoices
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{
                                            marginTop: "16px",
                                            padding: "32px",
                                            textAlign: "center",
                                            fontSize: "13px",
                                            color: "#94a3b8",
                                            fontStyle: "italic",
                                            background: "#f8fafc",
                                            borderRadius: "8px",
                                            border: "1px dashed #e2e8f0"
                                        }}>
                                            No invoices maturing in the next 7 days
                                        </div>
                                    )}
                                </div>

                                {/* Pool Utilization Snapshot */}
                                <div style={{ ...styles.sectionCard, marginTop: "20px" }}>
                                    <div style={{ marginBottom: "20px" }}>
                                        <div style={{
                                            fontSize: "18px",
                                            fontWeight: 600,
                                            color: "#0f172a",
                                            marginBottom: "4px",
                                            letterSpacing: "-0.01em"
                                        }}>
                                            Pool Utilization Snapshot
                                        </div>
                                        <div style={{
                                            fontSize: "13px",
                                            color: "#64748b"
                                        }}>
                                            Current allocation status
                                        </div>
                                    </div>

                                    <div style={{ marginTop: "24px" }}>
                                        {/* Pool Label and Value */}
                                        <div style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            marginBottom: "12px"
                                        }}>
                                            <span style={{
                                                fontSize: "14px",
                                                fontWeight: 500,
                                                color: "#1e293b"
                                            }}>
                                                Main Pool
                                            </span>
                                            <div style={{
                                                display: "flex",
                                                alignItems: "baseline",
                                                gap: "4px"
                                            }}>
                                                <span style={{
                                                    fontSize: "15px",
                                                    fontWeight: 600,
                                                    color: "#0f172a"
                                                }}>
                                                    {metrics?.utilization.toFixed(1) || "0.0"}%
                                                </span>
                                                <span style={{
                                                    fontSize: "12px",
                                                    color: "#94a3b8",
                                                    fontWeight: 400
                                                }}>
                                                    / {metrics?.maxUtilization?.toFixed(0) || "80"}% max
                                                </span>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div style={{
                                            position: "relative",
                                            width: "100%",
                                            height: "10px",
                                            background: "#f1f5f9",
                                            borderRadius: "6px",
                                            overflow: "hidden",
                                            marginBottom: "16px"
                                        }}>
                                            <div style={{
                                                position: "absolute",
                                                left: 0,
                                                top: 0,
                                                height: "100%",
                                                width: `${Math.min(metrics?.utilization || 0, 100)}%`,
                                                background: metrics?.utilization
                                                    ? (metrics.utilization < 50
                                                        ? "linear-gradient(90deg, #22c55e 0%, #16a34a 100%)"
                                                        : metrics.utilization < 75
                                                            ? "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)"
                                                            : "linear-gradient(90deg, #ef4444 0%, #dc2626 100%)")
                                                    : "linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)",
                                                borderRadius: "6px",
                                                transition: "width 0.3s ease, background 0.3s ease",
                                                boxShadow: metrics?.utilization && metrics.utilization > 0
                                                    ? "0 2px 4px rgba(0, 0, 0, 0.1)"
                                                    : "none"
                                            }}></div>

                                            {/* Threshold markers */}
                                            {metrics?.maxUtilization && (
                                                <>
                                                    <div style={{
                                                        position: "absolute",
                                                        left: `${(metrics.maxUtilization * 0.75)}%`,
                                                        top: 0,
                                                        bottom: 0,
                                                        width: "2px",
                                                        background: "#f59e0b",
                                                        opacity: 0.3
                                                    }} />
                                                    <div style={{
                                                        position: "absolute",
                                                        left: `${metrics.maxUtilization}%`,
                                                        top: 0,
                                                        bottom: 0,
                                                        width: "2px",
                                                        background: "#ef4444",
                                                        opacity: 0.3
                                                    }} />
                                                </>
                                            )}
                                        </div>

                                        {/* Available Capacity */}
                                        {metrics && metrics.availableCapacity !== undefined && (
                                            <div style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                paddingTop: "12px",
                                                borderTop: "1px solid #f0f0f0"
                                            }}>
                                                <span style={{
                                                    fontSize: "12px",
                                                    color: "#666"
                                                }}>
                                                    Available Capacity
                                                </span>
                                                <span style={{
                                                    fontSize: "13px",
                                                    fontWeight: 600,
                                                    color: "#1a1a1a"
                                                }}>
                                                    {metrics.availableCapacity.toFixed(1)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. Recent System Activity */}
                        <div style={styles.eventTable}>
                            <div style={styles.tableHeader}>
                                <div style={styles.tableTitle}>Recent System Activity</div>
                                <a style={styles.tableLink} href="/analytics">View All Logs</a>
                            </div>
                            <table style={styles.table}>
                                <thead>
                                    <tr style={styles.tableRow}>
                                        <th style={{ ...styles.tableCell, textAlign: "left", fontWeight: 600 }}>Timestamp</th>
                                        <th style={{ ...styles.tableCell, textAlign: "left", fontWeight: 600 }}>Event Type</th>
                                        <th style={{ ...styles.tableCell, textAlign: "left", fontWeight: 600 }}>Description</th>
                                        <th style={{ ...styles.tableCell, textAlign: "left", fontWeight: 600 }}>Reference ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentEvents.length > 0 ? (
                                        recentEvents.map((event, idx) => {
                                            const badgeStyle =
                                                event.eventType === "Issuance" ? styles.badgeIssuance :
                                                    event.eventType === "Tokenization" ? styles.badgeTokenization :
                                                        event.eventType === "Financing" ? styles.badgeFinancing :
                                                            event.eventType === "Repayment" ? styles.badgeRepayment :
                                                                styles.badgeDefault;

                                            return (
                                                <tr key={idx} style={styles.tableRow}>
                                                    <td style={{ ...styles.tableCell, ...styles.tableCellMuted }}>
                                                        {new Date(event.timestamp).toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                                    </td>
                                                    <td style={styles.tableCell}>
                                                        <span style={{ ...styles.badge, ...badgeStyle }}>
                                                            {event.eventType}
                                                        </span>
                                                    </td>
                                                    <td style={styles.tableCell}>{event.description}</td>
                                                    <td style={{ ...styles.tableCell, ...styles.tableCellMuted, fontFamily: "monospace", fontSize: "11px" }}>
                                                        {event.referenceId.slice(0, 8)}...
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={4} style={{ ...styles.tableCell, textAlign: "center", color: "#666", padding: "40px" }}>
                                                No recent activity
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

