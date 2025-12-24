"use client";

import React, { useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { fetchInvoices, fetchPoolOverview, fetchPoolLimits, PoolOverview, PoolLimits, Invoice } from "../../lib/backendClient";
import { formatAmount, formatDate } from "../../lib/format";
import { useWebSocket } from "../../lib/websocketClient";

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
        background: "#ffffff",
        borderBottom: "1px solid #e0e0e0",
        padding: "16px 40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    navLeft: {
        display: "flex",
        alignItems: "center",
        gap: "32px",
    },
    navTitle: {
        fontSize: "20px",
        fontWeight: 700,
        color: "#1a1a1a",
    },
    navLinks: {
        display: "flex",
        gap: "24px",
        alignItems: "center",
    },
    navLink: {
        textDecoration: "none",
        color: "#666",
        fontSize: "14px",
        fontWeight: 500,
        padding: "8px 0",
        borderBottom: "2px solid transparent",
        transition: "0.2s",
    },
    navLinkActive: {
        color: "#2563eb",
        borderBottomColor: "#2563eb",
    },
    navRight: {
        display: "flex",
        alignItems: "center",
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
};

export default function OverviewPage() {
    const pathname = usePathname();

    // WebSocket connection for real-time updates
    const { subscribe: subscribeWS } = useWebSocket('global');

    // Fetch all invoices
    const { data: invoices, isLoading: invoicesLoading, mutate: mutateInvoices } = useSWR<Invoice[]>(
        "all-invoices",
        () => fetchInvoices(),
        { refreshInterval: 15000 } // Reduced polling, WebSocket will handle updates
    );

    // Fetch pool overview
    const { data: poolOverview, isLoading: poolLoading, mutate: mutatePoolOverview } = useSWR<PoolOverview>(
        "pool-overview",
        () => fetchPoolOverview(),
        { refreshInterval: 15000 }
    );

    // Fetch pool limits
    const { data: poolLimits, isLoading: limitsLoading, mutate: mutatePoolLimits } = useSWR<PoolLimits>(
        "pool-limits",
        () => fetchPoolLimits(),
        { refreshInterval: 15000 }
    );

    // Subscribe to WebSocket events
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

        return () => {
            unsubscribeInvoiceCreated();
            unsubscribeInvoiceStatusChanged();
            unsubscribeInvoiceFinanced();
            unsubscribePoolUtilization();
            unsubscribePoolLiquidity();
        };
    }, [subscribeWS, mutateInvoices, mutatePoolOverview]);

    // Calculate metrics
    const metrics = useMemo(() => {
        if (!invoices || !poolOverview) return null;

        const activeInvoices = invoices.filter(inv => 
            inv.status === "ISSUED" || inv.status === "TOKENIZED" || inv.status === "FINANCED" || inv.status === "PARTIALLY_PAID"
        ).length;

        const totalFinanced = invoices
            .filter(inv => inv.isFinanced)
            .reduce((sum, inv) => sum + parseFloat(inv.usedCredit || "0") / 100, 0);

        const statusDistribution = {
            ISSUED: invoices.filter(inv => inv.status === "ISSUED").length,
            TOKENIZED: invoices.filter(inv => inv.status === "TOKENIZED").length,
            FINANCED: invoices.filter(inv => inv.status === "FINANCED" || inv.isFinanced).length,
            REPAID: invoices.filter(inv => inv.status === "PAID").length,
            DEFAULTED: invoices.filter(inv => inv.status === "DEFAULTED").length,
        };

        // Upcoming maturities (within 7 days)
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const upcomingMaturities = invoices.filter(inv => {
            const dueDate = new Date(inv.dueDate);
            return dueDate >= now && dueDate <= sevenDaysFromNow && inv.status !== "PAID";
        }).length;

        return {
            activeInvoices,
            totalFinanced,
            liquidityAvailable: parseFloat(poolOverview.availableLiquidityFormatted || "0"),
            utilization: parseFloat(poolOverview.utilizationPercent || "0"),
            statusDistribution,
            upcomingMaturities,
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
                else if (inv.status === "PAID") eventType = "Repayment";
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
            {/* Top Navbar - Always visible */}
            <nav style={styles.navbar}>
                <div style={styles.navLeft}>
                    <div style={styles.navTitle}>TIFA Dashboard</div>
                    <div style={styles.navLinks}>
                        <Link href="/overview" style={{ ...styles.navLink, ...(pathname === "/overview" ? styles.navLinkActive : {}) }}>
                            Overview
                        </Link>
                        <Link href="/" style={{ ...styles.navLink, ...(pathname === "/" ? styles.navLinkActive : {}) }}>
                            Invoices
                        </Link>
                        <Link href="/lp" style={{ ...styles.navLink, ...(pathname === "/lp" ? styles.navLinkActive : {}) }}>
                            LP Dashboard
                        </Link>
                        <Link href="/analytics" style={{ ...styles.navLink, ...(pathname === "/analytics" ? styles.navLinkActive : {}) }}>
                            Analytics
                        </Link>
                        <Link href="/agent" style={{ ...styles.navLink, ...(pathname === "/agent" ? styles.navLinkActive : {}) }}>
                            Agent Console
                        </Link>
                    </div>
                </div>
                <div style={styles.navRight}>
                    {/* ConnectButton needs WagmiProvider, which is provided by Providers in root layout */}
                    <ConnectButton />
                </div>
            </nav>

            {/* Main Content */}
            <div style={styles.container}>
                {invoicesLoading || poolLoading || limitsLoading ? (
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
                        <div style={styles.kpiIcon}>💰</div>
                    </div>
                    <div style={styles.kpiCard}>
                        <div style={styles.kpiTitle}>Liquidity Available</div>
                        <div style={styles.kpiValue}>
                            {metrics?.liquidityAvailable ? formatAmount(metrics.liquidityAvailable.toString(), "TRY") : "₺0"}
                        </div>
                        <div style={styles.kpiDelta}>Pool capacity</div>
                        <div style={styles.kpiIcon}>💧</div>
                    </div>
                    <div style={styles.kpiCard}>
                        <div style={styles.kpiTitle}>Utilization Ratio</div>
                        <div style={styles.kpiValue}>{metrics?.utilization.toFixed(1) || "0.0"}%</div>
                        <div style={styles.progressBar}>
                            <div style={{ ...styles.progressFill, width: `${metrics?.utilization || 0}%` }}></div>
                        </div>
                        <div style={styles.kpiIcon}>📊</div>
                    </div>
                </div>

                {/* 3. System Distribution & Alerts */}
                <div style={styles.sectionGrid}>
                    {/* Left: Invoice Status Distribution */}
                    <div style={styles.sectionCard}>
                        <div style={styles.sectionTitle}>Invoice Status Distribution</div>
                        <div style={styles.sectionSubtitle}>Current financial period breakdown</div>
                        <div style={{ fontSize: "24px", fontWeight: 600, color: "#1a1a1a", marginBottom: "20px" }}>
                            Total: {invoices?.length || 0}
                        </div>
                        <div style={styles.distributionGrid}>
                            <div style={styles.distributionItem}>
                                <div style={styles.distributionLabel}>Issued</div>
                                <div style={styles.distributionValue}>{metrics?.statusDistribution.ISSUED || 0}</div>
                            </div>
                            <div style={styles.distributionItem}>
                                <div style={styles.distributionLabel}>Tokenized</div>
                                <div style={styles.distributionValue}>{metrics?.statusDistribution.TOKENIZED || 0}</div>
                            </div>
                            <div style={styles.distributionItem}>
                                <div style={styles.distributionLabel}>Financed</div>
                                <div style={styles.distributionValue}>{metrics?.statusDistribution.FINANCED || 0}</div>
                            </div>
                            <div style={styles.distributionItem}>
                                <div style={styles.distributionLabel}>Repaid</div>
                                <div style={styles.distributionValue}>{metrics?.statusDistribution.REPAID || 0}</div>
                            </div>
                            <div style={styles.distributionItem}>
                                <div style={styles.distributionLabel}>Defaulted</div>
                                <div style={styles.distributionValue}>{metrics?.statusDistribution.DEFAULTED || 0}</div>
                            </div>
                        </div>
                    </div>

                    {/* Right: System Alerts & Allocation */}
                    <div>
                        {/* Upcoming Maturities */}
                        <div style={styles.sectionCard}>
                            <div style={styles.sectionTitle}>Upcoming Maturity</div>
                            <div style={styles.sectionSubtitle}>
                                {metrics?.upcomingMaturities || 0} invoices maturing within 7 days
                            </div>
                            {metrics && metrics.upcomingMaturities > 0 && (
                                <div style={{ marginTop: "16px", fontSize: "12px", color: "#666" }}>
                                    Review recommended
                                </div>
                            )}
                        </div>

                        {/* Pool Utilization Snapshot */}
                        <div style={{ ...styles.sectionCard, marginTop: "20px" }}>
                            <div style={styles.sectionTitle}>Pool Utilization Snapshot</div>
                            <div style={styles.sectionSubtitle}>Current allocation status</div>
                            <div style={{ marginTop: "20px" }}>
                                <div style={{ marginBottom: "16px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                        <span style={{ fontSize: "13px", color: "#1a1a1a" }}>Main Pool</span>
                                        <span style={{ fontSize: "13px", color: "#1a1a1a", fontWeight: 600 }}>
                                            {metrics?.utilization.toFixed(1) || "0.0"}%
                                        </span>
                                    </div>
                                    <div style={styles.progressBar}>
                                        <div style={{ ...styles.progressFill, width: `${metrics?.utilization || 0}%` }}></div>
                                    </div>
                                </div>
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

