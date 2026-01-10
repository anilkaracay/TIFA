"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { useAccount } from "wagmi";
import { fetchAgentConsole, AgentConsoleData, fetchAgentConfig, pauseAgent, resumeAgent, updateAgentConfig, AgentConfig, fetchSystemParameters, fetchPredictiveIntelligence, SystemParameters, PredictiveIntelligence } from "../../lib/backendClient";
import { useWebSocket } from "../../lib/websocketClient";

// Premium AI gradient system - blue-violet-indigo
const aiGradients = {
    primary: "linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)",
    active: "linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)",
    subtle: "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 50%, rgba(139, 92, 246, 0.1) 100%)",
    border: "linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(99, 102, 241, 0.3) 50%, rgba(139, 92, 246, 0.3) 100%)",
    progress: "linear-gradient(90deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)",
};

// Institutional design styles - same as Portfolio Analytics
const styles = {
    page: {
        minHeight: "100vh",
        background: "#ffffff",
        backgroundImage: "url('/agentPageBG.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        padding: "0",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
        color: "#1a1a1a",
        display: "flex",
        flexDirection: "column",
        position: "relative",
    },
    pageOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(255, 255, 255, 0.15)",
        zIndex: 0,
    },
    pageContent: {
        position: "relative",
        zIndex: 1,
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
    navLinkHover: {
        color: "#1e293b",
        background: "rgba(15, 23, 42, 0.04)",
    },
    navLinkActive: {
        color: "#2563eb",
        background: "rgba(37, 99, 235, 0.08)",
        fontWeight: 600,
    },
    navLinkActiveIndicator: {
        position: "absolute" as const,
        bottom: "8px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "4px",
        height: "4px",
        borderRadius: "50%",
        background: "#2563eb",
    },
    navRight: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
    },
    container: {
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "40px",
        flex: 1,
        width: "100%",
        background: "rgba(255, 255, 255, 0.3)",
        backdropFilter: "blur(3px)",
        borderRadius: "8px",
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
        padding: "16px 24px",
        background: "#fafbfc",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        position: "relative",
        overflow: "hidden",
    },
    aiEngineHeader: {
        display: "flex",
        gap: "40px",
        alignItems: "center",
        padding: "16px 24px",
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        marginBottom: "32px",
        position: "relative" as const,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        fontSize: "13px",
        color: "#374151",
    },
    aiEngineHeaderActive: {
        borderImage: `${aiGradients.border} 1`,
        boxShadow: `0 0 0 1px rgba(59, 130, 246, 0.1), 0 1px 3px rgba(0, 0, 0, 0.05)`,
    },
    statusItem: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "13px",
        color: "#374151",
    },
    statusItemWithBar: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        minWidth: "120px",
    },
    systemLoadBar: {
        height: "4px",
        background: "#f3f4f6",
        borderRadius: "2px",
        overflow: "hidden",
        position: "relative",
    },
    systemLoadFill: {
        height: "100%",
        background: aiGradients.progress,
        borderRadius: "2px",
        transition: "width 0.6s ease",
        animation: "shimmer 2s infinite",
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
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(229, 231, 235, 0.8)",
        borderRadius: "8px",
        padding: "20px",
        position: "relative",
        transition: "all 0.3s ease",
    },
    agentCardActive: {
        border: `1px solid transparent`,
        background: `linear-gradient(#ffffff, #ffffff) padding-box, ${aiGradients.border} border-box`,
        boxShadow: `0 0 0 1px rgba(59, 130, 246, 0.1), 0 2px 8px rgba(59, 130, 246, 0.08)`,
    },
    agentCardIdle: {
        border: "1px solid #e5e7eb",
        opacity: 0.85,
    },
    agentCardAlert: {
        borderColor: "#f59e0b",
        backgroundColor: "#fffbeb",
        boxShadow: "0 0 0 1px rgba(245, 158, 11, 0.1)",
    },
    agentActivityLine: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "2px",
        background: aiGradients.progress,
        borderRadius: "8px 8px 0 0",
        animation: "pulseLine 2s ease-in-out infinite",
        opacity: 0.6,
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
        background: aiGradients.progress,
        borderRadius: "2px",
        transition: "width 0.6s ease",
        backgroundSize: "200% 100%",
        animation: "shimmer 2s infinite",
    },
    lastActionSummary: {
        fontSize: "11px",
        color: "#6b7280",
        marginTop: "8px",
        paddingTop: "8px",
        borderTop: "1px solid #f3f4f6",
        fontStyle: "italic",
    },
    signalsPanel: {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "24px",
        marginBottom: "40px",
        maxHeight: "400px",
        overflowY: "auto",
        position: "relative",
    },
    signalsTitle: {
        fontSize: "16px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "20px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    signalsTitleLabel: {
        fontSize: "11px",
        fontWeight: 500,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        marginLeft: "auto",
    },
    signalItem: {
        padding: "14px 0",
        borderBottom: "1px solid #f3f4f6",
        animation: "fadeInSlide 0.4s ease-out",
        transition: "background 0.2s ease",
    },
    signalItemHigh: {
        background: "rgba(220, 38, 38, 0.02)",
        borderRadius: "4px",
        padding: "14px 12px",
        marginBottom: "4px",
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
        borderRadius: "8px",
        padding: "28px",
        marginBottom: "40px",
        position: "relative",
    },
    traceTitle: {
        fontSize: "16px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "8px",
    },
    traceSubtitle: {
        fontSize: "11px",
        color: "#6b7280",
        marginBottom: "24px",
        fontStyle: "italic",
    },
    traceStepper: {
        position: "relative",
        paddingLeft: "24px",
    },
    traceConnector: {
        position: "absolute",
        left: "11px",
        top: "24px",
        bottom: "-8px",
        width: "2px",
        background: aiGradients.border,
        borderRadius: "1px",
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
} as const;

// Add CSS animations for premium AI interface
// Moved to component useEffect to avoid SSR issues
const styleSheetContent = `
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
    @keyframes shimmer {
        0% {
            background-position: -200% 0;
        }
        100% {
            background-position: 200% 0;
        }
    }
    @keyframes pulseLine {
        0%, 100% {
            opacity: 0.4;
        }
        50% {
            opacity: 0.8;
        }
    }
    @keyframes fadeInSlide {
        from {
            opacity: 0;
            transform: translateY(-8px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

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

// Risk Composition Panel Component
function RiskCompositionPanel({ invoiceId }: { invoiceId: string }) {
    const [breakdown, setBreakdown] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (expanded && !breakdown && !loading) {
            setLoading(true);
            fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/agent/risk-breakdown/${invoiceId}`)
                .then(res => res.json())
                .then(data => {
                    setBreakdown(data);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }
    }, [expanded, invoiceId, breakdown, loading]);

    if (!expanded) {
        return (
            <button
                onClick={() => setExpanded(true)}
                style={{
                    fontSize: "11px",
                    color: "#2563eb",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 0",
                    textDecoration: "underline",
                }}
            >
                Show risk breakdown →
            </button>
        );
    }

    if (loading) {
        return <div style={{ fontSize: "11px", color: "#6b7280" }}>Loading risk breakdown...</div>;
    }

    if (!breakdown) {
        return <div style={{ fontSize: "11px", color: "#9ca3af" }}>Risk breakdown not available</div>;
    }

    return (
        <div style={{
            marginTop: "12px",
            padding: "12px",
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "4px",
            fontSize: "11px",
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ fontWeight: 600, color: "#1a1a1a" }}>Risk Composition</div>
                <button
                    onClick={() => setExpanded(false)}
                    style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#6b7280",
                        fontSize: "10px",
                    }}
                >
                    Hide
                </button>
            </div>
            {breakdown.factors && breakdown.factors.length > 0 ? (
                <>
                    {breakdown.factors.map((factor: any, i: number) => (
                        <div key={i} style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "6px",
                            paddingBottom: "6px",
                            borderBottom: i < breakdown.factors.length - 1 ? "1px solid #e5e7eb" : "none",
                        }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 500, color: "#374151" }}>{factor.name}</div>
                                <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px" }}>{factor.description}</div>
                            </div>
                            <div style={{
                                fontWeight: 600,
                                color: factor.impact > 0 ? "#dc2626" : factor.impact < 0 ? "#16a34a" : "#6b7280",
                                marginLeft: "12px",
                                minWidth: "40px",
                                textAlign: "right",
                            }}>
                                {factor.impact > 0 ? "+" : ""}{factor.impact}
                            </div>
                        </div>
                    ))}
                    <div style={{
                        marginTop: "8px",
                        paddingTop: "8px",
                        borderTop: "1px solid #e5e7eb",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}>
                        <div style={{ fontWeight: 600, color: "#1a1a1a" }}>Final Score</div>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: breakdown.finalScore >= 50 ? "#dc2626" : "#16a34a" }}>
                            {breakdown.finalScore} / 100
                        </div>
                    </div>
                </>
            ) : (
                <div style={{ color: "#9ca3af" }}>No risk factors available</div>
            )}
        </div>
    );
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
    const { address } = useAccount();

    useEffect(() => {
        if (typeof document !== "undefined" && !document.getElementById("agent-console-styles")) {
            const styleSheet = document.createElement("style");
            styleSheet.id = "agent-console-styles";
            styleSheet.textContent = styleSheetContent;
            document.head.appendChild(styleSheet);
        }
    }, []);
    const { data, error, isLoading, mutate } = useSWR<AgentConsoleData>(
        "agent-console",
        () => fetchAgentConsole(),
        {
            refreshInterval: 3000, // Fast polling (3s) + WebSocket for instant updates
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            dedupingInterval: 500, // Reduced for faster WebSocket updates
            shouldRetryOnError: true,
            errorRetryCount: 3,
            errorRetryInterval: 2000,
            keepPreviousData: true,
            loadingTimeout: 5000,
            onError: (err) => {
                console.error('[Agent Console] Fetch error (keeping stale data):', err);
            },
            onLoadingSlow: () => {
                console.warn('[Agent Console] Loading is taking longer than expected...');
            },
        }
    );

    const { data: agentConfig, mutate: mutateConfig } = useSWR<AgentConfig>(
        "agent-config",
        () => fetchAgentConfig(),
        { refreshInterval: 5000 }
    );

    const { data: systemParams } = useSWR<SystemParameters>(
        "system-parameters",
        () => fetchSystemParameters(),
        { refreshInterval: 10000 }
    );

    const { data: predictions } = useSWR<PredictiveIntelligence>(
        "predictive-intelligence",
        () => fetchPredictiveIntelligence(),
        { refreshInterval: 30000 }
    );

    const [transparencyExpanded, setTransparencyExpanded] = useState(false);
    const [controlLoading, setControlLoading] = useState<string | null>(null);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [riskThreshold, setRiskThreshold] = useState(50);
    const [showAllTraces, setShowAllTraces] = useState(false);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);

    // WebSocket integration for real-time updates
    const { subscribe } = useWebSocket("global");

    // Track when initial load completes
    useEffect(() => {
        if (!isLoading && data) {
            setInitialLoadComplete(true);
        }
    }, [isLoading, data]);

    useEffect(() => {
        // Only subscribe to WebSocket after initial data has loaded
        if (!subscribe || !initialLoadComplete) return;

        // Subscribe to agent decision events with OPTIMISTIC UPDATE
        const unsubscribeDecision = subscribe("agent.decision", (event) => {
            // Instantly update UI with new decision data (optimistic update)
            mutate((currentData) => {
                if (!currentData) return currentData;

                const newSignal = {
                    id: event.payload.decisionId || `temp-${Date.now()}`,
                    timestamp: event.timestamp || new Date().toISOString(),
                    sourceAgent: "status-management",
                    severity: event.payload.riskScore > 70 ? "High" : event.payload.riskScore > 40 ? "Medium" : "Low",
                    message: `${event.payload.actionType}: ${event.payload.invoiceExternalId || event.payload.invoiceId || "Invoice"}. Status: ${event.payload.nextStatus || "Updated"}, Financed: ${event.payload.financed ?? false}`,
                    context: {
                        invoiceId: event.payload.invoiceId,
                        invoiceExternalId: event.payload.invoiceExternalId,
                        riskScore: event.payload.riskScore,
                    },
                };

                const newDecisionTrace = {
                    id: event.payload.decisionId || `temp-${Date.now()}`,
                    timestamp: event.timestamp || new Date().toISOString(),
                    reasoningPipeline: [
                        { step: "inputs", label: "Input Analysis", content: { invoiceId: event.payload.invoiceExternalId, status: event.payload.nextStatus, riskScore: event.payload.riskScore } },
                        { step: "signals", label: "Signals Detected", content: [{ source: "status-management", severity: newSignal.severity, message: newSignal.message }] },
                        { step: "evaluation", label: "Risk Evaluation", content: { riskScore: event.payload.riskScore, threshold: 50, passed: (event.payload.riskScore || 0) < 50 } },
                        { step: "decision", label: "Final Decision", content: { actionType: event.payload.actionType, nextStatus: event.payload.nextStatus } },
                    ],
                    inputs: { invoiceId: event.payload.invoiceExternalId, riskScore: event.payload.riskScore },
                    signals: [newSignal],
                    evaluation: { actionType: event.payload.actionType, reasoning: newSignal.message },
                    recommendation: { action: event.payload.actionType, confidence: 100 - (event.payload.riskScore || 50) },
                };

                return {
                    ...currentData,
                    signals: [newSignal, ...currentData.signals].slice(0, 20),
                    decisionTraces: [newDecisionTrace, ...currentData.decisionTraces].slice(0, 5),
                };
            }, { revalidate: false }); // Instant UI update

            // Immediately sync full data from backend (100ms delay to ensure UI updated first)
            setTimeout(() => mutate(), 100);
        });

        // Subscribe to agent pause/resume events
        const unsubscribePaused = subscribe("agent.paused", () => {
            mutate();
            mutateConfig();
        });

        const unsubscribeResumed = subscribe("agent.resumed", () => {
            mutate();
            mutateConfig();
        });

        const unsubscribeConfig = subscribe("agent.config.updated", () => {
            mutateConfig();
        });

        // Subscribe to agent status updates for REAL-TIME card metrics
        const unsubscribeStatus = subscribe("agent.status", (event) => {
            // Instantly update agent card with new metrics
            mutate((currentData) => {
                if (!currentData) return currentData;

                const updatedAgents = currentData.agents.map((agent) => {
                    // Match agent by name or id from event payload
                    const agentName = event.payload.agentName || event.payload.agent;
                    if (agent.name === agentName || agent.id === event.payload.agentId) {
                        return {
                            ...agent,
                            state: event.payload.state || agent.state,
                            confidence: event.payload.confidence ?? agent.confidence,
                            workload: event.payload.workload ?? agent.workload,
                            signalCount: event.payload.signalCount ?? agent.signalCount,
                            lastAction: event.payload.timestamp || new Date().toISOString(),
                            lastActionSummary: event.payload.message || event.payload.summary || agent.lastActionSummary,
                        };
                    }
                    return agent;
                });

                return {
                    ...currentData,
                    agents: updatedAgents,
                };
            }, { revalidate: false });

            // Background sync after 100ms
            setTimeout(() => mutate(), 100);
        });

        // Subscribe to ANY agent-related event for immediate card refresh
        const unsubscribeAgentActivity = subscribe("agent.activity", (event) => {
            mutate((currentData) => {
                if (!currentData) return currentData;

                const updatedAgents = currentData.agents.map((agent) => {
                    const agentName = event.payload.agentName || event.payload.agent;
                    if (agent.name === agentName || agent.id === event.payload.agentId) {
                        return {
                            ...agent,
                            lastAction: event.payload.timestamp || new Date().toISOString(),
                            lastActionSummary: event.payload.action || event.payload.message,
                            signalCount: (agent.signalCount || 0) + 1,
                        };
                    }
                    return agent;
                });

                return { ...currentData, agents: updatedAgents };
            }, { revalidate: false });

            setTimeout(() => mutate(), 100);
        });

        return () => {
            unsubscribeDecision();
            unsubscribePaused();
            unsubscribeResumed();
            unsubscribeConfig();
            unsubscribeStatus();
            unsubscribeAgentActivity();
        };
    }, [subscribe, mutate, mutateConfig, initialLoadComplete]);

    // Debug SWR state
    React.useEffect(() => {
        console.log('[Agent Console] SWR State:', { isLoading, hasError: !!error, hasData: !!data, errorMsg: error?.message });
    }, [isLoading, error, data]);

    // Update risk threshold when config loads
    useEffect(() => {
        if (agentConfig) {
            setRiskThreshold(agentConfig.riskThreshold);
        }
    }, [agentConfig]);

    const handlePause = async () => {
        if (!address) {
            alert("Please connect your wallet");
            return;
        }

        if (!confirm("Are you sure you want to pause the AI agent engine? This will stop all automated actions.")) {
            return;
        }

        setControlLoading("pause");
        try {
            await pauseAgent(address);
            mutate();
            mutateConfig();
            alert("Agent engine paused successfully");
        } catch (err: any) {
            alert(`Failed to pause agent: ${err.message}`);
        } finally {
            setControlLoading(null);
        }
    };

    const handleResume = async () => {
        if (!address) {
            alert("Please connect your wallet");
            return;
        }

        setControlLoading("resume");
        try {
            await resumeAgent(address);
            mutate();
            mutateConfig();
            alert("Agent engine resumed successfully");
        } catch (err: any) {
            alert(`Failed to resume agent: ${err.message}`);
        } finally {
            setControlLoading(null);
        }
    };

    const handleAdjustSensitivity = () => {
        setShowConfigModal(true);
    };

    const handleSaveConfig = async () => {
        if (!address) {
            alert("Please connect your wallet");
            return;
        }

        setControlLoading("config");
        try {
            await updateAgentConfig(address, { riskThreshold });
            mutateConfig();
            setShowConfigModal(false);
            alert("Agent configuration updated successfully");
        } catch (err: any) {
            alert(`Failed to update config: ${err.message}`);
        } finally {
            setControlLoading(null);
        }
    };

    // ONLY show loading screen on initial load when there's no data yet
    // This prevents loading flash during background revalidation
    if (isLoading && !data) {
        return (
            <div style={styles.page}>
                <div style={styles.pageOverlay}></div>
                <div style={styles.pageContent}>
                    <Navbar />
                    <div style={styles.container}>
                        <div style={{ textAlign: "center", padding: "60px", color: "#6b7280" }}>
                            Loading agent console...
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Only show error if we've never loaded data successfully
    if (error && !data) {
        console.error('[Agent Console] Failed to load (no data):', error);
        return (
            <div style={styles.page}>
                <div style={styles.pageOverlay}></div>
                <div style={styles.pageContent}>
                    <Navbar />
                    <div style={styles.container}>
                        <div style={{ textAlign: "center", padding: "60px", color: "#dc2626" }}>
                            Failed to load agent console data.
                            {error && <div style={{ fontSize: "12px", marginTop: "10px", color: "#666" }}>{error.message}</div>}
                            <div style={{ marginTop: "20px" }}>
                                <button
                                    onClick={() => mutate()}
                                    style={{
                                        padding: "10px 20px",
                                        background: "#2563eb",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                    }}
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // TypeScript guard: ensure data exists before rendering
    if (!data) {
        return (
            <div style={styles.page}>
                <div style={styles.pageOverlay}></div>
                <div style={styles.pageContent}>
                    <Navbar />
                    <div style={styles.container}>
                        <div style={{ textAlign: "center", padding: "60px", color: "#6b7280" }}>
                            Loading agent console...
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <style>{`
                .nav-link-modern {
                    text-decoration: none;
                    color: #64748b;
                    font-size: 15px;
                    font-weight: 500;
                    padding: 10px 16px;
                    border-radius: 8px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    letter-spacing: -0.01em;
                }
                .nav-link-modern:hover {
                    color: #1e293b;
                    background: rgba(15, 23, 42, 0.04);
                }
                .nav-link-modern.active {
                    color: #2563eb;
                    background: rgba(37, 99, 235, 0.08);
                    font-weight: 600;
                }
                .nav-link-modern.active::after {
                    content: '';
                    position: absolute;
                    bottom: 8px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                    background: #2563eb;
                }
            `}</style>
            <div style={styles.pageOverlay}></div>
            <div style={styles.pageContent}>
                <Navbar />

                <div style={styles.container}>
                    {/* Page Header */}
                    <div style={styles.header}>
                        <div style={styles.title}>AI Agent Console</div>
                        <div style={styles.subtitle}>
                            Autonomous risk monitoring and decision support system.
                        </div>
                        {/* AI Engine Status Bar - Premium Header */}
                        <div style={{
                            ...styles.aiEngineHeader,
                            ...(data.systemStatus.engineStatus === "Running" && !agentConfig?.paused ? styles.aiEngineHeaderActive : {})
                        }}>
                            {/* Engine Status */}
                            <div style={styles.statusItem}>
                                <span style={{
                                    ...styles.statusDot,
                                    ...(data.systemStatus.engineStatus === "Running" && !agentConfig?.paused ? {} : styles.statusDotIdle),
                                    background: data.systemStatus.engineStatus === "Running" && !agentConfig?.paused ? "#22c55e" : "#9ca3af",
                                }}></span>
                                <span><strong>Engine Status:</strong> {agentConfig?.paused ? "Paused" : `${data.systemStatus.engineStatus}-Nominal`}</span>
                            </div>

                            {/* Last Decision */}
                            {(() => {
                                // Get the most recent decision timestamp
                                // Backend returns decisionTraces sorted by createdAt DESC, so first item is most recent
                                let lastDecisionTime: Date | null = null;

                                // Try decisionTraces first (most reliable, sorted by backend)
                                if (data.decisionTraces && data.decisionTraces.length > 0) {
                                    // decisionTraces are already sorted DESC by backend, so first is most recent
                                    const mostRecentTrace = data.decisionTraces[0];
                                    lastDecisionTime = new Date(mostRecentTrace.timestamp);
                                }
                                // Fallback to recommendations
                                else if (data.recommendations && data.recommendations.length > 0) {
                                    // Find most recent recommendation
                                    const timestamps = data.recommendations.map(r => new Date(r.timestamp).getTime());
                                    const maxTime = Math.max(...timestamps);
                                    lastDecisionTime = new Date(maxTime);
                                }
                                // Final fallback to systemStatus.lastEvaluation
                                else {
                                    lastDecisionTime = new Date(data.systemStatus.lastEvaluation);
                                }

                                // Format: MM/DD/YYYY, HH:MM:SS AM/PM UTC
                                const formatDecisionTime = (date: Date): string => {
                                    // Validate date
                                    if (isNaN(date.getTime())) {
                                        return "N/A";
                                    }

                                    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                                    const day = String(date.getUTCDate()).padStart(2, '0');
                                    const year = date.getUTCFullYear();
                                    let hours = date.getUTCHours();
                                    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
                                    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
                                    const ampm = hours >= 12 ? 'PM' : 'AM';
                                    hours = hours % 12;
                                    hours = hours ? hours : 12;
                                    const hoursStr = String(hours).padStart(2, '0');
                                    return `${month}/${day}/${year}, ${hoursStr}:${minutes}:${seconds} ${ampm} UTC`;
                                };

                                return (
                                    <div style={styles.statusItem}>
                                        <span><strong>Last Decision:</strong> {lastDecisionTime ? formatDecisionTime(lastDecisionTime) : "N/A"}</span>
                                    </div>
                                );
                            })()}

                            {/* Active Rules */}
                            <div style={styles.statusItem}>
                                <span><strong>Active Rules:</strong> {
                                    agentConfig && systemParams
                                        ? `Risk Threshold: ${agentConfig.riskThreshold}, LTV: ${(systemParams.ltvBps / 100).toFixed(0)}%`
                                        : "N/A"
                                }</span>
                            </div>

                            {/* System Load */}
                            <div style={styles.statusItem}>
                                <span><strong>System Load:</strong> {data.systemStatus.systemLoad.toFixed(1)}%</span>
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

                            const isActive = agent.state === "Active";
                            const cardStyle = isActive ? styles.agentCardActive :
                                agent.state === "Idle" ? styles.agentCardIdle :
                                    isAlerting ? styles.agentCardAlert : styles.agentCard;

                            return (
                                <div key={agent.id} style={{ ...styles.agentCard, ...cardStyle }}>
                                    {isActive && <div style={styles.agentActivityLine}></div>}
                                    <div style={styles.agentName}>{agent.name}</div>
                                    <div style={styles.agentScope}>{agent.scope}</div>
                                    <div style={{ ...styles.agentState, ...stateStyle }}>
                                        <span style={dotStyle}></span> {agent.state}
                                    </div>
                                    <div style={styles.confidenceBar}>
                                        <div style={{ ...styles.confidenceFill, width: `${agent.confidence}%` }}></div>
                                    </div>
                                    <div style={styles.agentMeta}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                            <span>Confidence: {agent.confidence}%</span>
                                            {(agent.workload !== undefined || agent.signalCount !== undefined) && (
                                                <div style={{ display: "flex", gap: "12px", fontSize: "10px", color: "#6b7280" }}>
                                                    {agent.workload !== undefined && (
                                                        <span>Workload: {agent.workload}/h</span>
                                                    )}
                                                    {agent.signalCount !== undefined && (
                                                        <span>Signals: {agent.signalCount}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <span>{formatRelativeTime(agent.lastAction)}</span>
                                    </div>
                                    {(agent as any).lastActionSummary && (
                                        <div style={styles.lastActionSummary}>
                                            {(agent as any).lastActionSummary}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Two Column Layout: Signals & Decision Traces */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "40px" }}>
                        {/* Real-Time AI Awareness Stream */}
                        <div style={styles.signalsPanel}>
                            <div style={styles.signalsTitle}>
                                Real-Time AI Awareness Stream
                                <span style={styles.signalsTitleLabel}>Live</span>
                            </div>
                            {data.signals.length === 0 ? (
                                <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: "12px" }}>
                                    No signals detected in the last evaluation cycle.
                                </div>
                            ) : (
                                data.signals.map((signal) => {
                                    const severityStyle = signal.severity === "High" ? styles.severityHigh :
                                        signal.severity === "Medium" ? styles.severityMedium :
                                            styles.severityLow;

                                    // Determine impact
                                    let impact = "None";
                                    if (signal.context.txHash) {
                                        impact = "Executed";
                                    } else if (signal.message.toLowerCase().includes("blocked")) {
                                        impact = "Blocked";
                                    } else if (signal.message.toLowerCase().includes("skipped")) {
                                        impact = "Skipped";
                                    }

                                    return (
                                        <div key={signal.id} style={{
                                            ...styles.signalItem,
                                            ...(signal.severity === "High" ? styles.signalItemHigh : {})
                                        }}>
                                            <div style={styles.signalHeader}>
                                                <div style={styles.signalMessage}>
                                                    <span style={{ fontWeight: 500, color: "#1a1a1a" }}>
                                                        {signal.sourceAgent.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}:
                                                    </span> {signal.message}
                                                </div>
                                                <span style={{ ...styles.severityBadge, ...severityStyle }}>
                                                    {signal.severity}
                                                </span>
                                            </div>
                                            <div style={styles.signalMeta}>
                                                <span>{formatTimestamp(signal.timestamp)}</span>
                                                <span style={{ textTransform: "capitalize" }}>{signal.sourceAgent.replace(/-/g, " ")}</span>
                                                <span style={{ fontSize: "10px", color: "#6b7280" }}>Impact: {impact}</span>
                                                {signal.context.invoiceId && (
                                                    <Link
                                                        href={`/invoices/${signal.context.invoiceId}`}
                                                        style={{ color: "#2563eb", textDecoration: "none", fontSize: "11px" }}
                                                    >
                                                        View invoice →
                                                    </Link>
                                                )}
                                                {signal.context.txHash && (
                                                    <a
                                                        href={`https://sepolia.etherscan.io/tx/${signal.context.txHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: "#2563eb", textDecoration: "none", fontSize: "11px" }}
                                                    >
                                                        TX ↗
                                                    </a>
                                                )}
                                            </div>
                                            {signal.context.riskScore !== null && signal.context.riskScore !== undefined && (
                                                <div style={{ marginTop: "8px", fontSize: "11px", color: "#6b7280" }}>
                                                    Risk Score: {signal.context.riskScore}/100
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Decision Traces - AI Reasoning Pipeline */}
                        <div style={styles.traceSection}>
                            <div style={styles.traceTitle}>AI Reasoning Pipeline</div>
                            <div style={styles.traceSubtitle}>
                                Autonomous reasoning trace — generated per decision
                            </div>
                            {(showAllTraces ? data.decisionTraces : data.decisionTraces.slice(0, 2)).map((trace) => {
                                const hasPipeline = trace.reasoningPipeline && trace.reasoningPipeline.length > 0;

                                return (
                                    <div key={trace.id} style={styles.traceItem}>
                                        <div style={styles.traceTimeline}></div>
                                        <div style={styles.traceDot}></div>
                                        <div style={styles.traceTimestamp}>{formatTimestamp(trace.timestamp)}</div>

                                        {hasPipeline ? (
                                            // New reasoning pipeline view with stepper
                                            <div style={styles.traceStepper}>
                                                {trace.reasoningPipeline!.map((step, stepIdx) => (
                                                    <div key={stepIdx} style={styles.traceStep}>
                                                        {stepIdx < trace.reasoningPipeline!.length - 1 && (
                                                            <div style={styles.traceConnector}></div>
                                                        )}
                                                        <div style={styles.traceStepLabel}>
                                                            {stepIdx + 1}. {step.label}
                                                        </div>
                                                        <div style={styles.traceStepContent}>
                                                            {step.step === "inputs" && (
                                                                <div>
                                                                    Invoice: {step.content.invoiceId ? (
                                                                        <Link href={`/invoices/${step.content.invoiceId}`} style={{ color: "#2563eb", textDecoration: "none" }}>
                                                                            {step.content.invoiceId}
                                                                        </Link>
                                                                    ) : "N/A"},
                                                                    Status: {step.content.previousStatus || "N/A"},
                                                                    Risk Score: {step.content.riskScore || "N/A"}
                                                                    {step.content.invoiceOnChainId && (
                                                                        <span style={{ fontSize: "11px", color: "#6b7280", marginLeft: "8px" }}>
                                                                            (On-chain: {step.content.invoiceOnChainId.slice(0, 10)}...)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {step.step === "signals" && (
                                                                <div>
                                                                    {Array.isArray(step.content) ? (
                                                                        step.content.map((s: any, i: number) => (
                                                                            <div key={i} style={{ marginBottom: "4px", fontSize: "12px" }}>
                                                                                <span style={{ fontWeight: 500 }}>{s.source}:</span> {s.message}
                                                                                <span style={{ marginLeft: "8px", fontSize: "10px", color: s.severity === "High" ? "#dc2626" : s.severity === "Medium" ? "#f59e0b" : "#6b7280" }}>
                                                                                    [{s.severity}]
                                                                                </span>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <span>No signals detected</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {step.step === "evaluation" && (
                                                                <div>
                                                                    <div style={{ marginBottom: "8px" }}>
                                                                        Risk Score: <strong>{step.content.riskScore}</strong> / 100
                                                                        <br />
                                                                        Threshold: {step.content.threshold}
                                                                        <span style={{ color: step.content.passed ? "#16a34a" : "#dc2626", marginLeft: "8px" }}>
                                                                            {step.content.passed ? "✓ Passed" : "✗ Failed"}
                                                                        </span>
                                                                    </div>
                                                                    {trace.inputs.invoiceId && (
                                                                        <RiskCompositionPanel invoiceId={trace.inputs.invoiceId} />
                                                                    )}
                                                                </div>
                                                            )}
                                                            {step.step === "safety" && (
                                                                <div>
                                                                    <div style={{ marginBottom: "4px" }}>
                                                                        Checks: {Array.isArray(step.content.checks) ? step.content.checks.join(", ") : step.content.checks}
                                                                    </div>
                                                                    <div style={{ color: "#dc2626", fontSize: "12px" }}>
                                                                        Result: {step.content.result} - {step.content.reason}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {step.step === "decision" && (
                                                                <div>
                                                                    <div style={{ marginBottom: "4px" }}>
                                                                        Action: <strong>{step.content.actionType}</strong>
                                                                        {step.content.nextStatus && (
                                                                            <span style={{ marginLeft: "8px" }}>
                                                                                → {step.content.nextStatus}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ fontSize: "12px", color: "#6b7280" }}>
                                                                        {step.content.reasoning}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {step.step === "execution" && (
                                                                <div>
                                                                    Status: <strong style={{ color: step.content.status === "SUCCESS" ? "#16a34a" : step.content.status === "BLOCKED" ? "#f59e0b" : "#dc2626" }}>
                                                                        {step.content.status}
                                                                    </strong>
                                                                    {step.content.txHash && (
                                                                        <div style={{ marginTop: "4px", fontSize: "11px" }}>
                                                                            <a
                                                                                href={`https://sepolia.etherscan.io/tx/${step.content.txHash}`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                style={{ color: "#2563eb", textDecoration: "none" }}
                                                                            >
                                                                                View transaction ↗
                                                                            </a>
                                                                        </div>
                                                                    )}
                                                                    {step.content.reason && (
                                                                        <div style={{ marginTop: "4px", fontSize: "11px", color: "#6b7280" }}>
                                                                            {step.content.reason}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            // Fallback to old format if no pipeline
                                            <>
                                                <div style={styles.traceStep}>
                                                    <div style={styles.traceStepLabel}>Inputs</div>
                                                    <div style={styles.traceStepContent}>
                                                        Invoice: {trace.inputs.invoiceId ? (
                                                            <Link href={`/invoices/${trace.inputs.invoiceId}`} style={{ color: "#2563eb", textDecoration: "none" }}>
                                                                {trace.inputs.invoiceId}
                                                            </Link>
                                                        ) : "N/A"},
                                                        Status: {trace.inputs.previousStatus || "N/A"},
                                                        Risk: {trace.inputs.riskScore || "N/A"}
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
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                            {data.decisionTraces.length > 2 && !showAllTraces && (
                                <div style={{ textAlign: "center", marginTop: "24px" }}>
                                    <button
                                        onClick={() => setShowAllTraces(true)}
                                        style={{
                                            padding: "10px 24px",
                                            background: "#ffffff",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "4px",
                                            color: "#2563eb",
                                            fontSize: "13px",
                                            fontWeight: 500,
                                            cursor: "pointer",
                                            transition: "all 0.2s",
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.background = "#f9fafb";
                                            e.currentTarget.style.borderColor = "#2563eb";
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.background = "#ffffff";
                                            e.currentTarget.style.borderColor = "#e5e7eb";
                                        }}
                                    >
                                        Load More ({data.decisionTraces.length - 2} more)
                                    </button>
                                </div>
                            )}
                            {showAllTraces && data.decisionTraces.length > 2 && (
                                <div style={{ textAlign: "center", marginTop: "24px" }}>
                                    <button
                                        onClick={() => setShowAllTraces(false)}
                                        style={{
                                            padding: "10px 24px",
                                            background: "#ffffff",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "4px",
                                            color: "#6b7280",
                                            fontSize: "13px",
                                            fontWeight: 500,
                                            cursor: "pointer",
                                            transition: "all 0.2s",
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.background = "#f9fafb";
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.background = "#ffffff";
                                        }}
                                    >
                                        Show Less
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Short-Term AI Outlook */}
                    {predictions && (
                        <div style={{ ...styles.recommendationsSection, marginBottom: "40px" }}>
                            <div style={styles.recommendationsTitle}>Short-Term AI Outlook (24h)</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "20px" }}>
                                <div style={{ padding: "16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "4px" }}>
                                    <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>Invoices at Risk</div>
                                    <div style={{ fontSize: "20px", fontWeight: 600, color: predictions.invoicesAtRisk > 0 ? "#dc2626" : "#16a34a" }}>
                                        {predictions.invoicesAtRisk}
                                    </div>
                                </div>
                                <div style={{ padding: "16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "4px" }}>
                                    <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>Expected Financings</div>
                                    <div style={{ fontSize: "20px", fontWeight: 600 }}>{predictions.expectedFinancings}</div>
                                </div>
                                <div style={{ padding: "16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "4px" }}>
                                    <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>Expected Blocks</div>
                                    <div style={{ fontSize: "20px", fontWeight: 600, color: predictions.expectedFinancingBlocks > 0 ? "#f59e0b" : "#16a34a" }}>
                                        {predictions.expectedFinancingBlocks}
                                    </div>
                                </div>
                                <div style={{ padding: "16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "4px" }}>
                                    <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>Pool Utilization</div>
                                    <div style={{ fontSize: "20px", fontWeight: 600 }}>
                                        {predictions.poolUtilizationProjection.current.toFixed(1)}%
                                    </div>
                                    <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                                        Projected: {predictions.poolUtilizationProjection.projected.toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                            {predictions.safetyWarnings.length > 0 && (
                                <div style={{ padding: "12px", background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: "4px", marginBottom: "16px" }}>
                                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#92400e", marginBottom: "4px" }}>Safety Warnings</div>
                                    {predictions.safetyWarnings.map((warning, i) => (
                                        <div key={i} style={{ fontSize: "11px", color: "#92400e" }}>• {warning}</div>
                                    ))}
                                </div>
                            )}
                            {predictions.invoicesAtRiskDetails.length > 0 && (
                                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "12px" }}>
                                    <div style={{ fontWeight: 600, marginBottom: "8px" }}>Top Risk Invoices:</div>
                                    {predictions.invoicesAtRiskDetails.slice(0, 5).map((inv, i) => (
                                        <div key={i} style={{ marginBottom: "4px", fontSize: "11px" }}>
                                            <Link href={`/invoices/${inv.invoiceId}`} style={{ color: "#2563eb", textDecoration: "none" }}>
                                                {inv.externalId}
                                            </Link>
                                            {" "}— Risk: {inv.currentRisk}/100 ({inv.reason})
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Active Policy Parameters */}
                    {systemParams && (
                        <div style={{ ...styles.recommendationsSection, marginBottom: "40px" }}>
                            <div style={styles.recommendationsTitle}>Active Policy Parameters</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                                <div style={{ padding: "12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "4px" }}>
                                    <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>Risk Threshold</div>
                                    <div style={{ fontSize: "16px", fontWeight: 600 }}>{systemParams.riskThreshold}</div>
                                </div>
                                <div style={{ padding: "12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "4px" }}>
                                    <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>LTV</div>
                                    <div style={{ fontSize: "16px", fontWeight: 600 }}>{systemParams.ltvBps / 100}%</div>
                                </div>
                                <div style={{ padding: "12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "4px" }}>
                                    <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>Utilization Threshold</div>
                                    <div style={{ fontSize: "16px", fontWeight: 600 }}>{systemParams.utilizationThresholdBps / 100}%</div>
                                </div>
                                <div style={{ padding: "12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "4px" }}>
                                    <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>Max Utilization</div>
                                    <div style={{ fontSize: "16px", fontWeight: 600 }}>{systemParams.maxUtilizationBps / 100}%</div>
                                </div>
                                {systemParams.maxLoanBpsOfTVL && (
                                    <div style={{ padding: "12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "4px" }}>
                                        <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>Max Single Loan</div>
                                        <div style={{ fontSize: "16px", fontWeight: 600 }}>{systemParams.maxLoanBpsOfTVL / 100}%</div>
                                    </div>
                                )}
                                {systemParams.maxIssuerExposureBps && (
                                    <div style={{ padding: "12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "4px" }}>
                                        <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>Max Issuer Exposure</div>
                                        <div style={{ fontSize: "16px", fontWeight: 600 }}>{systemParams.maxIssuerExposureBps / 100}%</div>
                                    </div>
                                )}
                            </div>
                            <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "12px" }}>
                                Last updated: {formatTimestamp(systemParams.lastUpdated)}
                            </div>
                        </div>
                    )}

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

                    {/* Human-in-the-Loop Controls */}
                    <div style={styles.controlPanel}>
                        <div style={styles.controlPanelTitle}>Human-in-the-Loop Controls</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                            {agentConfig?.paused ? (
                                <button
                                    style={{ ...styles.controlButton, background: "#10b981", color: "#fff" }}
                                    onClick={handleResume}
                                    disabled={controlLoading === "resume"}
                                >
                                    {controlLoading === "resume" ? "Resuming..." : "Resume AI Engine"}
                                </button>
                            ) : (
                                <button
                                    style={{ ...styles.controlButton, background: "#ef4444", color: "#fff" }}
                                    onClick={handlePause}
                                    disabled={controlLoading === "pause"}
                                >
                                    {controlLoading === "pause" ? "Pausing..." : "Pause AI Engine"}
                                </button>
                            )}
                            <button
                                style={styles.controlButton}
                                onClick={handleAdjustSensitivity}
                                disabled={controlLoading !== null}
                            >
                                Adjust Risk Threshold
                            </button>
                            <button
                                style={{ ...styles.controlButton, opacity: 0.5, cursor: "not-allowed" }}
                                disabled
                                title="Not yet implemented"
                            >
                                Force Re-evaluation
                            </button>
                            <button
                                style={{ ...styles.controlButton, opacity: 0.5, cursor: "not-allowed" }}
                                disabled
                                title="Requires admin approval"
                            >
                                Manual Override
                            </button>
                        </div>
                        <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                            {agentConfig?.paused ? (
                                <span style={{ color: "#f59e0b" }}>⚠️ Agent engine is currently paused. All automated actions are suspended.</span>
                            ) : (
                                <span>Administrative controls require elevated permissions. System is operating autonomously.</span>
                            )}
                        </div>
                    </div>

                    {/* Config Modal */}
                    {showConfigModal && (
                        <div style={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: "rgba(0, 0, 0, 0.5)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 1000,
                        }}>
                            <div style={{
                                background: "#fff",
                                padding: "32px",
                                borderRadius: "8px",
                                maxWidth: "500px",
                                width: "90%",
                                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                            }}>
                                <h3 style={{ marginTop: 0, marginBottom: "24px", fontSize: "18px", fontWeight: 600 }}>
                                    Adjust Agent Sensitivity
                                </h3>
                                <div style={{ marginBottom: "24px" }}>
                                    <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500 }}>
                                        Risk Threshold: {riskThreshold}
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={riskThreshold}
                                        onChange={(e) => setRiskThreshold(Number(e.target.value))}
                                        style={{ width: "100%" }}
                                    />
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                                        <span>Low Risk (0)</span>
                                        <span>High Risk (100)</span>
                                    </div>
                                    <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px" }}>
                                        Invoices with risk scores below this threshold will be automatically financed.
                                    </p>
                                </div>
                                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                                    <button
                                        onClick={() => setShowConfigModal(false)}
                                        style={{
                                            padding: "8px 16px",
                                            border: "1px solid #e5e7eb",
                                            background: "#fff",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                            fontSize: "14px",
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveConfig}
                                        disabled={controlLoading === "config"}
                                        style={{
                                            padding: "8px 16px",
                                            border: "none",
                                            background: "#2563eb",
                                            color: "#fff",
                                            borderRadius: "6px",
                                            cursor: controlLoading === "config" ? "not-allowed" : "pointer",
                                            fontSize: "14px",
                                            opacity: controlLoading === "config" ? 0.6 : 1,
                                        }}
                                    >
                                        {controlLoading === "config" ? "Saving..." : "Save"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

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
        </div>
    );
}
