"use client";

import React, { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { fetchAgentConsole, AgentConsoleData } from "../../lib/backendClient";
import { useWebSocket } from "../../lib/websocketClient";

// Institutional design styles - same as Portfolio Analytics
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
    statusBar: {
        display: "flex",
        gap: "32px",
        alignItems: "center",
        marginTop: "16px",
        fontSize: "12px",
        color: "#6b7280",
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
        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
    },
    statusDotIdle: {
        background: "#9ca3af",
        animation: "none",
    },
    statusDotAlert: {
        background: "#f59e0b",
        animation: "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
    },
    agentGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "20px",
        marginBottom: "40px",
    },
    agentCard: {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "0",
        padding: "20px",
        position: "relative",
    },
    agentCardAlert: {
        borderColor: "#f59e0b",
        backgroundColor: "#fffbeb",
    },
    agentName: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "8px",
    },
    agentScope: {
        fontSize: "12px",
        color: "#6b7280",
        marginBottom: "12px",
        lineHeight: "1.5",
    },
    agentState: {
        fontSize: "11px",
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        marginBottom: "8px",
    },
    agentStateActive: {
        color: "#16a34a",
    },
    agentStateIdle: {
        color: "#6b7280",
    },
    agentStateAlerting: {
        color: "#f59e0b",
    },
    agentMeta: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "11px",
        color: "#9ca3af",
        marginTop: "12px",
    },
    confidenceBar: {
        height: "4px",
        background: "#f3f4f6",
        borderRadius: "2px",
        overflow: "hidden",
        marginTop: "8px",
    },
    confidenceFill: {
        height: "100%",
        background: "#2563eb",
        borderRadius: "2px",
        transition: "width 0.3s ease",
    },
    signalsPanel: {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "0",
        padding: "24px",
        marginBottom: "40px",
        maxHeight: "400px",
        overflowY: "auto",
    },
    signalsTitle: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "20px",
    },
    signalItem: {
        padding: "12px 0",
        borderBottom: "1px solid #f3f4f6",
    },
    signalHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "4px",
    },
    signalMessage: {
        fontSize: "13px",
        color: "#374151",
        flex: 1,
    },
    signalMeta: {
        fontSize: "11px",
        color: "#9ca3af",
        display: "flex",
        gap: "12px",
    },
    severityBadge: {
        fontSize: "10px",
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.3px",
        padding: "2px 6px",
        borderRadius: "2px",
    },
    severityLow: {
        background: "#dcfce7",
        color: "#166534",
    },
    severityMedium: {
        background: "#fef3c7",
        color: "#92400e",
    },
    severityHigh: {
        background: "#fee2e2",
        color: "#991b1b",
    },
    traceSection: {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "0",
        padding: "24px",
        marginBottom: "40px",
    },
    traceTitle: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "20px",
    },
    traceItem: {
        padding: "20px 0",
        borderBottom: "1px solid #f3f4f6",
        position: "relative",
        paddingLeft: "32px",
    },
    traceTimeline: {
        position: "absolute",
        left: "0",
        top: "24px",
        bottom: "-1px",
        width: "2px",
        background: "#e5e7eb",
    },
    traceDot: {
        position: "absolute",
        left: "-5px",
        top: "24px",
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        background: "#2563eb",
        border: "2px solid #ffffff",
    },
    traceTimestamp: {
        fontSize: "11px",
        color: "#9ca3af",
        marginBottom: "8px",
    },
    traceStep: {
        marginBottom: "12px",
    },
    traceStepLabel: {
        fontSize: "11px",
        fontWeight: 600,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        marginBottom: "4px",
    },
    traceStepContent: {
        fontSize: "13px",
        color: "#374151",
        lineHeight: "1.5",
    },
    recommendationsSection: {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "0",
        padding: "24px",
        marginBottom: "40px",
    },
    recommendationsTitle: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "20px",
    },
    recommendationCard: {
        padding: "16px",
        border: "1px solid #e5e7eb",
        borderRadius: "0",
        marginBottom: "16px",
        background: "#f9fafb",
    },
    recommendationHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "12px",
    },
    recommendationSummary: {
        fontSize: "13px",
        fontWeight: 600,
        color: "#1a1a1a",
        flex: 1,
    },
    recommendationConfidence: {
        fontSize: "11px",
        color: "#6b7280",
    },
    recommendationReasoning: {
        fontSize: "12px",
        color: "#6b7280",
        marginBottom: "8px",
        lineHeight: "1.5",
    },
    approvalBadge: {
        fontSize: "10px",
        fontWeight: 500,
        color: "#dc2626",
        textTransform: "uppercase",
        letterSpacing: "0.3px",
    },
    controlPanel: {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "0",
        padding: "24px",
        marginBottom: "40px",
    },
    controlPanelTitle: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "20px",
    },
    controlButton: {
        fontSize: "12px",
        fontWeight: 500,
        padding: "8px 16px",
        border: "1px solid #dc2626",
        borderRadius: "4px",
        background: "#ffffff",
        color: "#dc2626",
        cursor: "pointer",
        marginRight: "12px",
    },
    transparencySection: {
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "0",
        padding: "24px",
        marginBottom: "40px",
    },
    transparencyTitle: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "16px",
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    transparencyContent: {
        fontSize: "12px",
        color: "#6b7280",
        lineHeight: "1.8",
    },
    transparencyItem: {
        marginBottom: "12px",
    },
    transparencyLabel: {
        fontWeight: 600,
        color: "#374151",
        marginRight: "8px",
    },
    auditSection: {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "0",
        padding: "24px",
    },
    auditTitle: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "20px",
    },
    auditStatement: {
        fontSize: "12px",
        color: "#6b7280",
        marginBottom: "16px",
        fontStyle: "italic",
    },
    auditMeta: {
        fontSize: "11px",
        color: "#9ca3af",
    },
};

