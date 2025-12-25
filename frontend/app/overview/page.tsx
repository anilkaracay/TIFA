"use client";

import React, { useMemo, useState, useEffect } from "react";
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

// AI Lifecycle Intelligence Visualization Component
function AILifecycleRing({ totalInvoices, statusDistribution }: { totalInvoices: number; statusDistribution: any }) {
    const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
    const [pulseStates, setPulseStates] = useState<number[]>([0, 0, 0, 0, 0]);

    // Softened status colors (slightly desaturated)
    const statusColors = {
        ISSUED: "#8b7cc0",      // Softened purple
        TOKENIZED: "#5b8fd8",    // Softened blue
        FINANCED: "#4fb87a",     // Softened green
        REPAID: "#d4a574",       // Softened orange
        DEFAULTED: "#d87a7a",    // Softened red
    };

    const statusOrder = ["ISSUED", "TOKENIZED", "FINANCED", "REPAID", "DEFAULTED"];
    const total = totalInvoices || 1;
    
    // Calculate lifecycle segments with flow connections
    // Segments are positioned at fixed positions (evenly spaced around circle)
    // Segment thickness reflects invoice count, not angle span
    const angleSpan = 360 / statusOrder.length; // 72 degrees each
    let currentAngle = -90; // Start at top (-90 degrees)
    
    const lifecycleSegments = statusOrder.map((status) => {
        const count = statusDistribution[status] || 0;
        const percentage = (count / total) * 100;
        
        // Calculate angles so segments connect seamlessly
        const startAngle = currentAngle;
        const endAngle = currentAngle + angleSpan;
        const baseAngle = currentAngle + angleSpan / 2; // Center of segment
        
        // Move to next segment start
        currentAngle = endAngle;
        
        // Calculate AI confidence (mock calculation based on status and count)
        let aiConfidence = 95;
        if (status === "DEFAULTED") aiConfidence = 88;
        else if (status === "FINANCED" && count > 0) aiConfidence = 94;
        else if (status === "REPAID") aiConfidence = 97;
        
        return {
            status,
            count,
            percentage,
            color: statusColors[status as keyof typeof statusColors],
            baseAngle,
            angleSpan,
            startAngle,
            endAngle,
            aiConfidence,
            hasAnomaly: false,
        };
    });

    // Create connected arc path for lifecycle flow
    const createLifecycleArc = (startAngle: number, endAngle: number, radius: number, thickness: number) => {
        const start = (startAngle * Math.PI) / 180;
        const end = (endAngle * Math.PI) / 180;
        const innerRadius = radius - thickness / 2;
        const outerRadius = radius + thickness / 2;
        const centerX = 110; // SVG center for 220x220 viewBox
        const centerY = 110;
        
        const x1 = centerX + innerRadius * Math.cos(start);
        const y1 = centerY + innerRadius * Math.sin(start);
        const x2 = centerX + outerRadius * Math.cos(start);
        const y2 = centerY + outerRadius * Math.sin(start);
        const x3 = centerX + outerRadius * Math.cos(end);
        const y3 = centerY + outerRadius * Math.sin(end);
        const x4 = centerX + innerRadius * Math.cos(end);
        const y4 = centerY + innerRadius * Math.sin(end);
        
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        
        return `M ${x1} ${y1} L ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1} ${y1} Z`;
    };

    // Create flow connection line between segments
    const createFlowLine = (fromAngle: number, toAngle: number, radius: number) => {
        const from = (fromAngle * Math.PI) / 180;
        const to = (toAngle * Math.PI) / 180;
        const centerX = 110;
        const centerY = 110;
        const x1 = centerX + radius * Math.cos(from);
        const y1 = centerY + radius * Math.sin(from);
        const x2 = centerX + radius * Math.cos(to);
        const y2 = centerY + radius * Math.sin(to);
        return `M ${x1} ${y1} L ${x2} ${y2}`;
    };

    // Irregular pulse animation for AI signal layer
    useEffect(() => {
        const intervals = lifecycleSegments.map((_, index) => {
            const duration = 2000 + Math.random() * 3000;
            return setInterval(() => {
                setPulseStates(prev => {
                    const newStates = [...prev];
                    newStates[index] = Math.random();
                    return newStates;
                });
            }, duration);
        });
        return () => intervals.forEach(clearInterval);
    }, []);

    const coreRadius = 45;
    const middleRingRadius = 70;
    const outerRingRadius = 92;

    return (
        <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center", 
            justifyContent: "center",
            marginBottom: "24px",
            padding: "24px 0",
            width: "100%"
        }}>
            {/* AI Intelligence Label */}
            <div style={{ 
                fontSize: "12px", 
                color: "#1a1a1a", 
                marginBottom: "8px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                width: "100%"
            }}>
                <span>AI Lifecycle Intelligence</span>
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ opacity: 0.6 }}>
                    <circle cx="6" cy="3" r="1.5" fill="none" stroke="#666" strokeWidth="1"/>
                    <circle cx="3" cy="8" r="1.5" fill="none" stroke="#666" strokeWidth="1"/>
                    <circle cx="9" cy="8" r="1.5" fill="none" stroke="#666" strokeWidth="1"/>
                    <line x1="6" y1="4.5" x2="4" y2="6.5" stroke="#666" strokeWidth="0.8"/>
                    <line x1="6" y1="4.5" x2="8" y2="6.5" stroke="#666" strokeWidth="0.8"/>
                </svg>
            </div>
            <div style={{ 
                fontSize: "9px", 
                color: "#999", 
                marginBottom: "20px",
                fontStyle: "italic",
                textAlign: "center",
                width: "100%"
            }}>
                Pattern recognition • Risk scoring • State transition analysis
            </div>

            {/* Concentric AI Processing Graph */}
            <div style={{ 
                position: "relative", 
                width: "220px", 
                height: "220px",
                maxWidth: "100%",
                margin: "0 auto"
            }}>
                <svg 
                    width="220" 
                    height="220" 
                    viewBox="0 0 220 220"
                    style={{ 
                        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.04))",
                        display: "block"
                    }}
                >
                    <defs>
                        {/* Soft glow for inner core */}
                        <radialGradient id="coreGlow" cx="50%" cy="50%">
                            <stop offset="0%" stopColor="rgba(37, 99, 235, 0.08)" />
                            <stop offset="100%" stopColor="rgba(37, 99, 235, 0)" />
                        </radialGradient>
                        
                        {/* AI signal pulse gradient */}
                        <radialGradient id="aiSignalPulse" cx="50%" cy="50%">
                            <stop offset="0%" stopColor="rgba(37, 99, 235, 0.3)" />
                            <stop offset="100%" stopColor="rgba(37, 99, 235, 0)" />
                        </radialGradient>
                    </defs>

                    {/* Outer Ring: AI Signal Layer */}
                    <circle
                        cx="110"
                        cy="110"
                        r={outerRingRadius}
                        fill="none"
                        stroke="#e0e0e0"
                        strokeWidth="1"
                        opacity="0.4"
                    />
                    
                    {/* AI signal dots/dashes */}
                    {Array.from({ length: 48 }).map((_, i) => {
                        const angle = (i / 48) * 360 - 90; // Start at top
                        const pulseIntensity = pulseStates[i % 5];
                        const opacity = 0.2 + pulseIntensity * 0.4;
                        const isDash = i % 3 === 0;
                        const centerX = 110;
                        const centerY = 110;
                        const x = centerX + outerRingRadius * Math.cos((angle * Math.PI) / 180);
                        const y = centerY + outerRingRadius * Math.sin((angle * Math.PI) / 180);
                        
                        return (
                            <g key={i}>
                                {isDash ? (
                                    <line
                                        x1={x}
                                        y1={y}
                                        x2={centerX + (outerRingRadius + 4) * Math.cos((angle * Math.PI) / 180)}
                                        y2={centerY + (outerRingRadius + 4) * Math.sin((angle * Math.PI) / 180)}
                                        stroke="#666"
                                        strokeWidth="1.5"
                                        opacity={opacity}
                                    >
                                        <animate
                                            attributeName="opacity"
                                            values={`${opacity};${opacity * 0.3};${opacity}`}
                                            dur={`${2 + Math.random() * 3}s`}
                                            repeatCount="indefinite"
                                        />
                                    </line>
                                ) : (
                                    <circle
                                        cx={x}
                                        cy={y}
                                        r="1.5"
                                        fill="#666"
                                        opacity={opacity}
                                    >
                                        <animate
                                            attributeName="opacity"
                                            values={`${opacity};${opacity * 0.3};${opacity}`}
                                            dur={`${2 + Math.random() * 3}s`}
                                            repeatCount="indefinite"
                                        />
                                    </circle>
                                )}
                            </g>
                        );
                    })}

                    {/* Middle Ring: Lifecycle Flow */}
                    {lifecycleSegments.map((segment, index) => {
                        const isHovered = hoveredSegment === segment.status;
                        // Thickness reflects invoice count (not angle span)
                        const baseThickness = 8;
                        const maxThickness = 16;
                        const thickness = segment.count === 0 
                            ? 3 
                            : Math.min(maxThickness, baseThickness + (segment.count / total) * 8);
                        const nextSegment = lifecycleSegments[(index + 1) % lifecycleSegments.length];
                        
                        return (
                            <g key={segment.status}>
                                {/* Flow connection line (directional arrow hint) */}
                                {segment.count > 0 && nextSegment.count > 0 && (
                                    <g>
                                        <path
                                            d={createFlowLine(segment.endAngle, nextSegment.startAngle, middleRingRadius)}
                                            stroke={segment.color}
                                            strokeWidth="1"
                                            strokeDasharray="3,2"
                                            opacity="0.25"
                                            fill="none"
                                        />
                                        {/* Arrow head hint */}
                                        <circle
                                            cx={110 + middleRingRadius * Math.cos((nextSegment.startAngle * Math.PI) / 180)}
                                            cy={110 + middleRingRadius * Math.sin((nextSegment.startAngle * Math.PI) / 180)}
                                            r="2"
                                            fill={nextSegment.color}
                                            opacity="0.4"
                                        />
                                    </g>
                                )}
                                
                                {/* Lifecycle arc */}
                                <path
                                    d={createLifecycleArc(segment.startAngle, segment.endAngle, middleRingRadius, thickness)}
                                    fill={segment.count === 0 ? segment.color + "30" : segment.color}
                                    stroke={segment.count === 0 ? "none" : segment.color + "40"}
                                    strokeWidth="0.5"
                                    opacity={segment.count === 0 ? 0.2 : (isHovered ? 1 : 0.85)}
                                    style={{
                                        transition: "opacity 0.2s ease",
                                        cursor: segment.count > 0 ? "pointer" : "default"
                                    }}
                                    onMouseEnter={() => segment.count > 0 && setHoveredSegment(segment.status)}
                                    onMouseLeave={() => setHoveredSegment(null)}
                                />
                            </g>
                        );
                    })}

                    {/* Inner Core: Soft Glow */}
                    <circle
                        cx="110"
                        cy="110"
                        r={coreRadius + 2}
                        fill="url(#coreGlow)"
                        opacity="0.6"
                    />
                    <circle
                        cx="110"
                        cy="110"
                        r={coreRadius}
                        fill="#ffffff"
                        stroke="#e0e0e0"
                        strokeWidth="1"
                    />
                </svg>

                {/* Center Text */}
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center",
                    pointerEvents: "none",
                    width: "100%",
                    padding: "0 10px",
                    boxSizing: "border-box"
                }}>
                    <div style={{
                        fontSize: "26px",
                        fontWeight: 600,
                        color: "#1a1a1a",
                        marginBottom: "4px",
                        lineHeight: "1.2"
                    }}>
                        {totalInvoices}
                    </div>
                    <div style={{
                        fontSize: "11px",
                        color: "#666",
                        fontWeight: 400,
                        lineHeight: "1.4",
                        marginBottom: "2px"
                    }}>
                        Active Invoices
                    </div>
                    <div style={{
                        fontSize: "9px",
                        color: "#999",
                        marginTop: "6px",
                        fontWeight: 400,
                        lineHeight: "1.3"
                    }}>
                        under AI supervision
                    </div>
                </div>

                {/* Hover Tooltip */}
                {hoveredSegment && (() => {
                    const segment = lifecycleSegments.find(s => s.status === hoveredSegment);
                    if (!segment || segment.count === 0) return null;
                    
                    const angle = (segment.startAngle + segment.endAngle) / 2;
                    const tooltipRadius = middleRingRadius + 25;
                    const tooltipX = 110 + tooltipRadius * Math.cos((angle * Math.PI) / 180);
                    const tooltipY = 110 + tooltipRadius * Math.sin((angle * Math.PI) / 180);
                    
                    // Adjust tooltip position to stay within bounds
                    const tooltipLeft = Math.max(10, Math.min(210, tooltipX));
                    const tooltipTop = Math.max(10, Math.min(210, tooltipY));
                    
                    return (
                        <div style={{
                            position: "absolute",
                            left: `${(tooltipLeft / 220) * 100}%`,
                            top: `${(tooltipTop / 220) * 100}%`,
                            transform: "translate(-50%, -50%)",
                            padding: "10px 14px",
                            background: "#1a1a1a",
                            color: "#ffffff",
                            fontSize: "11px",
                            borderRadius: "4px",
                            whiteSpace: "nowrap",
                            zIndex: 1000,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                            pointerEvents: "none",
                            minWidth: "140px"
                        }}>
                            <div style={{ fontWeight: 600, marginBottom: "6px", fontSize: "12px" }}>
                                {segment.status} — {segment.count} {segment.count === 1 ? 'invoice' : 'invoices'}
                            </div>
                            <div style={{ fontSize: "10px", opacity: 0.9, marginBottom: "4px" }}>
                                AI confidence: {segment.aiConfidence}%
                            </div>
                            <div style={{ fontSize: "10px", opacity: 0.8 }}>
                                {segment.hasAnomaly ? "⚠ Anomaly detected" : "✓ No anomaly detected"}
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}

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
                    {/* Left: Invoice Status Distribution */}
                    <div style={styles.sectionCard}>
                        <div style={styles.sectionTitle}>Invoice Status Distribution</div>
                        <div style={styles.sectionSubtitle}>Current financial period breakdown</div>
                        
                        {/* AI-Driven Radial Visualization */}
                        {metrics && (
                            <AILifecycleRing 
                                totalInvoices={invoices?.length || 0}
                                statusDistribution={metrics.statusDistribution}
                            />
                        )}
                        
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
                            {metrics && metrics.upcomingMaturitiesList && metrics.upcomingMaturitiesList.length > 0 ? (
                                <div style={{ marginTop: "16px" }}>
                                    {metrics.upcomingMaturitiesList.slice(0, 5).map((inv) => (
                                        <Link 
                                            key={inv.id} 
                                            href={`/invoices/${inv.id}`}
                                            style={{ 
                                                display: "block", 
                                                padding: "8px 12px", 
                                                marginBottom: "8px",
                                                background: "#f8f9fa",
                                                borderRadius: "4px",
                                                textDecoration: "none",
                                                color: "#1a1a1a",
                                                fontSize: "12px",
                                                border: "1px solid #e0e0e0",
                                                transition: "all 0.2s"
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = "#f0f0f0";
                                                e.currentTarget.style.borderColor = "#2563eb";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = "#f8f9fa";
                                                e.currentTarget.style.borderColor = "#e0e0e0";
                                            }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, marginBottom: "2px" }}>{inv.externalId}</div>
                                                    <div style={{ fontSize: "11px", color: "#666" }}>
                                                        {formatAmount(inv.amount, inv.currency)} • {inv.status}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: "right" }}>
                                                    <div style={{ fontWeight: 600, color: inv.daysUntilDue <= 3 ? "#ef4444" : "#666" }}>
                                                        {inv.daysUntilDue === 0 ? "Today" : inv.daysUntilDue === 1 ? "1 day" : `${inv.daysUntilDue} days`}
                                                    </div>
                                                    <div style={{ fontSize: "11px", color: "#666" }}>
                                                        {formatDate(inv.dueDate)}
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                    {metrics.upcomingMaturitiesList.length > 5 && (
                                        <div style={{ fontSize: "11px", color: "#666", textAlign: "center", marginTop: "8px" }}>
                                            +{metrics.upcomingMaturitiesList.length - 5} more invoices
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ marginTop: "16px", fontSize: "12px", color: "#666", fontStyle: "italic" }}>
                                    No invoices maturing in the next 7 days
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
                                            {metrics?.utilization.toFixed(1) || "0.0"}% / {metrics?.maxUtilization?.toFixed(0) || "80"}% max
                                        </span>
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
                                    {metrics && metrics.availableCapacity !== undefined && (
                                        <div style={{ 
                                            display: "flex", 
                                            justifyContent: "space-between", 
                                            marginTop: "8px",
                                            fontSize: "11px",
                                            color: "#666"
                                        }}>
                                            <span>Available Capacity:</span>
                                            <span style={{ fontWeight: 600, color: metrics.availableCapacity > 20 ? "#22c55e" : metrics.availableCapacity > 10 ? "#f59e0b" : "#ef4444" }}>
                                                {metrics.availableCapacity.toFixed(1)}%
                                            </span>
                                        </div>
                                    )}
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

