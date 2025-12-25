"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { fetchRiskSnapshot, fetchRiskHistory, fetchRiskProjection, RiskSnapshot, RiskHistory, RiskProjection } from "../../lib/backendClient";
import { formatDate } from "../../lib/format";

interface RiskExposureCardProps {
    poolId?: string;
}

type TabType = "snapshot" | "trend" | "projection";

export function RiskExposureCard({ poolId }: RiskExposureCardProps) {
    const [activeTab, setActiveTab] = useState<TabType>("snapshot");

    // Fetch risk data with auto-refresh
    const { data: snapshot, isLoading: snapshotLoading, error: snapshotError } = useSWR<RiskSnapshot>(
        ["risk-snapshot", poolId],
        () => fetchRiskSnapshot(poolId),
        { refreshInterval: 15000 } // 15s refresh
    );

    const { data: history, isLoading: historyLoading } = useSWR<RiskHistory>(
        activeTab === "trend" ? ["risk-history", poolId] : null,
        () => fetchRiskHistory(poolId, "7d"),
        { refreshInterval: 60000 } // 60s refresh
    );

    const { data: projection, isLoading: projectionLoading } = useSWR<RiskProjection>(
        activeTab === "projection" ? ["risk-projection", poolId] : null,
        () => fetchRiskProjection(poolId, "7d"),
        { refreshInterval: 60000 } // 60s refresh
    );

    // Calculate relative time
    const getRelativeTime = (timestamp: string) => {
        const now = new Date();
        const then = new Date(timestamp);
        const diffMs = now.getTime() - then.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        
        if (diffSec < 60) return `${diffSec}s ago`;
        if (diffMin < 60) return `${diffMin}m ago`;
        return `${Math.floor(diffMin / 60)}h ago`;
    };

    // Trend indicator
    const getTrendIcon = (trend: "up" | "down" | "stable") => {
        if (trend === "up") return "↑";
        if (trend === "down") return "↓";
        return "→";
    };

    const getTrendLabel = (trend: "up" | "down" | "stable") => {
        if (trend === "up") return "increasing";
        if (trend === "down") return "decreasing";
        return "stable";
    };


    if (snapshotError) {
        return (
            <div style={styles.card}>
                <div style={styles.errorState}>
                    <div style={styles.errorText}>Failed to load risk data</div>
                    <div style={styles.errorSubtext}>{snapshotError.message}</div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.card}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h2 style={styles.title}>Risk Exposure</h2>
                    {snapshot && (
                        <div style={styles.aiStatusStrip}>
                            <span style={styles.aiStatusItem}>
                                <span style={{ ...styles.statusDot, background: "#22c55e" }}></span>
                                AI Risk Engine: Running
                            </span>
                            <span style={styles.aiStatusItem}>
                                Last Scan: {getRelativeTime(snapshot.asOf)}
                            </span>
                            <span style={styles.aiStatusItem}>
                                Confidence: {Math.round(snapshot.overall.confidence * 100)}%
                            </span>
                            <span style={styles.aiStatusItem}>
                                Trend: {getTrendIcon(snapshot.overall.trend)} {getTrendLabel(snapshot.overall.trend)}
                            </span>
                        </div>
                    )}
                </div>
                <a href="#" style={styles.downloadLink} onClick={(e) => { e.preventDefault(); /* TODO: Implement download */ }}>
                    Download Report
                </a>
            </div>

            {/* Tabs */}
            <div style={styles.tabs}>
                <button
                    style={{ ...styles.tab, ...(activeTab === "snapshot" ? styles.tabActive : {}) }}
                    onClick={() => setActiveTab("snapshot")}
                >
                    Snapshot
                </button>
                <button
                    style={{ ...styles.tab, ...(activeTab === "trend" ? styles.tabActive : {}) }}
                    onClick={() => setActiveTab("trend")}
                >
                    7D Trend
                </button>
                <button
                    style={{ ...styles.tab, ...(activeTab === "projection" ? styles.tabActive : {}) }}
                    onClick={() => setActiveTab("projection")}
                >
                    AI Projection
                </button>
            </div>

            {/* Tab Content */}
            <div style={styles.tabContentWrapper}>
                {snapshotLoading ? (
                    <div style={styles.loadingState}>
                        <div style={styles.skeleton}></div>
                        <div style={styles.skeleton}></div>
                        <div style={styles.skeleton}></div>
                    </div>
                ) : snapshot ? (
                    <>
                        {activeTab === "snapshot" && <SnapshotTab snapshot={snapshot} />}
                        {activeTab === "trend" && <TrendTab history={history} loading={historyLoading} />}
                        {activeTab === "projection" && <ProjectionTab projection={projection} loading={projectionLoading} snapshot={snapshot} />}
                    </>
                ) : null}
            </div>

            {/* Footer */}
            {snapshot && (
                <div style={styles.footer}>
                    <span style={styles.footerText}>
                        Last updated: {formatDate(snapshot.asOf)} • Auto refresh every 15s
                    </span>
                </div>
            )}
        </div>
    );
}