// Add CSS animation for pulsing dots
const styleSheet = document.createElement("style");
styleSheet.textContent = `
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`;
if (typeof document !== "undefined" && !document.getElementById("agent-console-styles")) {
    styleSheet.id = "agent-console-styles";
    document.head.appendChild(styleSheet);
}

function formatTimestamp(timestamp: string | Date): string {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function formatRelativeTime(timestamp: string | Date): string {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

export default function AgentConsolePage() {
    const pathname = usePathname();
    const { data, error, isLoading } = useSWR<AgentConsoleData>(
        "agent-console",
        () => fetchAgentConsole(),
        { refreshInterval: 5000 } // Refresh every 5 seconds
    );

    const [transparencyExpanded, setTransparencyExpanded] = useState(false);

    if (isLoading) {
        return (
            <div style={styles.page}>
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
                    <div style={{ textAlign: "center", padding: "60px", color: "#6b7280" }}>
                        Loading agent console...
                    </div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={styles.page}>
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
                    <div style={{ textAlign: "center", padding: "60px", color: "#dc2626" }}>
                        Failed to load agent console data.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            {/* Top Navbar */}
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
                {/* Page Header */}
                <div style={styles.header}>
                    <div style={styles.title}>AI Agent Console</div>
                    <div style={styles.subtitle}>
                        Autonomous risk monitoring and decision support system.
                    </div>
                    <div style={styles.statusBar}>
                        <div style={styles.statusItem}>
                            <span style={{
                                ...styles.statusDot,
                                ...(data.systemStatus.engineStatus === "Running" ? {} : styles.statusDotIdle)
                            }}></span>
                            <span><strong>Engine Status:</strong> {data.systemStatus.engineStatus}</span>
                        </div>
                        <div style={styles.statusItem}>
                            <span><strong>Active Agents:</strong> {data.systemStatus.activeAgents}</span>
                        </div>
                        <div style={styles.statusItem}>
                            <span><strong>Last Evaluation Cycle:</strong> {formatTimestamp(data.systemStatus.lastEvaluation)}</span>
                        </div>
                        <div style={styles.statusItem}>
                            <span><strong>System Load:</strong> {data.systemStatus.systemLoad}%</span>
                        </div>
                    </div>
                </div>

                {/* Agent Overview Grid */}
                <div style={styles.agentGrid}>
                    {data.agents.map((agent) => {
                        const isAlerting = agent.state === "Alerting";
                        const stateStyle = agent.state === "Active" ? styles.agentStateActive :
                            agent.state === "Idle" ? styles.agentStateIdle :
                            styles.agentStateAlerting;
                        const dotStyle = agent.state === "Active" ? styles.statusDot :
                            agent.state === "Alerting" ? styles.statusDotAlert :
                            styles.statusDotIdle;

                        return (
                            <div key={agent.id} style={{ ...styles.agentCard, ...(isAlerting ? styles.agentCardAlert : {}) }}>
                                <div style={styles.agentName}>{agent.name}</div>
                                <div style={styles.agentScope}>{agent.scope}</div>
                                <div style={{ ...styles.agentState, ...stateStyle }}>
                                    <span style={dotStyle}></span> {agent.state}
                                </div>
                                <div style={styles.confidenceBar}>
                                    <div style={{ ...styles.confidenceFill, width: `${agent.confidence}%` }}></div>
                                </div>
                                <div style={styles.agentMeta}>
                                    <span>Confidence: {agent.confidence}%</span>
                                    <span>{formatRelativeTime(agent.lastAction)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Two Column Layout: Signals & Decision Traces */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "40px" }}>
                    {/* Live Signals Panel */}
                    <div style={styles.signalsPanel}>
                        <div style={styles.signalsTitle}>Live Signals & Insights</div>
                        {data.signals.map((signal) => {
                            const severityStyle = signal.severity === "High" ? styles.severityHigh :
                                signal.severity === "Medium" ? styles.severityMedium :
                                styles.severityLow;

                            return (
                                <div key={signal.id} style={styles.signalItem}>
                                    <div style={styles.signalHeader}>
                                        <div style={styles.signalMessage}>{signal.message}</div>
                                        <span style={{ ...styles.severityBadge, ...severityStyle }}>
                                            {signal.severity}
                </span>
                                    </div>
                                    <div style={styles.signalMeta}>
                                        <span>{formatTimestamp(signal.timestamp)}</span>
                                        <span>{signal.sourceAgent.replace("-", " ")}</span>
                                        <a href="#" style={{ color: "#2563eb", textDecoration: "none", fontSize: "11px" }}>
                                            View context
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Decision Traces */}
                    <div style={styles.traceSection}>
                        <div style={styles.traceTitle}>Decision Trace View</div>
                        {data.decisionTraces.map((trace, idx) => (
                            <div key={trace.id} style={styles.traceItem}>
                                <div style={styles.traceTimeline}></div>
                                <div style={styles.traceDot}></div>
                                <div style={styles.traceTimestamp}>{formatTimestamp(trace.timestamp)}</div>
                                
                                <div style={styles.traceStep}>
                                    <div style={styles.traceStepLabel}>Inputs</div>
                                    <div style={styles.traceStepContent}>
                                        Invoice: {trace.inputs.invoiceId || "N/A"}, 
                                        Status: {trace.inputs.previousStatus || "N/A"}, 
                                        Risk: {trace.inputs.riskScore || "N/A"}
                                    </div>
                                </div>
                                
                                <div style={styles.traceStep}>
                                    <div style={styles.traceStepLabel}>Signals</div>
                                    <div style={styles.traceStepContent}>
                                        {trace.signals.length > 0 
                                            ? trace.signals.map(s => s.message).join("; ")
                                            : "No signals"}
                                    </div>
                                </div>
                                
                                <div style={styles.traceStep}>
                                    <div style={styles.traceStepLabel}>Evaluation</div>
                                    <div style={styles.traceStepContent}>
                                        {trace.evaluation.reasoning}
                                    </div>
                                </div>
                                
                                <div style={styles.traceStep}>
                                    <div style={styles.traceStepLabel}>Recommendation</div>
                                    <div style={styles.traceStepContent}>
                                        {trace.recommendation.action} (Confidence: {trace.recommendation.confidence}%)
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recommendations Section */}
                <div style={styles.recommendationsSection}>
                    <div style={styles.recommendationsTitle}>Recommendations (Read-Only)</div>
                    {data.recommendations.map((rec) => (
                        <div key={rec.id} style={styles.recommendationCard}>
                            <div style={styles.recommendationHeader}>
                                <div style={styles.recommendationSummary}>{rec.summary}</div>
                                <div style={styles.recommendationConfidence}>Confidence: {rec.confidence}%</div>
                            </div>
                            <div style={styles.recommendationReasoning}>{rec.reasoning}</div>
                            {rec.requiresApproval && (
                                <div style={styles.approvalBadge}>Human Approval Required</div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Agent Control Panel */}
                <div style={styles.controlPanel}>
                    <div style={styles.controlPanelTitle}>Agent Control Panel</div>
                    <div>
                        <button style={styles.controlButton} onClick={() => alert("This action requires confirmation.")}>
                            Pause AI Engine
                        </button>
                        <button style={styles.controlButton} onClick={() => alert("This action requires confirmation.")}>
                            Adjust Sensitivity
                        </button>
                        <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                            Administrative controls require elevated permissions.
                        </span>
                    </div>
                </div>

                {/* Model Transparency */}
                <div style={styles.transparencySection}>
                    <div 
                        style={styles.transparencyTitle}
                        onClick={() => setTransparencyExpanded(!transparencyExpanded)}
                    >
                        <span>Model Transparency</span>
                        <span>{transparencyExpanded ? "−" : "+"}</span>
                    </div>
                    {transparencyExpanded && (
                        <div style={styles.transparencyContent}>
                            <div style={styles.transparencyItem}>
                                <span style={styles.transparencyLabel}>Data Sources:</span>
                                {data.modelTransparency.dataSources.join(", ")}
                            </div>
                            <div style={styles.transparencyItem}>
                                <span style={styles.transparencyLabel}>Update Frequency:</span>
                                {data.modelTransparency.updateFrequency}
                            </div>
                            <div style={styles.transparencyItem}>
                                <span style={styles.transparencyLabel}>Model Class:</span>
                                {data.modelTransparency.modelClass}
                            </div>
                            <div style={styles.transparencyItem}>
                                <span style={styles.transparencyLabel}>Last Retraining:</span>
                                {formatTimestamp(data.modelTransparency.lastRetraining)}
                            </div>
                            <div style={styles.transparencyItem}>
                                <span style={styles.transparencyLabel}>Version:</span>
                                {data.modelTransparency.version}
                            </div>
                        </div>
                    )}
                </div>

                {/* Audit & Logging */}
                <div style={styles.auditSection}>
                    <div style={styles.auditTitle}>Audit & Logging</div>
                    <div style={styles.auditStatement}>
                        All AI actions are logged and reviewable.
                    </div>
                    <div style={styles.auditMeta}>
                        Total Decisions: {data.auditLog.totalDecisions} | 
                        Last Updated: {formatTimestamp(data.auditLog.lastUpdated)} | 
                        {data.auditLog.exportable && <a href="#" style={{ color: "#2563eb", textDecoration: "none", marginLeft: "8px" }}>Export Log</a>}
                    </div>
                </div>
            </div>
        </div>
    );
}
