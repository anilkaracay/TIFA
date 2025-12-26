"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { fetchInvoices, Invoice } from "../../lib/backendClient";
import { requestX402Payment, X402PaymentRequest } from "../../lib/x402Client";
import { formatAmount, formatDate } from "../../lib/format";
import { useToast } from "../Toast";

const styles = {
    container: {
        display: "flex",
        flexDirection: "column" as "column",
        gap: "24px",
    },
    header: {
        marginBottom: "8px",
    },
    title: {
        fontSize: "16px",
        fontWeight: 600,
        color: "#111827",
        marginBottom: "4px",
    },
    searchBox: {
        width: "100%",
        padding: "10px 14px",
        borderRadius: "4px",
        border: "1px solid #d1d5db",
        fontSize: "14px",
        color: "#111827",
        background: "#ffffff",
        transition: "all 0.15s ease",
        fontFamily: "inherit",
    },
    searchBoxFocus: {
        outline: "none",
        borderColor: "#475569",
        boxShadow: "0 0 0 3px rgba(71, 85, 105, 0.1)",
    },
    invoiceList: {
        display: "flex",
        flexDirection: "column" as "column",
        gap: "0",
        border: "1px solid #e5e7eb",
        borderRadius: "4px",
        overflow: "hidden" as "hidden",
        background: "#ffffff",
    },
    invoiceRow: {
        padding: "16px 20px",
        borderBottom: "1px solid #f3f4f6",
        display: "grid",
        gridTemplateColumns: "2fr 2fr 1fr auto",
        gap: "20px",
        alignItems: "center",
        transition: "background-color 0.15s ease",
        cursor: "pointer",
    },
    invoiceRowHover: {
        background: "#f9fafb",
    },
    invoiceRowLast: {
        borderBottom: "none",
    },
    invoiceLeft: {
        display: "flex",
        flexDirection: "column" as "column",
        gap: "6px",
    },
    invoiceId: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#111827",
        fontFamily: "ui-monospace, monospace",
    },
    statusBadge: {
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "3px",
        fontSize: "11px",
        fontWeight: 500,
        textTransform: "uppercase" as "uppercase",
        letterSpacing: "0.05em",
    },
    statusFinanced: {
        background: "#f3f4f6",
        color: "#374151",
    },
    statusTokenized: {
        background: "#f3f4f6",
        color: "#374151",
    },
    statusPartiallyPaid: {
        background: "#fef3c7",
        color: "#92400e",
    },
    invoiceMiddle: {
        display: "flex",
        flexDirection: "column" as "column",
        gap: "4px",
        fontSize: "13px",
        color: "#6b7280",
    },
    invoiceRight: {
        display: "flex",
        flexDirection: "column" as "column",
        alignItems: "flex-end",
        gap: "4px",
    },
    amountTotal: {
        fontSize: "15px",
        fontWeight: 600,
        color: "#111827",
        fontFeatureSettings: '"tnum"',
    },
    amountRemaining: {
        fontSize: "12px",
        color: "#9ca3af",
        fontFeatureSettings: '"tnum"',
    },
    selectButton: {
        padding: "6px 16px",
        borderRadius: "4px",
        background: "#111827",
        color: "#ffffff",
        border: "none",
        fontSize: "13px",
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap" as "nowrap",
    },
    selectButtonHover: {
        background: "#374151",
    },
    selectButtonDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
    },
    loading: {
        textAlign: "center" as "center",
        padding: "60px 20px",
        color: "#9ca3af",
        fontSize: "14px",
    },
    empty: {
        textAlign: "center" as "center",
        padding: "60px 20px",
        color: "#9ca3af",
        fontSize: "14px",
    },
};

interface InvoiceSelectorProps {
    onInvoiceSelect: (invoice: Invoice) => void;
    onPaymentRequested: (request: X402PaymentRequest) => void;
}

