"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { Line, Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Legend,
    Filler
} from "chart.js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { fetchPortfolioAnalytics, PortfolioAnalytics } from "../../lib/backendClient";
import { formatAmount } from "../../lib/format";
import { useWebSocket } from "../../lib/websocketClient";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Legend,
    Filler
);

// Institutional design styles
const styles = {
    page: {
        minHeight: "100vh",
        background: "#ffffff",
        padding: "0",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
        color: "#1a1a1a",
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
        padding: "40px",
        flex: 1,
        width: "100%",
    },
    header: {
        marginBottom: "32px",
        borderBottom: "1px solid #e5e7eb",
        paddingBottom: "24px",
    },
    breadcrumb: {
        fontSize: "12px",
        color: "#6b7280",
        marginBottom: "8px",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
    },
    title: {
        fontSize: "28px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "4px",
    },
    subtitle: {
        fontSize: "14px",
        color: "#6b7280",
        marginBottom: "24px",
    },
    headerControls: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "16px",
    },
    dateRange: {
        fontSize: "13px",
        color: "#374151",
        padding: "8px 12px",
        border: "1px solid #d1d5db",
        borderRadius: "4px",
        background: "#ffffff",
        cursor: "pointer",
    },
    exportButton: {
        fontSize: "13px",
        fontWeight: 500,
        color: "#2563eb",
        padding: "8px 16px",
        border: "1px solid #2563eb",
        borderRadius: "4px",
        background: "#ffffff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "6px",
    },
    kpiGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "24px",
        marginBottom: "40px",
    },
    kpiCard: {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "0",
        padding: "24px",
    },
    kpiTitle: {
        fontSize: "11px",
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        marginBottom: "12px",
        fontWeight: 500,
    },
    kpiValue: {
        fontSize: "32px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "8px",
    },
    kpiDelta: {
        fontSize: "12px",
        color: "#6b7280",
        marginTop: "4px",
    },
    kpiDeltaPositive: {
        color: "#16a34a",
    },
    kpiDeltaNegative: {
        color: "#dc2626",
    },
    kpiDeltaNeutral: {
        color: "#6b7280",
    },
    kpiReference: {
        fontSize: "11px",
        color: "#9ca3af",
        marginTop: "4px",
    },
    chartSection: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "24px",
        marginBottom: "40px",
    },
    chartCard: {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "0",
        padding: "24px",
    },
    chartTitle: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "20px",
    },
    yieldSection: {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "0",
        padding: "24px",
        marginBottom: "24px",
    },
    yieldBar: {
        display: "flex",
        alignItems: "center",
        marginBottom: "16px",
    },
    yieldLabel: {
        fontSize: "13px",
        color: "#374151",
        width: "120px",
        fontWeight: 500,
    },
    yieldBarContainer: {
        flex: 1,
        height: "24px",
        background: "#f3f4f6",
        borderRadius: "2px",
        overflow: "hidden",
        position: "relative",
    },
    yieldBarFill: {
        height: "100%",
        background: "#2563eb",
        borderRadius: "2px",
        transition: "width 0.3s ease",
    },
    yieldValue: {
        fontSize: "13px",
        color: "#1a1a1a",
        marginLeft: "12px",
        fontWeight: 600,
        width: "60px",
        textAlign: "right",
    },
    yieldFootnote: {
        fontSize: "11px",
        color: "#6b7280",
        marginTop: "16px",
        lineHeight: "1.5",
        fontStyle: "italic",
    },
    tableSection: {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "0",
        padding: "24px",
        marginBottom: "40px",
    },
    tableHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
    },
    tableTitle: {
        fontSize: "14px",
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
    tableHeaderRow: {
        borderBottom: "1px solid #e5e7eb",
    },
    tableHeaderCell: {
        padding: "12px 16px",
        fontSize: "11px",
        fontWeight: 600,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        textAlign: "left",
    },
    tableRow: {
        borderBottom: "1px solid #f3f4f6",
    },
    tableCell: {
        padding: "16px",
        fontSize: "13px",
        color: "#1a1a1a",
    },
    performanceBadge: {
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: "2px",
        fontSize: "11px",
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.3px",
    },
    performanceExcellent: {
        background: "#dcfce7",
        color: "#166534",
    },
    performanceGood: {
        background: "#dbeafe",
        color: "#1e40af",
    },
    performanceStable: {
        background: "#fef3c7",
        color: "#92400e",
    },
    performanceWatch: {
        background: "#fee2e2",
        color: "#991b1b",
    },
    disclaimer: {
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "0",
        padding: "24px",
        marginTop: "40px",
    },
    disclaimerText: {
        fontSize: "11px",
        color: "#6b7280",
        lineHeight: "1.6",
        marginBottom: "12px",
    },
    disclaimerTimestamp: {
        fontSize: "10px",
        color: "#9ca3af",
        marginTop: "12px",
    },
};

