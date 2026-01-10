"use client";

import React, { useState } from "react";

interface LifecycleArcProps {
  statusCounts: Record<string, number>;
  totalActive: number;
}

const statusColors: Record<string, string> = {
  ISSUED: "#8b7cc0",
  TOKENIZED: "#5b8fd8",
  FINANCED: "#4fb87a",
  REPAID: "#d4a574",
  DEFAULTED: "#d87a7a",
  PARTIALLY_PAID: "#f59e0b",
  PAID: "#10b981",
};

export default function LifecycleArc({ statusCounts, totalActive }: LifecycleArcProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  
  const statuses = ["ISSUED", "TOKENIZED", "FINANCED", "REPAID", "DEFAULTED"];
  const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0) || 1;
  
  const size = 200;
  const center = size / 2;
  const radius = 70;
  const innerRadius = 40;
  
  // Calculate segments
  let currentAngle = -90; // Start at top
  const segments = statuses.map((status) => {
    const count = statusCounts[status] || 0;
    const percentage = (count / total) * 100;
    const angleSpan = (percentage / 100) * 360;
    
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleSpan;
    
    currentAngle = endAngle;
    
    return {
      status,
      count,
      percentage,
      startAngle,
      endAngle,
      color: statusColors[status] || "#94a3b8",
    };
  });
  
  // Convert angle to coordinates
  const angleToCoord = (angle: number, r: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: center + r * Math.cos(rad),
      y: center + r * Math.sin(rad),
    };
  };
  
  // Create path for arc segment
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
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="1"
          opacity="0.3"
        />
        
        {/* Segments */}
        {segments.map((seg) => {
          if (seg.count === 0) return null;
          
          const isHovered = hoveredSegment === seg.status;
          
          return (
            <g key={seg.status}>
              <path
                d={createArcPath(seg.startAngle, seg.endAngle, radius, innerRadius)}
                fill={seg.color}
                opacity={isHovered ? 0.9 : 0.7}
                stroke={isHovered ? seg.color : "none"}
                strokeWidth={isHovered ? 2 : 0}
                onMouseEnter={() => setHoveredSegment(seg.status)}
                onMouseLeave={() => setHoveredSegment(null)}
                style={{ cursor: "pointer", transition: "opacity 0.2s" }}
              />
            </g>
          );
        })}
        
        {/* Node ring (subtle dots) */}
        {segments.map((seg) => {
          if (seg.count === 0) return null;
          const midAngle = (seg.startAngle + seg.endAngle) / 2;
          const nodePos = angleToCoord(midAngle, radius + 8);
          
          return (
            <circle
              key={`node-${seg.status}`}
              cx={nodePos.x}
              cy={nodePos.y}
              r="3"
              fill={seg.color}
              opacity="0.4"
            />
          );
        })}
      </svg>
      
      {/* Center text */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: "28px", fontWeight: 600, color: "#1a1a1a", lineHeight: "1.2" }}>
          {totalActive}
        </div>
        <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
          AI monitored
        </div>
      </div>
      
      {/* Tooltip */}
      {hoveredSegment && (() => {
        const seg = segments.find((s) => s.status === hoveredSegment);
        if (!seg) return null;
        
        return (
          <div
            style={{
              position: "absolute",
              top: "-60px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "#1a1a1a",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            <div style={{ fontWeight: 600 }}>{seg.status}</div>
            <div style={{ fontSize: "11px", opacity: 0.9 }}>
              {seg.count} ({seg.percentage.toFixed(1)}%)
            </div>
          </div>
        );
      })()}
    </div>
  );
}