// Snapshot Tab Component
function SnapshotTab({ snapshot }: { snapshot: RiskSnapshot }) {
    const getRiskScoreColor = (label: "Low" | "Medium" | "Elevated") => {
        if (label === "Low") return "#22c55e";
        if (label === "Medium") return "#f59e0b";
        return "#ef4444";
    };

    const getStatusColor = (status: "safe" | "watch" | "critical") => {
        if (status === "safe") return "#22c55e";
        if (status === "watch") return "#f59e0b";
        return "#ef4444";
    };

    const getSeverityColor = (severity: "info" | "watch" | "alert") => {
        if (severity === "info") return "#3b82f6";
        if (severity === "watch") return "#f59e0b";
        return "#ef4444";
    };

    return (
        <div style={styles.tabContent}>
            {/* Overall Risk Score */}
            <div style={styles.riskScoreBlock}>
                <div style={styles.riskScoreLabel}>Overall Risk</div>
                <div style={styles.riskScoreValue}>
                    <span style={{ ...styles.riskScoreLabelText, color: getRiskScoreColor(snapshot.overall.label) }}>
                        {snapshot.overall.label}
                    </span>
                    <span style={styles.riskScoreNumber}>{snapshot.overall.score}</span>
                </div>
                <div style={styles.riskGauge}>
                    <div style={styles.riskGaugeTrack}>
                        <div
                            style={{
                                ...styles.riskGaugeFill,
                                width: `${snapshot.overall.score}%`,
                                background: getRiskScoreColor(snapshot.overall.label),
                            }}
                        ></div>
                        <div style={{ ...styles.riskGaugeMarker, left: "35%" }}></div>
                        <div style={{ ...styles.riskGaugeMarker, left: "70%" }}></div>
                    </div>
                    <div style={styles.riskGaugeLabels}>
                        <span>0</span>
                        <span>35</span>
                        <span>70</span>
                        <span>100</span>
                    </div>
                </div>
            </div>

            {/* Exposure by Sector */}
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Exposure by Sector</h3>
                <div style={styles.sectorList}>
                    {snapshot.sectors.map((sector, idx) => {
                        const riskWeightedPct = sector.allocationPct * sector.riskMultiplier;
                        const maxRiskWeighted = Math.max(...snapshot.sectors.map(s => s.allocationPct * s.riskMultiplier));
                        const normalizedRiskWeighted = maxRiskWeighted > 0 ? riskWeightedPct / maxRiskWeighted : 0;
                        
                        return (
                            <div key={idx} style={styles.sectorRow}>
                                <div style={styles.sectorInfo}>
                                    <span style={styles.sectorName}>{sector.name}</span>
                                    <span style={styles.sectorBadge}>{sector.riskMultiplier.toFixed(2)}x</span>
                                </div>
                                <div style={styles.sectorBarContainer}>
                                    <div style={styles.sectorBarBase}>
                                        <div
                                            style={{
                                                ...styles.sectorBarFill,
                                                width: `${sector.allocationPct * 100}%`,
                                            }}
                                        ></div>
                                    </div>
                                    <div style={styles.sectorBarOverlay}>
                                        <div
                                            style={{
                                                ...styles.sectorBarOverlayLine,
                                                width: `${normalizedRiskWeighted * 100}%`,
                                            }}
                                        ></div>
                                    </div>
                                    <span style={styles.sectorPct}>{(sector.allocationPct * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {snapshot.driversTop.length > 0 && (
                    <div style={styles.driversChips}>
                        {snapshot.driversTop.slice(0, 3).map((driver, idx) => (
                            <span key={idx} style={styles.driverChip}>
                                {driver}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Structure Breakdown */}
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Structure</h3>
                <div style={styles.structureBar}>
                    <div
                        style={{
                            ...styles.structureBarSegment,
                            width: `${snapshot.structure.recoursePct * 100}%`,
                            background: "#22c55e",
                        }}
                    >
                        {snapshot.structure.recoursePct > 0.1 && (
                            <span style={styles.structureBarLabel}>
                                Recourse {(snapshot.structure.recoursePct * 100).toFixed(1)}%
                            </span>
                        )}
                    </div>
                    <div
                        style={{
                            ...styles.structureBarSegment,
                            width: `${snapshot.structure.nonRecoursePct * 100}%`,
                            background: "#f59e0b",
                        }}
                    >
                        {snapshot.structure.nonRecoursePct > 0.1 && (
                            <span style={styles.structureBarLabel}>
                                Non-Recourse {(snapshot.structure.nonRecoursePct * 100).toFixed(1)}%
                            </span>
                        )}
                    </div>
                </div>
                {snapshot.structure.aiPreference && (
                    <div style={styles.aiPreference}>
                        AI prefers {snapshot.structure.aiPreference === "recourse" ? "Recourse" : "Non-Recourse"}-heavy
                    </div>
                )}
            </div>

            {/* Stress Indicators */}
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Stress Indicators</h3>
                <div style={styles.stressGrid}>
                    {Object.entries(snapshot.stress).map(([key, metric]) => (
                        <div key={key} style={styles.stressMetric}>
                            <div style={styles.stressMetricHeader}>
                                <span style={styles.stressMetricLabel}>
                                    {key === "defaultBuffer" ? "Default Buffer" :
                                     key === "avgTenorDays" ? "Avg Tenor" :
                                     key === "top5Concentration" ? "Concentration" :
                                     "Overdue Rate"}
                                </span>
                                <span style={{ ...styles.statusPill, background: getStatusColor(metric.status) + "20", color: getStatusColor(metric.status) }}>
                                    {metric.status}
                                </span>
                            </div>
                            <div style={styles.stressMetricValue}>
                                {key === "defaultBuffer" ? `${metric.value.toFixed(2)}x` :
                                 key === "avgTenorDays" ? `${metric.value} Days` :
                                 key === "top5Concentration" ? `${(metric.value * 100).toFixed(1)}%` :
                                 `${(metric.value * 100).toFixed(2)}%`}
                            </div>
                            {/* Simple sparkline placeholder */}
                            <div style={styles.sparkline}>
                                {metric.series.slice(-10).map((val, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            ...styles.sparklineBar,
                                            height: `${(val / Math.max(...metric.series)) * 100}%`,
                                        }}
                                    ></div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* AI Observations */}
            {snapshot.observations.length > 0 && (
                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>AI Observations</h3>
                    <div style={styles.observationsList}>
                        {snapshot.observations.map((obs) => (
                            <div key={obs.id} style={styles.observation}>
                                <span style={{ ...styles.observationSeverity, color: getSeverityColor(obs.severity) }}>
                                    {obs.severity.toUpperCase()}
                                </span>
                                <span style={styles.observationText}>{obs.text}</span>
                                <span style={styles.observationTime}>
                                    {new Date(obs.ts).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Trend Tab Component
function TrendTab({ history, loading }: { history: RiskHistory | undefined; loading: boolean }) {
    if (loading) {
        return <div style={styles.loadingState}>Loading trend data...</div>;
    }

    if (!history || history.points.length === 0) {
        return <div style={styles.emptyState}>No historical data available</div>;
    }

    return (
        <div style={styles.tabContent}>
            <div style={styles.trendChart}>
                {/* Simple line chart placeholder */}
                <svg width="100%" height="200" style={{ border: "1px solid #e0e0e0", borderRadius: "4px" }}>
                    <text x="10" y="20" fontSize="12" fill="#666">Overall Risk Score (7D)</text>
                    {history.points.map((point, idx) => {
                        const x = (idx / (history.points.length - 1 || 1)) * 100;
                        const y = 100 - point.overallScore;
                        return (
                            <circle
                                key={idx}
                                cx={`${x}%`}
                                cy={`${y}%`}
                                r="3"
                                fill="#2563eb"
                            />
                        );
                    })}
                </svg>
            </div>
            {history.sectorChanges.length > 0 && (
                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Top Changes</h3>
                    <div style={styles.changesTable}>
                        {history.sectorChanges.map((change, idx) => (
                            <div key={idx} style={styles.changeRow}>
                                <span>{change.name}</span>
                                <span>
                                    Allocation: {(change.allocationDelta * 100).toFixed(1)}% • 
                                    Multiplier: {change.multiplierDelta > 0 ? "+" : ""}{change.multiplierDelta.toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Projection Tab Component
function ProjectionTab({ projection, loading, snapshot }: { projection: RiskProjection | undefined; loading: boolean; snapshot: RiskSnapshot }) {
    if (loading) {
        return <div style={styles.loadingState}>Loading projection...</div>;
    }

    if (!projection) {
        return <div style={styles.emptyState}>No projection data available</div>;
    }

    return (
        <div style={styles.tabContent}>
            <div style={styles.projectionChart}>
                <svg width="100%" height="200" style={{ border: "1px solid #e0e0e0", borderRadius: "4px" }}>
                    <text x="10" y="20" fontSize="12" fill="#666">Projected Risk Score (next 7 days)</text>
                    {/* Current score */}
                    <circle cx="10%" cy={`${100 - snapshot.overall.score}%`} r="4" fill="#2563eb" />
                    {/* Projected points */}
                    {projection.projectedPoints.map((point, idx) => {
                        const x = 10 + ((idx + 1) / projection.projectedPoints.length) * 90;
                        const y = 100 - point.score;
                        return (
                            <circle
                                key={idx}
                                cx={`${x}%`}
                                cy={`${y}%`}
                                r="3"
                                fill="none"
                                stroke="#2563eb"
                                strokeDasharray="3,3"
                            />
                        );
                    })}
                </svg>
            </div>
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Assumptions</h3>
                <div style={styles.assumptionsChips}>
                    {projection.assumptions.map((assumption, idx) => (
                        <span key={idx} style={styles.assumptionChip}>
                            {assumption}
                        </span>
                    ))}
                </div>
            </div>
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>What would change this projection?</h3>
                <ul style={styles.explainabilityList}>
                    {projection.explainability.map((item, idx) => (
                        <li key={idx} style={styles.explainabilityItem}>{item}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

// Styles
const styles = {
    card: {
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        padding: "24px",
        marginTop: "0px",
        maxHeight: "600px",
        display: "flex",
        flexDirection: "column" as const,
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "20px",
    },
    title: {
        fontSize: "18px",
        fontWeight: 700,
        color: "#1a1a1a",
        margin: 0,
        marginBottom: "8px",
    },
    aiStatusStrip: {
        display: "flex",
        gap: "16px",
        fontSize: "11px",
        color: "#666",
        flexWrap: "wrap" as const,
    },
    aiStatusItem: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
    },
    statusDot: {
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        display: "inline-block",
    },
    downloadLink: {
        fontSize: "12px",
        color: "#2563eb",
        textDecoration: "none",
        fontWeight: 500,
    },
    tabs: {
        display: "flex",
        gap: "8px",
        borderBottom: "1px solid #e0e0e0",
        marginBottom: "24px",
    },
    tab: {
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#666",
        background: "none",
        border: "none",
        borderBottom: "2px solid transparent",
        cursor: "pointer",
    },
    tabActive: {
        color: "#1a1a1a",
        borderBottomColor: "#2563eb",
    },
    tabContentWrapper: {
        flex: 1,
        overflowY: "auto" as const,
        overflowX: "hidden" as const,
        minHeight: 0,
        // Custom scrollbar styling for webkit browsers
        WebkitOverflowScrolling: "touch" as const,
    },
    tabContent: {
        paddingRight: "8px",
    },
    loadingState: {
        padding: "40px",
        textAlign: "center" as const,
        color: "#666",
    },
    skeleton: {
        height: "20px",
        background: "#f0f0f0",
        borderRadius: "4px",
        marginBottom: "12px",
    },
    errorState: {
        padding: "40px",
        textAlign: "center" as const,
    },
    errorText: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#ef4444",
        marginBottom: "4px",
    },
    errorSubtext: {
        fontSize: "12px",
        color: "#666",
    },
    emptyState: {
        padding: "40px",
        textAlign: "center" as const,
        color: "#666",
    },
    footer: {
        marginTop: "auto",
        paddingTop: "16px",
        borderTop: "1px solid #e0e0e0",
        flexShrink: 0,
    },
    footerText: {
        fontSize: "11px",
        color: "#999",
    },
    // Snapshot styles
    riskScoreBlock: {
        marginBottom: "32px",
        padding: "20px",
        background: "#f8f9fa",
        borderRadius: "8px",
    },
    riskScoreLabel: {
        fontSize: "12px",
        fontWeight: 600,
        color: "#666",
        marginBottom: "8px",
    },
    riskScoreValue: {
        display: "flex",
        alignItems: "baseline",
        gap: "12px",
        marginBottom: "12px",
    },
    riskScoreLabelText: {
        fontSize: "20px",
        fontWeight: 700,
    },
    riskScoreNumber: {
        fontSize: "32px",
        fontWeight: 700,
        color: "#1a1a1a",
    },
    riskGauge: {
        marginTop: "12px",
    },
    riskGaugeTrack: {
        position: "relative" as const,
        height: "8px",
        background: "#e0e0e0",
        borderRadius: "4px",
        overflow: "hidden" as const,
    },
    riskGaugeFill: {
        height: "100%",
        borderRadius: "4px",
        transition: "width 0.3s ease",
    },
    riskGaugeMarker: {
        position: "absolute" as const,
        top: 0,
        width: "2px",
        height: "100%",
        background: "#999",
    },
    riskGaugeLabels: {
        display: "flex",
        justifyContent: "space-between",
        fontSize: "10px",
        color: "#999",
        marginTop: "4px",
    },
    section: {
        marginBottom: "32px",
    },
    sectionTitle: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "16px",
    },
    sectorList: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "16px",
    },
    sectorRow: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "8px",
    },
    sectorInfo: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    sectorName: {
        fontSize: "13px",
        fontWeight: 500,
        color: "#1a1a1a",
    },
    sectorBadge: {
        fontSize: "11px",
        padding: "2px 8px",
        background: "#f0f0f0",
        borderRadius: "4px",
        color: "#666",
    },
    sectorBarContainer: {
        position: "relative" as const,
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    sectorBarBase: {
        flex: 1,
        height: "12px",
        background: "#e0e0e0",
        borderRadius: "6px",
        overflow: "hidden" as const,
    },
    sectorBarFill: {
        height: "100%",
        background: "#2563eb",
        borderRadius: "6px",
    },
    sectorBarOverlay: {
        position: "absolute" as const,
        top: 0,
        left: 0,
        width: "100%",
        height: "12px",
        pointerEvents: "none" as const,
    },
    sectorBarOverlayLine: {
        height: "2px",
        background: "#ef4444",
        marginTop: "5px",
    },
    sectorPct: {
        fontSize: "12px",
        fontWeight: 600,
        color: "#1a1a1a",
        minWidth: "50px",
        textAlign: "right" as const,
    },
    driversChips: {
        display: "flex",
        gap: "8px",
        marginTop: "12px",
        flexWrap: "wrap" as const,
    },
    driverChip: {
        fontSize: "11px",
        padding: "4px 10px",
        background: "#f0f0f0",
        borderRadius: "4px",
        color: "#666",
    },
    structureBar: {
        display: "flex",
        height: "32px",
        borderRadius: "4px",
        overflow: "hidden" as const,
        marginBottom: "8px",
    },
    structureBarSegment: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        fontWeight: 500,
        color: "#ffffff",
    },
    structureBarLabel: {
        fontSize: "11px",
        fontWeight: 600,
    },
    aiPreference: {
        fontSize: "12px",
        color: "#666",
        fontStyle: "italic" as const,
    },
    stressGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "16px",
    },
    stressMetric: {
        padding: "12px",
        background: "#f8f9fa",
        borderRadius: "4px",
    },
    stressMetricHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "8px",
    },
    stressMetricLabel: {
        fontSize: "12px",
        fontWeight: 500,
        color: "#666",
    },
    stressMetricValue: {
        fontSize: "18px",
        fontWeight: 700,
        color: "#1a1a1a",
        marginBottom: "8px",
    },
    statusPill: {
        fontSize: "10px",
        padding: "2px 8px",
        borderRadius: "4px",
        fontWeight: 600,
        textTransform: "uppercase" as const,
    },
    sparkline: {
        display: "flex",
        alignItems: "flex-end" as const,
        gap: "2px",
        height: "30px",
    },
    sparklineBar: {
        flex: 1,
        background: "#2563eb",
        borderRadius: "2px 2px 0 0",
        minHeight: "2px",
    },
    observationsList: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "12px",
    },
    observation: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px",
        background: "#f8f9fa",
        borderRadius: "4px",
    },
    observationSeverity: {
        fontSize: "10px",
        fontWeight: 700,
        textTransform: "uppercase" as const,
        minWidth: "50px",
    },
    observationText: {
        flex: 1,
        fontSize: "12px",
        color: "#1a1a1a",
    },
    observationTime: {
        fontSize: "11px",
        color: "#999",
    },
    trendChart: {
        marginBottom: "24px",
    },
    changesTable: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "8px",
    },
    changeRow: {
        display: "flex",
        justifyContent: "space-between",
        fontSize: "12px",
        padding: "8px",
        background: "#f8f9fa",
        borderRadius: "4px",
    },
    projectionChart: {
        marginBottom: "24px",
    },
    assumptionsChips: {
        display: "flex",
        gap: "8px",
        flexWrap: "wrap" as const,
    },
    assumptionChip: {
        fontSize: "11px",
        padding: "4px 10px",
        background: "#f0f0f0",
        borderRadius: "4px",
        color: "#666",
    },
    explainabilityList: {
        fontSize: "12px",
        color: "#666",
        lineHeight: "1.6",
        paddingLeft: "20px",
    },
    explainabilityItem: {
        marginBottom: "8px",
    },
};

