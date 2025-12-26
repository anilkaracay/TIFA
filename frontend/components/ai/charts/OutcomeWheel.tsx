"use client";

import React from "react";
import { FinancingMetrics } from "../../../lib/ai-analytics-types";

interface OutcomeWheelProps {
  metrics: FinancingMetrics;
}

export default function OutcomeWheel({ metrics }: OutcomeWheelProps) {
  const size = 200;
  const center = size / 2;
  const radius = 70;
  const innerRadius = 40;
  
  const outcomes = [
    { type: "FINANCE", label: "Financed", color: "#4fb87a", count: metrics.decisions24h.FINANCE },
    { type: "FINANCE_BLOCKED", label: "Blocked", color: "#ef4444", count: metrics.decisions24h.FINANCE_BLOCKED },
    { type: "SAFETY_BLOCKED", label: "Safety", color: "#f59e0b", count: metrics.decisions24h.SAFETY_BLOCKED },
    { type: "FINANCE_FAILED", label: "Failed", color: "#d87a7a", count: metrics.decisions24h.FINANCE_FAILED },
  ];
  
  const total = outcomes.reduce((sum, o) => sum + o.count, 0) || 1;
  
  // Calculate segments
  let currentAngle = -90;
  const segments = outcomes
    .filter((o) => o.count > 0)
    .map((outcome) => {
      const percentage = (outcome.count / total) * 100;
      const angleSpan = (percentage / 100) * 360;
      
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSpan;
      
      currentAngle = endAngle;
      
      return {
        ...outcome,
        percentage,
        startAngle,
        endAngle,
      };
    });
  
  const angleToCoord = (angle: number, r: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: center + r * Math.cos(rad),
      y: center + r * Math.sin(rad),
    };
  };
  
  const createArcPath = (startAngle: number, endAngle: number, outerR: number, innerR: number) => {
    const startOuter = angleToCoord(startAngle, outerR);
    const endOuter = angleToCoord(endAngle, outerR);
    const startInner = angleToCoord(startAngle, innerR);
    const endInner = angleToCoord(endAngle, innerR);
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M ${startOuter.x} ${startOuter.y}
            A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}
            L ${endInner.x} ${endInner.y}
            A ${innerR} ${innerR} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}
            Z`;
  };
  
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {/* Donut chart */}
      <div style={{ position: "relative", width: size, height: size, marginBottom: "16px" }}>
        <svg width={size} height={size} style={{ overflow: "visible" }}>
          {segments.map((seg) => (
            <path
              key={seg.type}
              d={createArcPath(seg.startAngle, seg.endAngle, radius, innerRadius)}
              fill={seg.color}
              opacity="0.85"
              stroke="#fff"
              strokeWidth="2.5"
            />
          ))}
        </svg>
        
        {/* Center text */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "32px", fontWeight: 700, color: "#0f172a", lineHeight: "1.2" }}>
            {total}
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", fontWeight: 500 }}>
            Auto Decisions
          </div>
          <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>
            (24h)
          </div>
        </div>
      </div>
    </div>
  );
}

