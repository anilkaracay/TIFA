"use client";

import React from "react";

export default function CardBackgroundOverlay() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        borderRadius: "8px",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      {/* Subtle gradient wash */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "radial-gradient(circle at top left, rgba(59, 130, 246, 0.03) 0%, transparent 50%), radial-gradient(circle at top right, rgba(99, 102, 241, 0.03) 0%, transparent 50%), radial-gradient(circle at bottom right, rgba(139, 92, 246, 0.03) 0%, transparent 50%)",
        }}
      />
      
      {/* Ultra subtle grain */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSBiYXNlRnJlcXVlbmN5PSIwLjkiIG51bU9jdGF2ZXM9IjQiLz48L2ZpbHRlcj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbHRlcj0idXJsKCNub2lzZSkiIG9wYWNpdHk9IjAuMDMiLz48L3N2Zz4=')",
          opacity: 0.3,
        }}
      />
      
      {/* Signal routing overlay (ghost lines) */}
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", top: 0, left: 0 }}
        opacity="0.15"
      >
        {/* Corner nodes */}
        <circle cx="20" cy="20" r="2" fill="#2563eb" />
        <circle cx="calc(100% - 20)" cy="20" r="2" fill="#6366f1" />
        <circle cx="20" cy="calc(100% - 20)" r="2" fill="#8b5cf6" />
        <circle cx="calc(100% - 20)" cy="calc(100% - 20)" r="2" fill="#6366f1" />
        
        {/* Thin connecting lines */}
        <line x1="20" y1="20" x2="calc(100% - 20)" y2="20" stroke="#2563eb" strokeWidth="0.5" />
        <line
          x1="calc(100% - 20)"
          y1="20"
          x2="calc(100% - 20)"
          y2="calc(100% - 20)"
          stroke="#6366f1"
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
}


