"use client";

import React from "react";
import { UtilizationPoint } from "../../../lib/ai-analytics-types";

interface UtilizationLineProps {
  series: UtilizationPoint[];
  currentValue: number;
  threshold: number;
  maxThreshold?: number;
}

export default function UtilizationLine({
  series,
  currentValue,
  threshold,
  maxThreshold,
}: UtilizationLineProps) {
  // Responsive setup - use viewBox instead of fixed pixel width
  const viewBoxWidth = 1000;
  const viewBoxHeight = 250;
  const margin = { top: 30, bottom: 40, left: 60, right: 30 };
  const chartWidth = viewBoxWidth - margin.left - margin.right;
  const chartHeight = viewBoxHeight - margin.top - margin.bottom;

  // Use last 60 points or all if less
  const displaySeries = series.slice(-60);

  if (displaySeries.length === 0) {
    // Show current value as a single point
    const x = margin.left + chartWidth / 2;
    const y = margin.top + chartHeight - (currentValue / 100) * chartHeight;

    return (
      <div style={{ width: "100%", height: "100%", minHeight: "200px", padding: "10px 0" }}>
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          width="100%"
          height="100%"
          style={{ overflow: "visible" }}
        >
          <line
            x1={margin.left}
            y1={margin.top + chartHeight}
            x2={margin.left + chartWidth}
            y2={margin.top + chartHeight}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
          <circle cx={x} cy={y} r="6" fill="#2563eb" />
          <text
            x={x + 10}
            y={y}
            fontSize="12px"
            fontWeight={600}
            fill="#2563eb"
            alignmentBaseline="middle"
          >
            {currentValue.toFixed(1)}%
          </text>
        </svg>
      </div>
    );
  }

  const minTime = Math.min(...displaySeries.map((p) => p.timestamp));
  const maxTime = Math.max(...displaySeries.map((p) => p.timestamp));
  const timeRange = maxTime - minTime || 1;

  const minValue = 0;
  const maxValue = 100;
  const valueRange = maxValue - minValue;

  // Create path
  const points = displaySeries.map((p) => {
    const x = margin.left + ((p.timestamp - minTime) / timeRange) * chartWidth;
    const y = margin.top + chartHeight - ((p.value - minValue) / valueRange) * chartHeight;
    return { x, y, value: p.value };
  });

  const pathData = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // Current value position
  const lastPoint = points[points.length - 1];

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "200px", padding: "10px 0" }}>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        width="100%"
        height="100%"
        style={{ overflow: "visible" }}
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = margin.top + chartHeight - ((val - minValue) / valueRange) * chartHeight;
          return (
            <g key={val}>
              <line
                x1={margin.left}
                y1={y}
                x2={margin.left + chartWidth}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.5"
              />
              <text x={margin.left - 8} y={y} fontSize="10px" fill="#9ca3af" textAnchor="end" alignmentBaseline="middle">
                {val}%
              </text>
            </g>
          );
        })}

        {/* Threshold lines */}
        <line
          x1={margin.left}
          y1={margin.top + chartHeight - ((threshold - minValue) / valueRange) * chartHeight}
          x2={margin.left + chartWidth}
          y2={margin.top + chartHeight - ((threshold - minValue) / valueRange) * chartHeight}
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          opacity="0.7"
        />
        {maxThreshold && (
          <line
            x1={margin.left}
            y1={margin.top + chartHeight - ((maxThreshold - minValue) / valueRange) * chartHeight}
            x2={margin.left + chartWidth}
            y2={margin.top + chartHeight - ((maxThreshold - minValue) / valueRange) * chartHeight}
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.7"
          />
        )}

        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Area under curve */}
        <path
          d={`${pathData} L ${lastPoint.x} ${margin.top + chartHeight} L ${points[0].x} ${margin.top + chartHeight} Z`}
          fill="url(#utilizationGradient)"
          opacity="0.1"
        />
        <defs>
          <linearGradient id="utilizationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Current value badge */}
        {lastPoint && (
          <g>
            <circle cx={lastPoint.x} cy={lastPoint.y} r="6" fill="#2563eb" />
            <circle cx={lastPoint.x} cy={lastPoint.y} r="8" fill="#2563eb" opacity="0.2" />
            <text
              x={lastPoint.x}
              y={lastPoint.y - 12}
              fontSize="11px"
              fontWeight={600}
              fill="#2563eb"
              textAnchor="middle"
            >
              {currentValue.toFixed(1)}%
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}


