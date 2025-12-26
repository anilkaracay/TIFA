"use client";

import React, { useState, useMemo } from "react";
import { DecisionVelocityMetrics } from "../../../lib/ai-analytics-types";

interface VelocityBarsProps {
  metrics: DecisionVelocityMetrics;
}

export default function VelocityBars({ metrics }: VelocityBarsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Chart dimensions and margins
  const margin = { top: 20, bottom: 40, left: 45, right: 20 };
  const aspectRatio = 5; // width/height ratio for responsive design

  // Process data
  const bars = useMemo(() => {
    return metrics.decisionsPerMinute.slice(-30); // Last 30 minutes
  }, [metrics.decisionsPerMinute]);

  const maxCount = useMemo(() => {
    return Math.max(...bars.map((b) => b.count), 1);
  }, [bars]);

  // Empty state
  if (bars.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          padding: "40px 20px",
          textAlign: "center",
          background: "#f9fafb",
          borderRadius: "8px",
          border: "1px dashed #e5e7eb",
        }}
        role="status"
        aria-label="No data available"
      >
        <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "4px" }}>
          No decision data available
        </div>
        <div style={{ fontSize: "12px", color: "#9ca3af" }}>
          Data will appear once AI agents start processing
        </div>
      </div>
    );
  }


  // Generate grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    y: fraction,
    label: Math.round(maxCount * (1 - fraction)),
  }));

  // Format time for tooltip (minute is unix timestamp in seconds)
  const formatTime = (minute: number) => {
    const date = new Date(minute * 1000); // Convert to milliseconds
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };


  return (
    <div
      style={{
        width: "100%",
        padding: "20px 0",
        position: "relative"
      }}
    >
      {/* Responsive SVG container */}
      <div style={{ position: "relative", width: "100%", paddingBottom: `${100 / aspectRatio}%` }}>
        <svg
          viewBox={`0 0 ${600} ${120}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
          role="img"
          aria-label="Decision velocity bar chart showing decisions per minute over the last 30 minutes"
        >
          <defs>
            {/* Gradient for bars */}
            <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.8" />
            </linearGradient>

            {/* Gradient for active/hovered bar */}
            <linearGradient id="barGradientActive" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Background grid lines */}
          {gridLines.map((line, idx) => (
            <g key={idx}>
              <line
                x1={margin.left}
                y1={margin.top + line.y * (120 - margin.top - margin.bottom)}
                x2={600 - margin.right}
                y2={margin.top + line.y * (120 - margin.top - margin.bottom)}
                stroke={line.y === 1 ? "#d1d5db" : "#f3f4f6"}
                strokeWidth={line.y === 1 ? "1.5" : "1"}
                strokeDasharray={line.y === 1 ? "0" : "2,2"}
              />
              {/* Y-axis labels */}
              <text
                x={margin.left - 8}
                y={margin.top + line.y * (120 - margin.top - margin.bottom)}
                fontSize="10px"
                fill="#9ca3af"
                textAnchor="end"
                alignmentBaseline="middle"
                fontWeight={line.y === 0 || line.y === 1 ? "500" : "400"}
              >
                {line.label}
              </text>
            </g>
          ))}

          {/* Bars */}
          {bars.map((bar, idx) => {
            const chartHeight = 120 - margin.top - margin.bottom;
            const chartWidth = 600 - margin.left - margin.right;
            const barWidth = chartWidth / bars.length;
            const barHeight = (bar.count / maxCount) * chartHeight;
            const x = margin.left + idx * barWidth;
            const y = margin.top + chartHeight - barHeight;
            const isLast = idx === bars.length - 1;
            const isHovered = hoveredIndex === idx;

            return (
              <g key={idx}>
                {/* Bar */}
                <rect
                  x={x + barWidth * 0.15}
                  y={y}
                  width={barWidth * 0.7}
                  height={Math.max(barHeight, 1)} // Minimum 1px height for visibility
                  fill={isHovered || isLast ? "url(#barGradientActive)" : "url(#barGradient)"}
                  opacity={isHovered ? 1 : isLast ? 0.85 : 0.6}
                  rx="2"
                  style={{
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <animate
                    attributeName="height"
                    from="0"
                    to={Math.max(barHeight, 1)}
                    dur="0.6s"
                    fill="freeze"
                    begin={`${idx * 0.02}s`}
                  />
                  <animate
                    attributeName="y"
                    from={margin.top + chartHeight}
                    to={y}
                    dur="0.6s"
                    fill="freeze"
                    begin={`${idx * 0.02}s`}
                  />
                </rect>

                {/* Modern beacon indicator for latest bar */}
                {isLast && (
                  <g>
                    {/* Outer glow ring */}
                    <circle
                      cx={x + barWidth / 2}
                      cy={y - 8}
                      r="8"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                      opacity="0"
                    >
                      <animate
                        attributeName="r"
                        values="8;14;8"
                        dur="2.5s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0;0.4;0"
                        dur="2.5s"
                        repeatCount="indefinite"
                      />
                    </circle>

                    {/* Middle ring */}
                    <circle
                      cx={x + barWidth / 2}
                      cy={y - 8}
                      r="6"
                      fill="none"
                      stroke="#60a5fa"
                      strokeWidth="2"
                      opacity="0"
                    >
                      <animate
                        attributeName="r"
                        values="6;10;6"
                        dur="2.5s"
                        repeatCount="indefinite"
                        begin="0.3s"
                      />
                      <animate
                        attributeName="opacity"
                        values="0;0.6;0"
                        dur="2.5s"
                        repeatCount="indefinite"
                        begin="0.3s"
                      />
                    </circle>

                    {/* Solid core circle */}
                    <circle
                      cx={x + barWidth / 2}
                      cy={y - 8}
                      r="4"
                      fill="#2563eb"
                      opacity="1"
                    >
                      <animate
                        attributeName="r"
                        values="4;4.5;4"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    </circle>

                    {/* Inner highlight */}
                    <circle
                      cx={x + barWidth / 2}
                      cy={y - 8}
                      r="2"
                      fill="#ffffff"
                      opacity="0.8"
                    >
                      <animate
                        attributeName="opacity"
                        values="0.8;1;0.8"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                )}

                {/* Invisible hover area for better UX */}
                <rect
                  x={x}
                  y={margin.top}
                  width={barWidth}
                  height={chartHeight}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              </g>
            );
          })}

          {/* X-axis */}
          <line
            x1={margin.left}
            y1={120 - margin.bottom}
            x2={600 - margin.right}
            y2={120 - margin.bottom}
            stroke="#d1d5db"
            strokeWidth="1.5"
          />

          {/* X-axis time labels - show first, middle, and last */}
          {[0, Math.floor(bars.length / 2), bars.length - 1].map((idx) => {
            if (idx >= bars.length) return null;
            const chartWidth = 600 - margin.left - margin.right;
            const barWidth = chartWidth / bars.length;
            const x = margin.left + idx * barWidth + barWidth / 2;

            return (
              <text
                key={idx}
                x={x}
                y={120 - margin.bottom + 16}
                fontSize="10px"
                fill="#6b7280"
                textAnchor="middle"
                fontWeight="500"
              >
                {formatTime(bars[idx].minute)}
              </text>
            );
          })}

          {/* Y-axis label */}
          <text
            x={margin.left - 35}
            y={margin.top + (120 - margin.top - margin.bottom) / 2}
            fontSize="10px"
            fill="#6b7280"
            textAnchor="middle"
            transform={`rotate(-90, ${margin.left - 35}, ${margin.top + (120 - margin.top - margin.bottom) / 2})`}
            fontWeight="600"
          >
            DECISIONS
          </text>
        </svg>

        {/* Tooltip */}
        {hoveredIndex !== null && hoveredIndex < bars.length && (
          <div
            style={{
              position: "absolute",
              left: `${((hoveredIndex + 0.5) / bars.length) * 100}%`,
              top: "-10px",
              transform: "translate(-50%, -100%)",
              background: "rgba(15, 23, 42, 0.95)",
              backdropFilter: "blur(8px)",
              color: "#ffffff",
              padding: "8px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 500,
              whiteSpace: "nowrap",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
              pointerEvents: "none",
              zIndex: 10,
              animation: "tooltipFadeIn 0.15s ease-out",
            }}
          >
            <div style={{ marginBottom: "2px", fontSize: "13px", fontWeight: 600 }}>
              {bars[hoveredIndex].count} {bars[hoveredIndex].count === 1 ? 'decision' : 'decisions'}
            </div>
            <div style={{ fontSize: "11px", color: "#cbd5e1" }}>
              {formatTime(bars[hoveredIndex].minute)}
            </div>
            {/* Tooltip arrow */}
            <div
              style={{
                position: "absolute",
                bottom: "-4px",
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "5px solid rgba(15, 23, 42, 0.95)",
              }}
            />
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translate(-50%, -100%) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -100%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

