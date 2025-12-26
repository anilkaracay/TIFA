"use client";

import React from "react";
import RiskSpectrum from "../charts/RiskSpectrum";
import KpiStrip, { KpiItem } from "../KpiStrip";
import { RiskMetrics } from "../../../lib/ai-analytics-types";

interface SlideRiskLandscapeProps {
  metrics: RiskMetrics;
}

export default function SlideRiskLandscape({ metrics }: SlideRiskLandscapeProps) {
  const kpis: KpiItem[] = [
    {
      label: "Avg Risk Score",
      value: metrics.avgRiskScore.toFixed(1),
      subtext: "0-100 scale",
    },
    {
      label: "Low Risk",
      value: metrics.buckets.low,
      trend: "flat",
    },
    {
      label: "Medium Risk",
      value: metrics.buckets.medium,
      trend: metrics.buckets.medium > metrics.buckets.low ? "up" : "flat",
    },
    {
      label: "High Risk",
      value: metrics.buckets.high,
      trend: metrics.buckets.high > 0 ? "up" : "flat",
    },
    {
      label: "Blocked (24h)",
      value: metrics.blockedActions24h,
      subtext: "Safety blocks",
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: "32px", paddingLeft: "4px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#1a1a1a", marginBottom: "4px" }}>
          Risk Landscape
        </h3>
        <p style={{ fontSize: "13px", color: "#6b7280" }}>
          AI-assessed risk distribution across active invoices
        </p>
      </div>

      <RiskSpectrum metrics={metrics} />

      <KpiStrip items={kpis} />
    </div>
  );
}


