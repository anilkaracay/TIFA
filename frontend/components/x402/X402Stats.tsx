"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { fetchX402Stats } from "../../lib/x402Client";
import { formatAmount } from "../../lib/format";

const styles = {
    statsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "16px",
        marginBottom: "40px",
    },
    statCard: {
        background: "#ffffff",
        borderRadius: "6px",
        border: "1px solid #e5e7eb",
        padding: "24px",
        position: "relative" as "relative",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
    },
    statLabel: {
        fontSize: "11px",
        color: "#9ca3af",
        fontWeight: 500,
        marginBottom: "12px",
        textTransform: "uppercase" as "uppercase",
        letterSpacing: "0.05em",
    },
    statValue: {
        fontSize: "32px",
        fontWeight: 600,
        color: "#111827",
        marginBottom: "4px",
        lineHeight: "1.2",
        fontFeatureSettings: '"tnum"',
    },
    statHelper: {
        fontSize: "12px",
        color: "#9ca3af",
        fontWeight: 400,
    },
    loading: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "16px",
        marginBottom: "40px",
    },
    loadingCard: {
        background: "#ffffff",
        borderRadius: "6px",
        border: "1px solid #e5e7eb",
        padding: "24px",
        height: "110px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#9ca3af",
        fontSize: "13px",
    },
};

export default function X402Stats() {
    const { data: stats, error, isLoading } = useSWR("x402-stats", fetchX402Stats, {
        refreshInterval: 30000,
    });
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 1024);
        };
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    if (isLoading) {
        return (
            <div style={styles.loading}>
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={styles.loadingCard}>
                        Loading...
                    </div>
                ))}
            </div>
        );
    }

    if (error || !stats) {
        return null;
    }

    const gridStyle = {
        ...styles.statsGrid,
        ...(typeof window !== "undefined" && window.innerWidth <= 640
            ? { gridTemplateColumns: "1fr" }
            : isMobile
            ? { gridTemplateColumns: "repeat(2, 1fr)" }
            : {}),
    };

    return (
        <div style={gridStyle}>
            <div style={styles.statCard}>
                <div style={styles.statLabel}>Total Payments</div>
                <div style={styles.statValue}>{stats.totalPayments || 0}</div>
                <div style={styles.statHelper}>All time</div>
            </div>

            <div style={styles.statCard}>
                <div style={styles.statLabel}>Active Sessions</div>
                <div style={styles.statValue}>{stats.activeSessions || 0}</div>
                <div style={styles.statHelper}>Pending confirmation</div>
            </div>

            <div style={styles.statCard}>
                <div style={styles.statLabel}>Success Rate</div>
                <div style={styles.statValue}>
                    {stats.totalPayments > 0
                        ? `${Math.round((stats.confirmedPayments / stats.totalPayments) * 100)}%`
                        : "0%"}
                </div>
                <div style={styles.statHelper}>
                    {stats.confirmedPayments || 0} of {stats.totalPayments || 0} confirmed
                </div>
            </div>

            <div style={styles.statCard}>
                <div style={styles.statLabel}>Total Volume</div>
                <div style={styles.statValue}>
                    {stats.totalVolume ? formatAmount(stats.totalVolume, "USDC") : "$0"}
                </div>
                <div style={styles.statHelper}>All payments</div>
            </div>
        </div>
    );
}
