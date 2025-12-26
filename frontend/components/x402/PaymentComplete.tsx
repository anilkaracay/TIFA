"use client";

import React from "react";
import Link from "next/link";
import { Invoice } from "../../lib/backendClient";
import { formatAmount } from "../../lib/format";

const styles = {
    container: {
        display: "flex",
        flexDirection: "column" as "column",
        alignItems: "flex-start",
        gap: "32px",
    },
    successHeader: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    successIcon: {
        width: "24px",
        height: "24px",
        borderRadius: "50%",
        background: "#111827",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        color: "#ffffff",
        fontWeight: 600,
    },
    successTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#111827",
    },
    detailsCard: {
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "4px",
        padding: "24px",
        width: "100%",
        maxWidth: "600px",
    },
    detailRow: {
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: "16px",
        padding: "10px 0",
        fontSize: "13px",
        borderBottom: "1px solid #e5e7eb",
    },
    detailRowLast: {
        borderBottom: "none",
    },
    detailLabel: {
        color: "#6b7280",
        fontWeight: 500,
    },
    detailValue: {
        color: "#111827",
        fontWeight: 400,
        fontFamily: "ui-monospace, monospace",
        wordBreak: "break-all" as "break-all",
    },
    statusBadge: {
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "3px",
        fontSize: "11px",
        fontWeight: 500,
        textTransform: "uppercase" as "uppercase",
        letterSpacing: "0.05em",
        background: "#f3f4f6",
        color: "#374151",
    },
    actionButtons: {
        display: "flex",
        gap: "12px",
        flexWrap: "wrap" as "wrap",
    },
    button: {
        padding: "10px 20px",
        borderRadius: "4px",
        fontSize: "13px",
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.15s ease",
        textDecoration: "none",
        display: "inline-block",
    },
    primaryButton: {
        background: "#111827",
        color: "#ffffff",
        border: "none",
    },
    secondaryButton: {
        background: "#ffffff",
        color: "#6b7280",
        border: "1px solid #d1d5db",
    },
};

interface PaymentCompleteProps {
    result: any;
    invoice: Invoice;
    onStartOver: () => void;
}

export default function PaymentComplete({ result, invoice, onStartOver }: PaymentCompleteProps) {
    return (
        <div style={styles.container}>
            <div style={styles.successHeader}>
                <div style={styles.successIcon}>✓</div>
                <h2 style={styles.successTitle}>Payment Confirmed</h2>
            </div>

            <div style={styles.detailsCard}>
                <div style={styles.detailRow}>
                    <div style={styles.detailLabel}>Invoice</div>
                    <div style={styles.detailValue}>{invoice.externalId}</div>
                </div>
                <div style={styles.detailRow}>
                    <div style={styles.detailLabel}>Amount Paid</div>
                    <div style={styles.detailValue}>
                        {formatAmount(result.payment?.amount || result.session?.amountRequested, invoice.currency)}
                    </div>
                </div>
                <div style={styles.detailRow}>
                    <div style={styles.detailLabel}>Transaction Hash</div>
                    <div style={styles.detailValue}>{result.session?.txHash || result.payment?.txHash || "N/A"}</div>
                </div>
                <div style={styles.detailRow}>
                    <div style={styles.detailLabel}>Invoice Status</div>
                    <div>
                        <span style={styles.statusBadge}>{result.invoice?.status || invoice.status}</span>
                    </div>
                </div>
                <div style={{ ...styles.detailRow, ...styles.detailRowLast }}>
                    <div style={styles.detailLabel}>Cumulative Paid</div>
                    <div style={styles.detailValue}>
                        {formatAmount(result.invoice?.cumulativePaid || invoice.cumulativePaid, invoice.currency)}
                    </div>
                </div>
            </div>

            <div style={styles.actionButtons}>
                <Link href={`/invoices/${invoice.id}`} style={{ ...styles.button, ...styles.secondaryButton }}>
                    View Invoice Details
                </Link>
                <button style={{ ...styles.button, ...styles.primaryButton }} onClick={onStartOver}>
                    Pay Another Invoice
                </button>
            </div>
        </div>
    );
}
