"use client";

import React from "react";

interface LiveBadgeProps {
  isLive: boolean;
  lastUpdated?: Date;
}

export default function LiveBadge({ isLive, lastUpdated }: LiveBadgeProps) {
  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px", fontFamily: "inherit" }}>
      {isLive && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>


          {/* Live Indicator - Clean Text */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ position: "relative", width: "6px", height: "6px" }}>
              <div style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                background: "#10b981",
                borderRadius: "50%",
                opacity: 0.6,
                animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite"
              }} />
              <div style={{
                position: "relative",
                width: "6px",
                height: "6px",
                background: "#10b981",
                borderRadius: "50%"
              }} />
            </div>
            <span style={{
              color: "#10b981",
              fontWeight: 600,
              fontSize: "13px",
              letterSpacing: "-0.01em"
            }}>
              Live
            </span>
          </div>
        </div>
      )}

      {/* Updated Time */}
      {lastUpdated && (
        <span style={{
          color: "#94a3b8",
          fontSize: "12px",
          fontWeight: 400,
          marginLeft: "auto"
        }}>
          Updated {formatTime(lastUpdated)}
        </span>
      )}

      <style jsx>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

