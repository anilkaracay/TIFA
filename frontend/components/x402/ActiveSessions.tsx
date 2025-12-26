"use client";

import React from "react";
import useSWR from "swr";
import { fetchX402Sessions, X402Session } from "../../lib/x402Client";
import { formatAmount } from "../../lib/format";

const styles = {
    card: {
        background: "#ffffff",
        borderRadius: "6px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
        padding: "0",
        overflow: "hidden" as "hidden",
    },
    header: {
        background: "#f9fafb",
        borderBottom: "1px solid #e5e7eb",
        padding: "16px 20px",
    },
    title: {
        fontSize: "13px",
        fontWeight: 600,
        color: "#111827",
        textTransform: "uppercase" as "uppercase",
        letterSpacing: "0.05em",
    },
    sessionList: {
        display: "flex",
        flexDirection: "column" as "column",
    },
    sessionItem: {
        padding: "16px 20px",
        borderBottom: "1px solid #f3f4f6",
        display: "flex",
        flexDirection: "column" as "column",
        gap: "8px",
    },
    sessionItemLast: {
        borderBottom: "none",
    },
    sessionHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    invoiceId: {
        fontSize: "12px",
        fontWeight: 600,
        color: "#111827",
        fontFamily: "ui-monospace, monospace",
        wordBreak: "break-all" as "break-all",
    },
    statusBadge: {
        padding: "2px 8px",
        borderRadius: "3px",
        fontSize: "10px",
        fontWeight: 500,
        textTransform: "uppercase" as "uppercase",
        letterSpacing: "0.05em",
        background: "#fef3c7",
        color: "#92400e",
    },
    sessionDetails: {
        fontSize: "12px",
        color: "#6b7280",
        display: "flex",
        flexDirection: "column" as "column",
        gap: "4px",
        fontFeatureSettings: '"tnum"',
    },
    empty: {
        textAlign: "center" as "center",
        padding: "48px 20px",
        color: "#9ca3af",
        fontSize: "13px",
    },
    loading: {
        textAlign: "center" as "center",
        padding: "48px 20px",
        color: "#9ca3af",
        fontSize: "13px",
    },
};

export default function ActiveSessions() {
    const { data: sessions, error, isLoading } = useSWR("x402-sessions", fetchX402Sessions, {
        refreshInterval: 5000,
    });

    if (isLoading) {
        return (
            <div style={styles.card}>
                <div style={styles.header}>
                    <h3 style={styles.title}>Active x402 Sessions</h3>
                </div>
                <div style={styles.loading}>Loading...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.card}>
                <div style={styles.header}>
                    <h3 style={styles.title}>Active x402 Sessions</h3>
                </div>
                <div style={styles.empty}>Error loading sessions</div>
            </div>
        );
    }

    const pendingSessions = sessions?.filter((s: X402Session) => s.status === "PENDING") || [];

    return (
        <div style={styles.card}>
            <div style={styles.header}>
                <h3 style={styles.title}>Active x402 Sessions</h3>
            </div>

            {pendingSessions.length === 0 ? (
                <div style={styles.empty}>No active payment sessions</div>
            ) : (
                <div style={styles.sessionList}>
                    {pendingSessions.map((session: X402Session, index: number) => {
                        const expiresAt = new Date(session.expiresAt);
                        const now = new Date();
                        const minutesRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 60000));

                        return (
                            <div
                                key={session.sessionId}
                                style={{
                                    ...styles.sessionItem,
                                    ...(index === pendingSessions.length - 1 ? styles.sessionItemLast : {}),
                                }}
                            >
                                <div style={styles.sessionHeader}>
                                    <div style={styles.invoiceId}>{session.invoiceId.slice(0, 24)}...</div>
                                    <span style={styles.statusBadge}>Pending</span>
                                </div>
                                <div style={styles.sessionDetails}>
                                    <span>
                                        {formatAmount(session.amountRequested, session.currency)} • {session.chain}
                                    </span>
                                    <span>Expires in {minutesRemaining} min</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
