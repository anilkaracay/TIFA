"use client";

import React, { useState } from "react";
import { Invoice } from "../../lib/backendClient";
import { X402PaymentRequest, confirmX402Payment } from "../../lib/x402Client";
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
    summary: {
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "4px",
        padding: "20px",
        fontSize: "13px",
        color: "#6b7280",
        lineHeight: "1.6",
    },
    form: {
        display: "flex",
        flexDirection: "column" as "column",
        gap: "20px",
    },
    formGroup: {
        display: "flex",
        flexDirection: "column" as "column",
        gap: "8px",
    },
    label: {
        fontSize: "13px",
        fontWeight: 600,
        color: "#111827",
    },
    input: {
        padding: "10px 14px",
        borderRadius: "4px",
        border: "1px solid #d1d5db",
        fontSize: "14px",
        color: "#111827",
        background: "#ffffff",
        transition: "all 0.15s ease",
        fontFamily: "ui-monospace, monospace",
    },
    inputFocus: {
        outline: "none",
        borderColor: "#475569",
        boxShadow: "0 0 0 3px rgba(71, 85, 105, 0.1)",
    },
    inputError: {
        borderColor: "#dc2626",
    },
    errorMessage: {
        fontSize: "12px",
        color: "#dc2626",
        marginTop: "4px",
    },
    helpText: {
        fontSize: "12px",
        color: "#9ca3af",
        marginTop: "4px",
    },
    actionButtons: {
        display: "flex",
        gap: "12px",
        justifyContent: "flex-end",
    },
    cancelButton: {
        padding: "10px 20px",
        borderRadius: "4px",
        border: "1px solid #d1d5db",
        background: "#ffffff",
        color: "#6b7280",
        fontSize: "13px",
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.15s ease",
    },
    confirmButton: {
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
    confirmButtonDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
    },
    loading: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    spinner: {
        width: "14px",
        height: "14px",
        border: "2px solid rgba(255, 255, 255, 0.3)",
        borderTopColor: "#ffffff",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
    },
};

interface PaymentConfirmationProps {
    invoice: Invoice;
    paymentRequest: X402PaymentRequest;
    onPaymentConfirmed: (result: any) => void;
    onBack: () => void;
}

export default function PaymentConfirmation({
    invoice,
    paymentRequest,
    onPaymentConfirmed,
    onBack,
}: PaymentConfirmationProps) {
    const [txHash, setTxHash] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { showToast } = useToast();

    const validateTxHash = (hash: string): boolean => {
        if (!hash) return false;
        return /^0x[a-fA-F0-9]{64}$/.test(hash);
    };

    const handleTxHashChange = (value: string) => {
        setTxHash(value);
        setError("");

        if (value && !validateTxHash(value)) {
            setError("Invalid transaction hash format. Must be 0x followed by 64 hex characters.");
        }
    };

    const handleConfirm = async () => {
        if (!txHash) {
            setError("Please enter a transaction hash");
            return;
        }

        if (!validateTxHash(txHash)) {
            setError("Invalid transaction hash format");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const result = await confirmX402Payment(invoice.id, {
                sessionId: paymentRequest.sessionId,
                txHash: txHash.trim(),
            });

            showToast("success", "Payment confirmed successfully");
            onPaymentConfirmed(result);
        } catch (error: any) {
            console.error("Payment confirmation error:", error);
            setError(error.message || "Failed to confirm payment. Please check your transaction hash.");
            showToast("error", error.message || "Failed to confirm payment");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>Confirm On-Chain Payment</h2>
                <button style={styles.backButton} onClick={onBack} disabled={isLoading}>
                    ← Back
                </button>
            </div>

            <div style={styles.summary}>
                <strong>Payment Summary:</strong>
                <br />
                Amount: {paymentRequest.payment.amount} {paymentRequest.payment.currency}
                <br />
                Invoice: {invoice.externalId}
                <br />
                Session ID: {paymentRequest.sessionId}
            </div>

            <div style={styles.form}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Transaction Hash</label>
                    <input
                        type="text"
                        placeholder="0x..."
                        value={txHash}
                        onChange={(e) => handleTxHashChange(e.target.value)}
                        style={{
                            ...styles.input,
                            ...(error ? styles.inputError : {}),
                        }}
                        onFocus={(e) => {
                            Object.assign(e.target.style, styles.inputFocus);
                        }}
                        onBlur={(e) => {
                            if (!error) {
                                e.target.style.borderColor = "#d1d5db";
                                e.target.style.boxShadow = "none";
                            }
                        }}
                        disabled={isLoading}
                    />
                    {error && <div style={styles.errorMessage}>{error}</div>}
                    {!error && (
                        <div style={styles.helpText}>
                            Enter the transaction hash from your payment transaction on {paymentRequest.payment.chain}
                        </div>
                    )}
                </div>
            </div>

            <div style={styles.actionButtons}>
                <button style={styles.cancelButton} onClick={onBack} disabled={isLoading}>
                    Cancel
                </button>
                <button
                    style={{
                        ...styles.confirmButton,
                        ...(isLoading || !txHash || !!error ? styles.confirmButtonDisabled : {}),
                    }}
                    onClick={handleConfirm}
                    disabled={isLoading || !txHash || !!error}
                >
                    {isLoading ? (
                        <div style={styles.loading}>
                            <div style={styles.spinner} />
                            Verifying...
                        </div>
                    ) : (
                        "Verify and Settle"
                    )}
                </button>
            </div>
        </div>
    );
}
