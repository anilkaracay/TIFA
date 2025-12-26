"use client";

import React, { useState } from "react";
import { RiskMetrics } from "../../../lib/ai-analytics-types";

interface RiskSpectrumProps {
  metrics: RiskMetrics;
}

export default function RiskSpectrum({ metrics }: RiskSpectrumProps) {
  const [filter, setFilter] = useState<"all" | "low" | "medium" | "high">("all");

  // Use viewBox for responsiveness instead of fixed pixel width
  const viewBoxWidth = 800; // Internal coordinate system width
  const viewBoxHeight = 100;
  const margin = { top: 30, bottom: 20, left: 20, right: 20 };
  const chartWidth = viewBoxWidth - margin.left - margin.right;
  const chartHeight = viewBoxHeight - margin.top - margin.bottom;

  // Filter invoices based on selected filter
  const filteredInvoices = metrics.invoicesWithRisk.filter((inv) => {
    if (filter === "all") return true;
    if (filter === "low") return inv.riskScore <= 30;
    if (filter === "medium") return inv.riskScore > 30 && inv.riskScore <= 50;
    if (filter === "high") return inv.riskScore > 50;
    return true;
  });

  // Position dots along the spectrum
  const dots = filteredInvoices.map((inv, idx) => {
    const x = margin.left + (inv.riskScore / 100) * chartWidth;
    const y = margin.top + chartHeight / 2;

    let color = "#10b981"; // low
    if (inv.riskScore > 50) color = "#ef4444"; // high
    else if (inv.riskScore > 30) color = "#f59e0b"; // medium

    return {
      invoiceId: inv.invoiceId,
      riskScore: inv.riskScore,
      x,
      y,
      color,
    };
  });

  return (
    <div style={{ width: "100%", padding: "10px 0 20px 0" }}>
      {/* Premium Segmented Control / Filter tabs */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        marginBottom: "20px"
      }}>
        <div style={{
          display: "flex",
          background: "#f1f5f9",
          padding: "4px",
          borderRadius: "12px",
          gap: "2px"
        }}>
          {(["all", "low", "medium", "high"] as const).map((f) => {
            const isActive = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                type="button"
                style={{
                  padding: "6px 16px",
                  fontSize: "13px",
                  borderRadius: "8px",
                  border: "none",
                  background: isActive ? "#ffffff" : "transparent",
                  color: isActive ? "#0f172a" : "#64748b",
                  cursor: "pointer",
                  textTransform: "capitalize",
                  fontWeight: isActive ? 600 : 500,
                  boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.01)" : "none",
                  transition: "all 0.2s ease",
                  minWidth: "80px",
                }}
              >
                {f} <span style={{ opacity: 0.6, fontSize: "11px", marginLeft: "2px" }}>
                  ({f === "all" ? metrics.invoicesWithRisk.length : metrics.buckets[f]})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Responsive Spectrum Strip */}
      <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto", position: "relative" }}>
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          style={{ width: "100%", height: "auto", overflow: "visible" }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Gradient Definition */}
          <defs>
            <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />       {/* Low Risk: Emerald */}
              <stop offset="40%" stopColor="#84cc16" />      {/* Low-Medium: Lime */}
              <stop offset="60%" stopColor="#f59e0b" />      {/* Medium: Amber */}
              <stop offset="100%" stopColor="#ef4444" />     {/* High: Red */}
            </linearGradient>

            {/* Soft Glow Filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Marker Shadow */}
            <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.2" />
            </filter>
          </defs>

          {/* Background Track */}
          <rect
            x={margin.left}
            y={margin.top + chartHeight / 2 - 6}
            width={chartWidth}
            height={12}
            fill="#e2e8f0"
            rx="6"
          />

          {/* Gradient Bar */}
          <rect
            x={margin.left}
            y={margin.top + chartHeight / 2 - 6}
            width={chartWidth}
            height={12}
            fill="url(#riskGradient)"
            rx="6"
            opacity="0.9"
          />

          {/* Grid lines / Scale markers */}
          {[0, 25, 50, 75, 100].map(val => {
            const xPos = margin.left + (val / 100) * chartWidth;
            return (
              <g key={val}>
                <line
                  x1={xPos}
                  y1={margin.top + chartHeight / 2 + 10}
                  x2={xPos}
                  y2={margin.top + chartHeight / 2 + 16}
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
                <text
                  x={xPos}
                  y={margin.top + chartHeight / 2 + 28}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#64748b"
                  fontWeight="500"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Risk Dots */}
          {dots.map((dot, _idx) => (
            <circle
              key={`${dot.invoiceId}-${_idx}`}
              cx={dot.x}
              cy={dot.y}
              r="5"
              fill="white"
              stroke={dot.color}
              strokeWidth="2.5"
              style={{
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
              className="risk-dot"
            >
              <title>Score: {dot.riskScore.toFixed(1)}</title>
            </circle>
          ))}

          {/* Average Indicator Marker */}
          <g transform={`translate(${margin.left + (metrics.avgRiskScore / 100) * chartWidth}, ${margin.top + chartHeight / 2 - 12})`}>
            {/* Marker Shape */}
            <path
              d="M 0 0 L -8 -10 C -8 -14, -4 -18, 0 -18 C 4 -18, 8 -14, 8 -10 Z"
              fill="#1e293b"
              filter="url(#dropShadow)"
            />
            {/* Label inside marker (if space permits) or above */}
            <text
              x="0"
              y="-24"
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="#1e293b"
            >
              {metrics.avgRiskScore.toFixed(1)}
            </text>
            <text
              x="0"
              y="-38"
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="#64748b"
              style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}
            >
              AVG
            </text>
          </g>

        </svg>
      </div>

      <style jsx>{`
        .risk-dot:hover {
          r: 7;
          stroke-width: 3;
          z-index: 10;
        }
      `}</style>
    </div>
  );
}


