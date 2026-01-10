"use client";

import React, { useMemo } from "react";
import VelocityBars from "../charts/VelocityBars";
import KpiStrip, { KpiItem } from "../KpiStrip";
import { DecisionVelocityMetrics } from "../../../lib/ai-analytics-types";

interface SlideDecisionVelocityProps {
  metrics: DecisionVelocityMetrics;
}

// Memoized component for better performance
const SlideDecisionVelocity = React.memo(({ metrics }: SlideDecisionVelocityProps) => {
  // Calculate KPIs with useMemo to avoid recalculation on every render
  const kpis: KpiItem[] = useMemo(() => {
    // Validate data to handle edge cases
    const decisionsData = metrics.decisionsPerMinute || [];
    const totalLast30min = decisionsData.reduce((sum, m) => sum + (m.count || 0), 0);
    const avgPerMinute = decisionsData.length > 0
      ? totalLast30min / decisionsData.length
      : 0;

    // Determine trend based on recent activity
    const recentAvg = decisionsData.slice(-10).reduce((sum, m) => sum + (m.count || 0), 0) / Math.max(decisionsData.slice(-10).length, 1);
    const olderAvg = decisionsData.slice(0, -10).reduce((sum, m) => sum + (m.count || 0), 0) / Math.max(decisionsData.slice(0, -10).length, 1);
    const decideTrend = decisionsData.length >= 20
      ? (recentAvg > olderAvg ? "up" : recentAvg < olderAvg ? "down" : "flat")
      : totalLast30min > 0 ? "up" : "flat";

    return [
      {
        label: "Decisions (30min)",
        value: totalLast30min,
        trend: decideTrend,
      },
      {
        label: "Avg/Min",
        value: avgPerMinute.toFixed(1),
        subtext: "Last 30 minutes",
      },
      {
        label: "Signals Processed",
        value: metrics.signalsProcessed || 0,
      },
      {
        label: "Active Agents",
        value: metrics.activeAgents || 0,
      },
      {
        label: "Eval Time",
        value: metrics.avgEvaluationTime
          ? `${Math.round(metrics.avgEvaluationTime)}ms`
          : "—",
        subtext: metrics.avgEvaluationTime ? "Average" : "If available",
        valueColor: metrics.avgEvaluationTime && metrics.avgEvaluationTime > 1000
          ? "#ef4444"
          : metrics.avgEvaluationTime && metrics.avgEvaluationTime > 500
            ? "#f59e0b"
            : undefined,
      },
    ];
  }, [metrics]);

  return (
    <div role="region" aria-label="Decision Velocity Analytics">
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h3
          style={{
            fontSize: "18px",
            fontWeight: 600,
            color: "#1a1a1a",
            marginBottom: "4px",
            letterSpacing: "-0.01em",
          }}
        >
          Decision Velocity
        </h3>
        <p style={{ fontSize: "13px", color: "#6b7280", lineHeight: "1.5" }}>
          AI agent activity and decision throughput
        </p>
      </div>

      {/* Chart Section */}
      <div
        style={{
          background: "#f9fafb",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "8px",
          border: "1px solid #f3f4f6",
        }}
      >
        <VelocityBars metrics={metrics} />
      </div>

      {/* KPI Strip */}
      <KpiStrip items={kpis} />
    </div>
  );
});

SlideDecisionVelocity.displayName = "SlideDecisionVelocity";

export default SlideDecisionVelocity;






