"use client";

import React from "react";
import useSWR from "swr";
import Link from "next/link";
import { fetchX402History, X402PaymentHistoryItem } from "../../lib/x402Client";
import { formatAmount, formatDate } from "../../lib/format";

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
    historyList: {
        display: "flex",
        flexDirection: "column" as "column",
        maxHeight: "400px",
        overflowY: "auto" as "auto",
    },
    historyItem: {
        padding: "14px 20px",
        borderBottom: "1px solid #f3f4f6",
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        gap: "16px",
        alignItems: "center",
    },
    historyItemLast: {
        borderBottom: "none",
    },
    historyLeft: {
        display: "flex",
        flexDirection: "column" as "column",
        gap: "4px",
        minWidth: 0,
    },
    invoiceLink: {
        fontSize: "12px",
        fontWeight: 600,
        color: "#111827",
        textDecoration: "none",
        fontFamily: "ui-monospace, monospace",
        wordBreak: "break-all" as "break-all",
    },
    historyDetails: {
        fontSize: "11px",
        color: "#9ca3af",
        display: "flex",
        gap: "8px",
        fontFeatureSettings: '"tnum"',
    },
    txHash: {
        fontFamily: "ui-monospace, monospace",
    },
    historyRight: {
        display: "flex",
        flexDirection: "column" as "column",
        alignItems: "flex-end",
        gap: "4px",
    },
    amount: {
        fontSize: "13px",
        fontWeight: 600,
        color: "#111827",
        fontFeatureSettings: '"tnum"',
    },
    statusBadge: {
        padding: "2px 8px",
        borderRadius: "3px",
        fontSize: "10px",
        fontWeight: 500,
        textTransform: "uppercase" as "uppercase",
        letterSpacing: "0.05em",
    },
    statusConfirmed: {
        background: "#f3f4f6",
        color: "#374151",
    },
    statusExpired: {
        background: "#fee2e2",
        color: "#991b1b",
    },
    statusPending: {
        background: "#fef3c7",
        color: "#92400e",
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

export default function PaymentHistory() {
    const { data: history, error, isLoading } = useSWR("x402-history", fetchX402History, {
        refreshInterval: 10000,
    });

    if (isLoading) {
        return (
            <div style={styles.card}>
                <div style={styles.header}>
                    <h3 style={styles.title}>Payment History</h3>
                </div>
                <div style={styles.loading}>Loading...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.card}>
                <div style={styles.header}>
                    <h3 style={styles.title}>Payment History</h3>
                </div>
                <div style={styles.empty}>Error loading history</div>
            </div>
        );
    }

    const recentHistory = history?.slice(0, 10) || [];

    const getStatusStyle = (status: string) => {
        if (status === "CONFIRMED") return styles.statusConfirmed;
        if (status === "EXPIRED") return styles.statusExpired;
        return styles.statusPending;
    };

    return (
        <div style={styles.card}>
            <div style={styles.header}>
                <h3 style={styles.title}>Payment History</h3>
            </div>

            {recentHistory.length === 0 ? (
                <div style={styles.empty}>No payment history</div>
            ) : (
                <div style={styles.historyList}>
                    {recentHistory.map((item: X402PaymentHistoryItem, index: number) => (
                        <div
                            key={item.sessionId}
                            style={{
                                ...styles.historyItem,
                                ...(index === recentHistory.length - 1 ? styles.historyItemLast : {}),
                            }}
                        >
                            <div style={styles.historyLeft}>
                                <Link href={`/invoices/${item.invoiceId}`} style={styles.invoiceLink}>
                                    {item.invoiceId.slice(0, 20)}...
                                </Link>
                                <div style={styles.historyDetails}>
                                    <span>{formatDate(item.createdAt)}</span>
                                    {item.executionMode === 'AGENT_AUTHORIZED' && (
                                        <span style={{ fontSize: "10px", color: "#6b7280" }}>Agent</span>
                                    )}
                                    {item.txHash && (
                                        <span style={styles.txHash} title={item.txHash}>
                                            {item.txHash.slice(0, 10)}...
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div style={styles.historyRight}>
                                <div style={styles.amount}>{formatAmount(item.amountRequested, item.currency)}</div>
                                <span style={{ ...styles.statusBadge, ...getStatusStyle(item.status) }}>
                                    {item.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
