"use client";

import React from "react";

export interface KpiItem {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: "up" | "down" | "flat";
  valueColor?: string;
  valueFontSize?: string;
}

interface KpiStripProps {
  items: KpiItem[];
}

// Format large numbers with K/M suffixes
function formatValue(value: string | number): string {
  if (typeof value === "string") return value;

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export default function KpiStrip({ items }: KpiStripProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(items.length, 5)}, 1fr)`,
        gap: "12px",
        marginTop: "24px",
        paddingTop: "24px",
        borderTop: "1px solid #f1f5f9",
        minWidth: 0,
      }}
      role="list"
      aria-label="Key Performance Indicators"
    >
      {items.map((item, idx) => (
        <div
          key={idx}
          role="listitem"
          aria-label={`${item.label}: ${item.value}${item.subtext ? `, ${item.subtext}` : ''}`}
          style={{
            padding: "16px",
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "100px",
            minWidth: 0,
            overflow: "hidden",
            position: "relative",
          }}
          className="kpi-card"
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.05)";
            e.currentTarget.style.borderColor = "#cbd5e1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.03)";
            e.currentTarget.style.borderColor = "#e2e8f0";
          }}
        >
          <div>
            {/* Label */}
            <div
              style={{
                fontSize: "11px",
                color: "#64748b",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "8px",
              }}
            >
              {item.label}
            </div>

            {/* Value */}
            <div
              style={{
                fontSize: item.valueFontSize || "24px",
                fontWeight: 700,
                color: item.valueColor || "#0f172a",
                marginBottom: "2px",
                letterSpacing: "-0.5px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                animation: "valueChange 0.3s ease-out",
              }}
            >
              {formatValue(item.value)}
            </div>
          </div>

          {/* Bottom section with subtext and trend */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "4px",
              minHeight: "20px",
            }}
          >
            {item.subtext && (
              <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                {item.subtext}
              </div>
            )}

            {item.trend && (
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                  marginLeft: "auto",
                }}
              >
                {item.trend === "up" && (
                  <span
                    style={{
                      color: "#ef4444",
                      background: "#fef2f2",
                      padding: "3px 8px",
                      borderRadius: "10px",
                      fontSize: "11px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M5 2L8 6H2L5 2Z"
                        fill="currentColor"
                      />
                    </svg>
                    High
                  </span>
                )}
                {item.trend === "down" && (
                  <span
                    style={{
                      color: "#10b981",
                      background: "#f0fdf4",
                      padding: "3px 8px",
                      borderRadius: "10px",
                      fontSize: "11px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M5 8L2 4H8L5 8Z"
                        fill="currentColor"
                      />
                    </svg>
                    Low
                  </span>
                )}
                {item.trend === "flat" && (
                  <span
                    style={{
                      color: "#64748b",
                      background: "#f8fafc",
                      padding: "3px 8px",
                      borderRadius: "10px",
                      fontSize: "11px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5H8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    Stable
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      <style jsx>{`
        @keyframes valueChange {
          0% {
            opacity: 0.7;
            transform: scale(0.98);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @media (max-width: 768px) {
          .kpi-card {
            min-height: 80px !important;
          }
        }
      `}</style>
    </div>
  );
}






