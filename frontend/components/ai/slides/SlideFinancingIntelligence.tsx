"use client";

import React from "react";
import OutcomeWheel from "../charts/OutcomeWheel";
import { FinancingMetrics } from "../../../lib/ai-analytics-types";

interface SlideFinancingIntelligenceProps {
  metrics: FinancingMetrics;
}

export default function SlideFinancingIntelligence({ metrics }: SlideFinancingIntelligenceProps) {
  const totalDecisions =
    metrics.decisions24h.FINANCE +
    metrics.decisions24h.FINANCE_BLOCKED +
    metrics.decisions24h.SAFETY_BLOCKED +
    metrics.decisions24h.FINANCE_FAILED;
  
  const successRate =
    totalDecisions > 0 ? (metrics.decisions24h.FINANCE / totalDecisions) * 100 : 0;
  
  const outcomes = [
    { 
      type: "FINANCE", 
      label: "Financed", 
      color: "#16a34a", 
      count: metrics.decisions24h.FINANCE,
      description: "Successfully financed"
    },
    { 
      type: "FINANCE_BLOCKED", 
      label: "Blocked by Liquidity", 
      color: "#ef4444", 
      count: metrics.decisions24h.FINANCE_BLOCKED,
      description: "Insufficient pool liquidity"
    },
    { 
      type: "SAFETY_BLOCKED", 
      label: "Blocked by Safety", 
      color: "#f59e0b", 
      count: metrics.decisions24h.SAFETY_BLOCKED,
      description: "Risk or limit exceeded"
    },
    { 
      type: "FINANCE_FAILED", 
      label: "Failed", 
      color: "#dc2626", 
      count: metrics.decisions24h.FINANCE_FAILED,
      description: "Transaction failed"
    },
  ];
  
  return (
    <div>
      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#1a1a1a", marginBottom: "4px" }}>
          Financing Intelligence
        </h3>
        <p style={{ fontSize: "13px", color: "#6b7280" }}>
          AI decision outcomes and auto-financing performance
        </p>
      </div>
      
      {/* Main visualization */}
      <div style={{ 
        display: "flex", 
        gap: "40px", 
        alignItems: "flex-start", 
        justifyContent: "center",
        marginBottom: "32px"
      }}>
        <OutcomeWheel metrics={metrics} />
        
        {/* Decision breakdown */}
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "12px",
          minWidth: "240px"
        }}>
          {outcomes.map((outcome) => {
            const percentage = totalDecisions > 0 ? (outcome.count / totalDecisions) * 100 : 0;
            return (
              <div 
                key={outcome.type}
                style={{
                  padding: "12px 16px",
                  background: "#ffffff",
                  border: `1px solid ${outcome.color}20`,
                  borderRadius: "8px",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${outcome.color}08`;
                  e.currentTarget.style.borderColor = `${outcome.color}40`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = `${outcome.color}20`;
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "3px",
                        background: outcome.color,
                        flexShrink: 0
                      }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a1a1a" }}>
                      {outcome.label}
                    </span>
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>
                    {outcome.count}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {outcome.description}
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: outcome.color }}>
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Key metrics */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "12px",
        paddingTop: "24px",
        borderTop: "1px solid #f1f5f9"
      }}>
        {/* Success Rate */}
        <div style={{
          padding: "16px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px"
        }}>
          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase" }}>
            Success Rate
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: successRate > 50 ? "#16a34a" : successRate > 20 ? "#f59e0b" : "#ef4444", marginBottom: "4px" }}>
            {successRate.toFixed(1)}%
          </div>
          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
            Last 24h
          </div>
        </div>
        
        {/* Auto-Financed */}
        <div style={{
          padding: "16px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px"
        }}>
          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase" }}>
            Auto-Financed
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
            {metrics.autoFinancedCount}
          </div>
          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
            Invoices
          </div>
        </div>
        
        {/* Blocked Total */}
        <div style={{
          padding: "16px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px"
        }}>
          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase" }}>
            Total Blocked
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#ef4444", marginBottom: "4px" }}>
            {metrics.blockedByLiquidity + metrics.blockedBySafety}
          </div>
          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
            {metrics.blockedByLiquidity} liquidity, {metrics.blockedBySafety} safety
          </div>
        </div>
        
        {/* Avg LTV */}
        <div style={{
          padding: "16px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px"
        }}>
          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase" }}>
            Avg LTV
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
            {metrics.avgLTV ? `${(metrics.avgLTV * 100).toFixed(1)}%` : "—"}
          </div>
          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
            {metrics.avgLTV ? "Weighted average" : "No data"}
          </div>
        </div>
      </div>
    </div>
  );
}

