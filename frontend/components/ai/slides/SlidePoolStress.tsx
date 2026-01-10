"use client";

import React from "react";
import UtilizationLine from "../charts/UtilizationLine";
import KpiStrip, { KpiItem } from "../KpiStrip";
import { PoolStressMetrics } from "../../../lib/ai-analytics-types";

interface SlidePoolStressProps {
  metrics: PoolStressMetrics;
}

export default function SlidePoolStress({ metrics }: SlidePoolStressProps) {
  const kpis: KpiItem[] = [
    {
      label: "Current Utilization",
      value: `${metrics.currentUtilization.toFixed(1)}%`,
      trend: metrics.currentUtilization >= (metrics.utilizationSeries[0]?.value || 0) ? "up" : "down",
    },
    {
      label: "Max (60min)",
      value: `${metrics.maxUtilization60min.toFixed(1)}%`,
    },
    {
      label: "Blocked Tx (24h)",
      value: metrics.blockedTx24h,
      trend: metrics.blockedTx24h > 0 ? "up" : "flat",
    },
    {
      label: "Protection",
      value: metrics.protectionActive ? "Active" : "Inactive",
      subtext: metrics.protectionActive ? "Auto-guardrails on" : "Monitoring",
      valueColor: metrics.protectionActive ? "#f59e0b" : "#dc2626",
      valueFontSize: "16px",
    },
    {
      label: "Default Buffer",
      value: metrics.defaultBuffer
        ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          notation: 'compact',
          maximumFractionDigits: 1
        }).format(metrics.defaultBuffer)
        : "—",
      subtext: "Buffer reserve",
      valueFontSize: "16px",
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#1a1a1a", marginBottom: "4px" }}>
          Pool Stress & Protection
        </h3>
        <p style={{ fontSize: "13px", color: "#6b7280" }}>
          Real-time utilization monitoring and safety guardrails
        </p>
      </div>

      <div style={{ height: "220px", width: "100%", marginBottom: "32px" }}>
        <UtilizationLine
          series={metrics.utilizationSeries}
          currentValue={metrics.currentUtilization}
          threshold={75}
          maxThreshold={80}
        />
      </div>

      <KpiStrip items={kpis} />
    </div>
  );
}







