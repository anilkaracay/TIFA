"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Invoice } from "../../lib/backendClient";
import { X402PaymentRequest } from "../../lib/x402Client";
import { formatAmount, formatDate } from "../../lib/format";
import { useToast } from "../Toast";

const styles = {
    container: {
        display: "flex",
        flexDirection: "column" as "column",
        gap: "32px",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "8px",
    },
    title: {
        fontSize: "16px",
        fontWeight: 600,
        color: "#111827",
    },
    backButton: {
        padding: "6px 12px",
        borderRadius: "4px",
        border: "1px solid #d1d5db",
        background: "#ffffff",
        color: "#6b7280",
        fontSize: "13px",
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.15s ease",
    },
    invoiceSummary: {
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "4px",
        padding: "20px",
    },
    summaryRow: {
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: "16px",
        padding: "8px 0",
        fontSize: "13px",
    },
    summaryLabel: {
        color: "#6b7280",
        fontWeight: 500,
    },
    summaryValue: {
        color: "#111827",
        fontWeight: 400,
        fontFamily: "ui-monospace, monospace",
    },
    paymentRequest: {
        background: "#1f2937",
        border: "1px solid #374151",
        borderRadius: "4px",
        padding: "24px",
        marginTop: "8px",
    },
    paymentRequestTitle: {
        fontSize: "12px",
        fontWeight: 600,
        color: "#9ca3af",
        textTransform: "uppercase" as "uppercase",
        letterSpacing: "0.05em",
        marginBottom: "16px",
    },
    paymentRequestRow: {
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: "16px",
        padding: "10px 0",
        fontSize: "13px",
        borderBottom: "1px solid #374151",
    },
    paymentRequestRowLast: {
        borderBottom: "none",
    },
    paymentRequestLabel: {
        color: "#9ca3af",
        fontWeight: 500,
    },
    paymentRequestValue: {
        color: "#f9fafb",
        fontWeight: 400,
        fontFamily: "ui-monospace, monospace",
        wordBreak: "break-all" as "break-all",
    },
    copyButton: {
        padding: "2px 8px",
        borderRadius: "3px",
        border: "1px solid #4b5563",
        background: "transparent",
        color: "#9ca3af",
        fontSize: "11px",
        cursor: "pointer",
        marginLeft: "8px",
        transition: "all 0.15s ease",
    },
    actionButtons: {
        display: "flex",
        gap: "12px",
        justifyContent: "flex-end",
        marginTop: "24px",
    },
    proceedButton: {
        padding: "10px 20px",
        borderRadius: "4px",
        background: "#111827",
        color: "#ffffff",
        border: "none",
        fontSize: "13px",
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.15s ease",
    },
    proceedButtonHover: {
        background: "#374151",
    },
};

interface PaymentRequestProps {
    invoice: Invoice;
    paymentRequest: X402PaymentRequest;
    onPaymentSent: () => void;
    onBack: () => void;
}

export default function PaymentRequest({ invoice, paymentRequest, onPaymentSent, onBack }: PaymentRequestProps) {
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const { showToast } = useToast();

    useEffect(() => {
        const expiresAt = new Date(paymentRequest.expiresAt).getTime();
        const updateCountdown = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
            setTimeRemaining(remaining);
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [paymentRequest.expiresAt]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        showToast("success", `${label} copied`);
    };

    const qrData = JSON.stringify({
        address: paymentRequest.payment.recipient,
        amount: paymentRequest.payment.amount,
        currency: paymentRequest.payment.currency,
        chain: paymentRequest.payment.chain,
        reference: paymentRequest.payment.reference,
    });

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>Payment Details</h2>
                <button style={styles.backButton} onClick={onBack}>
                    ← Back
                </button>
            </div>

            {/* Invoice Summary */}
            <div style={styles.invoiceSummary}>
                <div style={styles.summaryRow}>
                    <div style={styles.summaryLabel}>Invoice ID</div>
                    <div style={styles.summaryValue}>{invoice.externalId}</div>
                </div>
                <div style={styles.summaryRow}>
                    <div style={styles.summaryLabel}>Company</div>
                    <div style={styles.summaryValue}>{invoice.companyId}</div>
                </div>
                <div style={styles.summaryRow}>
                    <div style={styles.summaryLabel}>Due Date</div>
                    <div style={styles.summaryValue}>{formatDate(invoice.dueDate)}</div>
                </div>
                <div style={styles.summaryRow}>
                    <div style={styles.summaryLabel}>Payment Amount</div>
                    <div style={styles.summaryValue}>
                        {formatAmount(paymentRequest.payment.amount, paymentRequest.payment.currency)}
                    </div>
                </div>
            </div>

            {/* x402 Payment Request */}
            <div>
                <div style={styles.paymentRequestTitle}>x402 Payment Request</div>
                <div style={styles.paymentRequest}>
                    <div style={styles.paymentRequestRow}>
                        <div style={styles.paymentRequestLabel}>Amount</div>
                        <div style={styles.paymentRequestValue}>
                            {paymentRequest.payment.amount} {paymentRequest.payment.currency}
                        </div>
                    </div>
                    <div style={styles.paymentRequestRow}>
                        <div style={styles.paymentRequestLabel}>Network</div>
                        <div style={styles.paymentRequestValue}>{paymentRequest.payment.chain}</div>
                    </div>
                    <div style={styles.paymentRequestRow}>
                        <div style={styles.paymentRequestLabel}>Settlement Address</div>
                        <div style={styles.paymentRequestValue}>
                            {paymentRequest.payment.recipient}
                            <button
                                style={styles.copyButton}
                                onClick={() => copyToClipboard(paymentRequest.payment.recipient, "Address")}
                            >
                                Copy
                            </button>
                        </div>
                    </div>
                    <div style={{ ...styles.paymentRequestRow, ...styles.paymentRequestRowLast }}>
                        <div style={styles.paymentRequestLabel}>Session Expiry</div>
                        <div style={styles.paymentRequestValue}>
                            {timeRemaining > 0 ? formatTime(timeRemaining) : "Expired"}
                        </div>
                    </div>
                </div>
            </div>

            <div style={styles.actionButtons}>
                <button style={styles.proceedButton} onClick={onPaymentSent}>
                    I've Sent Payment →
                </button>
            </div>
        </div>
    );
}
