"use client";

import React, { useState, useEffect } from "react";

interface AILifecycleRingProps {
  totalInvoices: number;
  statusDistribution: Record<string, number>;
}

export default function AILifecycleRing({ totalInvoices, statusDistribution }: AILifecycleRingProps) {
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
    const angleSpan = 360 / statusOrder.length; // 72 degrees each
    let currentAngle = -90; // Start at top (-90 degrees)
    
    const lifecycleSegments = statusOrder.map((status) => {
        const count = statusDistribution[status] || 0;
        const percentage = (count / total) * 100;
        
        const startAngle = currentAngle;
        const endAngle = currentAngle + angleSpan;
        const baseAngle = currentAngle + angleSpan / 2;
        
        currentAngle = endAngle;
        
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

    const createLifecycleArc = (startAngle: number, endAngle: number, radius: number, thickness: number) => {
        const start = (startAngle * Math.PI) / 180;
        const end = (endAngle * Math.PI) / 180;
        const innerRadius = radius - thickness / 2;
        const outerRadius = radius + thickness / 2;
        const centerX = 110;
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
                        <radialGradient id="coreGlow" cx="50%" cy="50%">
                            <stop offset="0%" stopColor="rgba(37, 99, 235, 0.08)" />
                            <stop offset="100%" stopColor="rgba(37, 99, 235, 0)" />
                        </radialGradient>
                    </defs>

                    <circle
                        cx="110"
                        cy="110"
                        r={outerRingRadius}
                        fill="none"
                        stroke="#e0e0e0"
                        strokeWidth="1"
                        opacity="0.4"
                    />
                    
                    {Array.from({ length: 48 }).map((_, i) => {
                        const angle = (i / 48) * 360 - 90;
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

                    {lifecycleSegments.map((segment, index) => {
                        const isHovered = hoveredSegment === segment.status;
                        const baseThickness = 8;
                        const maxThickness = 16;
                        const thickness = segment.count === 0 
                            ? 3 
                            : Math.min(maxThickness, baseThickness + (segment.count / total) * 8);
                        const nextSegment = lifecycleSegments[(index + 1) % lifecycleSegments.length];
                        
                        return (
                            <g key={segment.status}>
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
                                        <circle
                                            cx={110 + middleRingRadius * Math.cos((nextSegment.startAngle * Math.PI) / 180)}
                                            cy={110 + middleRingRadius * Math.sin((nextSegment.startAngle * Math.PI) / 180)}
                                            r="2"
                                            fill={nextSegment.color}
                                            opacity="0.4"
                                        />
                                    </g>
                                )}
                                
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
                        Total Invoices
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

                {hoveredSegment && (() => {
                    const segment = lifecycleSegments.find(s => s.status === hoveredSegment);
                    if (!segment || segment.count === 0) return null;
                    
                    const angle = (segment.startAngle + segment.endAngle) / 2;
                    const tooltipRadius = middleRingRadius + 25;
                    const tooltipX = 110 + tooltipRadius * Math.cos((angle * Math.PI) / 180);
                    const tooltipY = 110 + tooltipRadius * Math.sin((angle * Math.PI) / 180);
                    
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