function formatDelta(value: number): string {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}`;
}

function formatDeltaPercent(value: number): string {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
}

function getDeltaColor(value: number): string {
    if (value > 0) return styles.kpiDeltaPositive.color;
    if (value < 0) return styles.kpiDeltaNegative.color;
    return styles.kpiDeltaNeutral.color;
}

function getPerformanceBadgeStyle(performance: string): any {
    switch (performance) {
        case "Excellent":
            return { ...styles.performanceBadge, ...styles.performanceExcellent };
        case "Good":
            return { ...styles.performanceBadge, ...styles.performanceGood };
        case "Stable":
            return { ...styles.performanceBadge, ...styles.performanceStable };
        case "Watch":
            return { ...styles.performanceBadge, ...styles.performanceWatch };
        default:
            return { ...styles.performanceBadge, ...styles.performanceStable };
    }
}

export default function PortfolioAnalyticsPage() {
    const pathname = usePathname();
    
    // WebSocket connection for real-time updates
    const { subscribe: subscribeWS } = useWebSocket('global');

    const { data, error, isLoading, mutate } = useSWR<PortfolioAnalytics>(
        "portfolio-analytics",
        () => fetchPortfolioAnalytics(),
        { refreshInterval: 60000 } // Reduced polling, WebSocket will handle updates
    );

    const [dateRange, setDateRange] = useState("Jan 1, 2023 - Sep 30, 2023");

    // Subscribe to WebSocket events
    React.useEffect(() => {
        const unsubscribePoolUtilization = subscribeWS('pool.utilization_changed', () => {
            mutate();
        });

        const unsubscribePoolLiquidity = subscribeWS('pool.liquidity_changed', () => {
            mutate();
        });

        const unsubscribeInvoiceFinanced = subscribeWS('invoice.financed', () => {
            mutate();
        });

        const unsubscribeInvoicePayment = subscribeWS('invoice.payment_recorded', () => {
            mutate();
        });

        return () => {
            unsubscribePoolUtilization();
            unsubscribePoolLiquidity();
            unsubscribeInvoiceFinanced();
            unsubscribeInvoicePayment();
        };
    }, [subscribeWS, mutate]);

    if (isLoading) {
        return (
            <div style={styles.page}>
                <div style={styles.container}>
                    <div style={{ textAlign: "center", padding: "60px", color: "#6b7280" }}>
                        Loading portfolio analytics...
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.page}>
                <div style={styles.container}>
                    <div style={{ textAlign: "center", padding: "60px", color: "#dc2626" }}>
                        <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                            Failed to load portfolio analytics.
                        </div>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px" }}>
                            {error instanceof Error ? error.message : String(error)}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div style={styles.page}>
                <div style={styles.container}>
                    <div style={{ textAlign: "center", padding: "60px", color: "#6b7280" }}>
                        No data available.
                    </div>
                </div>
            </div>
        );
    }

    // Capital Utilization Trend Chart
    const utilizationChartData = {
        labels: data.utilizationTrend.map(d => d.month),
        datasets: [
            {
                label: "Utilization",
                data: data.utilizationTrend.map(d => d.utilization),
                borderColor: "#2563eb",
                backgroundColor: "rgba(37, 99, 235, 0.1)",
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 5,
            },
        ],
    };

    const utilizationChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: "#1a1a1a",
                padding: 12,
                titleFont: { size: 12 },
                bodyFont: { size: 12 },
                callbacks: {
                    label: (context: any) => `${context.parsed.y.toFixed(1)}%`,
                },
            },
        },
        scales: {
            y: {
                beginAtZero: false,
                min: 70,
                max: 100,
                ticks: {
                    font: { size: 11 },
                    color: "#6b7280",
                    callback: (value: any) => `${value}%`,
                },
                grid: {
                    color: "#f3f4f6",
                },
            },
            x: {
                ticks: {
                    font: { size: 11 },
                    color: "#6b7280",
                },
                grid: {
                    display: false,
                },
            },
        },
    };

    // Invoice Duration Distribution Chart
    const durationChartData = {
        labels: data.durationDistribution.map(d => d.label),
        datasets: [
            {
                label: "Invoices",
                data: data.durationDistribution.map(d => d.count),
                backgroundColor: "#2563eb",
                borderRadius: 2,
            },
        ],
    };

    const durationChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: "#1a1a1a",
                padding: 12,
                titleFont: { size: 12 },
                bodyFont: { size: 12 },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    font: { size: 11 },
                    color: "#6b7280",
                    stepSize: 1,
                },
                grid: {
                    color: "#f3f4f6",
                },
            },
            x: {
                ticks: {
                    font: { size: 11 },
                    color: "#6b7280",
                },
                grid: {
                    display: false,
                },
            },
        },
    };

    // Yield Composition - find max for scaling
    const maxYield = Math.max(
        data.yieldComposition.grossYield,
        data.yieldComposition.netYield,
        data.yieldComposition.benchmarkYield
    );

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
                    <ConnectButton />
                </div>
            </nav>
            
            <div style={styles.container}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.breadcrumb}>Home / Funds / {data.metadata.fundName} / Analytics</div>
                    <div style={styles.title}>Portfolio Analytics — {data.metadata.fundName}</div>
                    <div style={styles.subtitle}>
                        Consolidated performance report for settled transactions only.
                    </div>
                    <div style={styles.headerControls}>
                        <select
                            style={styles.dateRange}
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                        >
                            <option>Jan 1, 2023 - Sep 30, 2023</option>
                            <option>Q3 2023</option>
                            <option>Q2 2023</option>
                            <option>Q1 2023</option>
                        </select>
                        <button style={styles.exportButton}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path
                                    d="M7 9L4 6H6V2H8V6H10L7 9ZM2 11V12H12V11H2Z"
                                    fill="currentColor"
                                />
                            </svg>
                            Export Report
                        </button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div style={styles.kpiGrid}>
                    <div style={styles.kpiCard}>
                        <div style={styles.kpiTitle}>Current Utilization</div>
                        <div style={styles.kpiValue}>{data.kpis.currentUtilization.value.toFixed(1)}%</div>
                        <div style={{ ...styles.kpiDelta, color: getDeltaColor(data.kpis.currentUtilization.delta) }}>
                            {formatDeltaPercent(data.kpis.currentUtilization.delta)}
                        </div>
                        <div style={styles.kpiReference}>Target allocation: {data.kpis.currentUtilization.target}%</div>
                    </div>
                    <div style={styles.kpiCard}>
                        <div style={styles.kpiTitle}>Net Yield</div>
                        <div style={styles.kpiValue}>{data.kpis.netYield.value.toFixed(1)}%</div>
                        <div style={{ ...styles.kpiDelta, color: getDeltaColor(data.kpis.netYield.delta) }}>
                            {formatDeltaPercent(data.kpis.netYield.delta)}
                        </div>
                        <div style={styles.kpiReference}>vs. Benchmark: {data.kpis.netYield.benchmark}%</div>
                    </div>
                    <div style={styles.kpiCard}>
                        <div style={styles.kpiTitle}>Default Rate</div>
                        <div style={styles.kpiValue}>{data.kpis.defaultRate.value.toFixed(1)}%</div>
                        <div style={{ ...styles.kpiDelta, color: getDeltaColor(-data.kpis.defaultRate.delta) }}>
                            {formatDeltaPercent(-data.kpis.defaultRate.delta)}
                        </div>
                        <div style={styles.kpiReference}>
                            {data.kpis.defaultRate.value < data.kpis.defaultRate.tolerance
                                ? `Within tolerance (<${data.kpis.defaultRate.tolerance}%)`
                                : `Above tolerance (<${data.kpis.defaultRate.tolerance}%)`}
                        </div>
                    </div>
                    <div style={styles.kpiCard}>
                        <div style={styles.kpiTitle}>Avg Invoice Duration</div>
                        <div style={styles.kpiValue}>{Math.round(data.kpis.avgInvoiceDuration)} days</div>
                        <div style={{ ...styles.kpiDelta, color: getDeltaColor(data.kpis.avgInvoiceDuration.delta) }}>
                            {formatDelta(Math.round(data.kpis.avgInvoiceDuration.delta))} days
                        </div>
                        <div style={styles.kpiReference}>Historical avg: {data.kpis.avgInvoiceDuration.historical} days</div>
                    </div>
            </div>

            {/* Charts */}
                <div style={styles.chartSection}>
                    <div style={styles.chartCard}>
                        <div style={styles.chartTitle}>Capital Utilization Trend (12 Months)</div>
                        <div style={{ height: "280px" }}>
                            <Line data={utilizationChartData} options={utilizationChartOptions} />
                        </div>
                    </div>
                    <div style={styles.chartCard}>
                        <div style={styles.chartTitle}>Invoice Duration Distribution</div>
                        <div style={{ height: "280px" }}>
                            <Bar data={durationChartData} options={durationChartOptions} />
                        </div>
                    </div>
            </div>

                {/* Yield Composition */}
                <div style={styles.yieldSection}>
                    <div style={styles.chartTitle}>Yield Comparison</div>
                    <div style={styles.yieldBar}>
                        <div style={styles.yieldLabel}>Gross Yield</div>
                        <div style={styles.yieldBarContainer}>
                            <div
                                style={{
                                    ...styles.yieldBarFill,
                                    width: `${(data.yieldComposition.grossYield / maxYield) * 100}%`,
                                }}
                            />
                        </div>
                        <div style={styles.yieldValue}>{data.yieldComposition.grossYield.toFixed(1)}%</div>
                    </div>
                    <div style={styles.yieldBar}>
                        <div style={styles.yieldLabel}>Net Yield</div>
                        <div style={styles.yieldBarContainer}>
                            <div
                        style={{
                                    ...styles.yieldBarFill,
                                    width: `${(data.yieldComposition.netYield / maxYield) * 100}%`,
                                }}
                            />
                        </div>
                        <div style={styles.yieldValue}>{data.yieldComposition.netYield.toFixed(1)}%</div>
                            </div>
                    <div style={styles.yieldBar}>
                        <div style={styles.yieldLabel}>Benchmark</div>
                        <div style={styles.yieldBarContainer}>
                            <div
                                style={{
                                    ...styles.yieldBarFill,
                                    width: `${(data.yieldComposition.benchmarkYield / maxYield) * 100}%`,
                                }}
                            />
                        </div>
                        <div style={styles.yieldValue}>{data.yieldComposition.benchmarkYield.toFixed(1)}%</div>
                    </div>
                    <div style={styles.yieldFootnote}>
                        Net yield calculated after losses and protocol fees. Benchmark is for reference only.
                    </div>
                </div>

                {/* Default Rates by Vintage */}
                <div style={styles.tableSection}>
                    <div style={styles.tableHeader}>
                        <div style={styles.tableTitle}>Default Rates by Vintage (Cohort Analysis)</div>
                        <a href="#" style={styles.tableLink}>
                            View Full Report
                        </a>
                    </div>
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.tableHeaderRow}>
                                <th style={styles.tableHeaderCell}>Vintage</th>
                                <th style={styles.tableHeaderCell}>Originated Volume</th>
                                <th style={styles.tableHeaderCell}>Outstanding</th>
                                <th style={styles.tableHeaderCell}>Default Rate</th>
                                <th style={styles.tableHeaderCell}>Performance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.vintageAnalysis.map((vintage, idx) => (
                                <tr key={idx} style={styles.tableRow}>
                                    <td style={styles.tableCell}>{vintage.vintage}</td>
                                    <td style={styles.tableCell}>
                                        {formatAmount(vintage.originatedVolume.toString(), "TRY")}
                                    </td>
                                    <td style={styles.tableCell}>
                                        {formatAmount(vintage.outstanding.toString(), "TRY")}
                                    </td>
                                    <td style={styles.tableCell}>{vintage.defaultRate.toFixed(2)}%</td>
                                    <td style={styles.tableCell}>
                                        <span style={getPerformanceBadgeStyle(vintage.performance)}>
                                            {vintage.performance}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Disclaimer */}
                <div style={styles.disclaimer}>
                    <div style={styles.disclaimerText}>
                        <strong>Disclaimer:</strong> This report contains historical data only and is intended for
                        informational purposes. Past performance is not indicative of future results. This report does
                        not constitute investment advice. All figures are unaudited and subject to revision. Data reflects
                        settled transactions only and excludes pending or in-progress positions.
                    </div>
                    <div style={styles.disclaimerTimestamp}>
                        Last updated: {new Date(data.metadata.lastUpdated).toLocaleString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZoneName: "short",
                        })}
                        <br />
                        Data cutoff: {new Date(data.metadata.dataCutoff).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                        })}
                        <br />
                        Generated by TIFA Platform v1.0
                    </div>
                </div>
            </div>
        </div>
    );
}
