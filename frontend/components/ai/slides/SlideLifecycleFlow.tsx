"use client";

import React from "react";
import { LifecycleMetrics } from "../../../lib/ai-analytics-types";
import AILifecycleRing from "../AILifecycleRing";

interface SlideLifecycleFlowProps {
  metrics: LifecycleMetrics;
}

export default function SlideLifecycleFlow({ metrics }: SlideLifecycleFlowProps) {
  // Convert metrics.statusCounts to the format expected by AILifecycleRing
  const statusDistribution = {
    ISSUED: metrics.statusCounts.ISSUED || 0,
    TOKENIZED: metrics.statusCounts.TOKENIZED || 0,
    FINANCED: metrics.statusCounts.FINANCED || 0,
    REPAID: metrics.statusCounts.REPAID || 0,
    DEFAULTED: metrics.statusCounts.DEFAULTED || 0,
  };
  
  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#1a1a1a", marginBottom: "4px" }}>
          Invoice Status Distribution
        </h3>
        <p style={{ fontSize: "13px", color: "#6b7280" }}>
          Current financial period breakdown
        </p>
      </div>
      
      {/* AI-Driven Radial Visualization */}
      <AILifecycleRing 
        totalInvoices={metrics.totalActive}
        statusDistribution={statusDistribution}
      />
      
      {/* Distribution Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "12px",
        marginTop: "20px",
      }}>
        <div style={{
          textAlign: "center",
          padding: "16px",
          background: "#f8f9fa",
          borderRadius: "4px",
        }}>
          <div style={{
            fontSize: "11px",
            color: "#666",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}>Issued</div>
          <div style={{
            fontSize: "24px",
            fontWeight: 600,
            color: "#1a1a1a",
          }}>{statusDistribution.ISSUED}</div>
        </div>
        <div style={{
          textAlign: "center",
          padding: "16px",
          background: "#f8f9fa",
          borderRadius: "4px",
        }}>
          <div style={{
            fontSize: "11px",
            color: "#666",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}>Tokenized</div>
          <div style={{
            fontSize: "24px",
            fontWeight: 600,
            color: "#1a1a1a",
          }}>{statusDistribution.TOKENIZED}</div>
        </div>
        <div style={{
          textAlign: "center",
          padding: "16px",
          background: "#f8f9fa",
          borderRadius: "4px",
        }}>
          <div style={{
            fontSize: "11px",
            color: "#666",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}>Financed</div>
          <div style={{
            fontSize: "24px",
            fontWeight: 600,
            color: "#1a1a1a",
          }}>{statusDistribution.FINANCED}</div>
        </div>
        <div style={{
          textAlign: "center",
          padding: "16px",
          background: "#f8f9fa",
          borderRadius: "4px",
        }}>
          <div style={{
            fontSize: "11px",
            color: "#666",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}>Repaid</div>
          <div style={{
            fontSize: "24px",
            fontWeight: 600,
            color: "#1a1a1a",
          }}>{statusDistribution.REPAID}</div>
        </div>
        <div style={{
          textAlign: "center",
          padding: "16px",
          background: "#f8f9fa",
          borderRadius: "4px",
        }}>
          <div style={{
            fontSize: "11px",
            color: "#666",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}>Defaulted</div>
          <div style={{
            fontSize: "24px",
            fontWeight: 600,
            color: "#1a1a1a",
          }}>{statusDistribution.DEFAULTED}</div>
        </div>
      </div>
    </div>
  );
}