export default function InvoiceSelector({ onInvoiceSelect, onPaymentRequested }: InvoiceSelectorProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [hoveredInvoice, setHoveredInvoice] = useState<string | null>(null);
    const [loadingInvoice, setLoadingInvoice] = useState<string | null>(null);
    const { showToast } = useToast();

    const { data: invoices, error, isLoading } = useSWR(
        "payable-invoices",
        async () => {
            const allInvoices = await fetchInvoices({ status: "all" });
            return allInvoices.filter(
                (inv: Invoice) =>
                    ["TOKENIZED", "FINANCED", "PARTIALLY_PAID"].includes(inv.status) &&
                    BigInt(inv.amount) > BigInt(inv.cumulativePaid || "0")
            );
        },
        { refreshInterval: 10000 }
    );

    const filteredInvoices = useMemo(() => {
        if (!invoices) return [];
        if (!searchQuery) return invoices;

        const query = searchQuery.toLowerCase();
        return invoices.filter(
            (inv: Invoice) =>
                inv.id.toLowerCase().includes(query) ||
                inv.externalId.toLowerCase().includes(query) ||
                inv.companyId.toLowerCase().includes(query)
        );
    }, [invoices, searchQuery]);

    const handleSelectInvoice = async (invoice: Invoice) => {
        setLoadingInvoice(invoice.id);
        try {
            const paymentRequest = await requestX402Payment(invoice.id);
            if ("x402" in paymentRequest && paymentRequest.x402 === true) {
                onPaymentRequested(paymentRequest as X402PaymentRequest);
                onInvoiceSelect(invoice);
            } else {
                const msg = (paymentRequest as any).message || "Failed to create payment request";
                showToast("error", msg);
            }
        } catch (error: any) {
            console.error("Error requesting payment:", error);
            showToast("error", error.message || "Failed to request payment");
        } finally {
            setLoadingInvoice(null);
        }
    };

    const getStatusStyle = (status: string) => {
        if (status === "FINANCED") return styles.statusFinanced;
        if (status === "TOKENIZED") return styles.statusTokenized;
        if (status === "PARTIALLY_PAID") return styles.statusPartiallyPaid;
        return styles.statusFinanced;
    };

    if (isLoading) {
        return <div style={styles.loading}>Loading payable invoices...</div>;
    }

    if (error) {
        return <div style={styles.empty}>Error loading invoices. Please try again.</div>;
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>Select Invoice to Pay</h2>
            </div>

            <input
                type="text"
                placeholder="Search by invoice ID, external reference, or company"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchBox}
                onFocus={(e) => {
                    Object.assign(e.target.style, styles.searchBoxFocus);
                }}
                onBlur={(e) => {
                    e.target.style.borderColor = "#d1d5db";
                    e.target.style.boxShadow = "none";
                }}
            />

            {filteredInvoices.length === 0 ? (
                <div style={styles.empty}>
                    {searchQuery ? "No invoices found matching your search." : "No payable invoices available."}
                </div>
            ) : (
                <div style={styles.invoiceList}>
                    {filteredInvoices.map((invoice: Invoice, index: number) => {
                        const remaining = BigInt(invoice.amount) - BigInt(invoice.cumulativePaid || "0");
                        const isHovered = hoveredInvoice === invoice.id;
                        const isLoading = loadingInvoice === invoice.id;

                        return (
                            <div
                                key={invoice.id}
                                style={{
                                    ...styles.invoiceRow,
                                    ...(isHovered ? styles.invoiceRowHover : {}),
                                    ...(index === filteredInvoices.length - 1 ? styles.invoiceRowLast : {}),
                                }}
                                onMouseEnter={() => setHoveredInvoice(invoice.id)}
                                onMouseLeave={() => setHoveredInvoice(null)}
                            >
                                <div style={styles.invoiceLeft}>
                                    <div style={styles.invoiceId}>{invoice.externalId}</div>
                                    <span style={{ ...styles.statusBadge, ...getStatusStyle(invoice.status) }}>
                                        {invoice.status}
                                    </span>
                                </div>

                                <div style={styles.invoiceMiddle}>
                                    <span>Due: {formatDate(invoice.dueDate)}</span>
                                    <span>{invoice.companyId}</span>
                                </div>

                                <div style={styles.invoiceRight}>
                                    <div style={styles.amountTotal}>
                                        {formatAmount(invoice.amount, invoice.currency)}
                                    </div>
                                    {remaining > BigInt(0) && (
                                        <div style={styles.amountRemaining}>
                                            Remaining: {formatAmount(remaining.toString(), invoice.currency)}
                                        </div>
                                    )}
                                </div>

                                <button
                                    style={{
                                        ...styles.selectButton,
                                        ...(isHovered ? styles.selectButtonHover : {}),
                                        ...(isLoading ? styles.selectButtonDisabled : {}),
                                    }}
                                    onClick={() => handleSelectInvoice(invoice)}
                                    disabled={isLoading}
                                >
                                    {isLoading ? "Loading..." : "Select"}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
