"use client";

import type React from "react";
import { useState } from "react";
import useSWR from "swr";
import { fetchInvoices, tokenizeInvoice, requestFinancing, Invoice } from "../lib/backendClient";
import { formatAmount, formatDate, statusColor } from "../lib/format";

const fetcher = () => fetchInvoices();

export default function HomePage() {
    const { data, error, isLoading, mutate } = useSWR<Invoice[]>("invoices", fetcher, {
        revalidateOnFocus: true,
        refreshInterval: 15000,
    });

    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    async function handleTokenize(inv: Invoice) {
        try {
            setActionLoadingId(inv.id);
            setMessage(null);
            const res = await tokenizeInvoice(inv.id);
            setMessage(`Invoice ${inv.externalId} tokenized. Tx: ${res.txHash ?? "N/A"}`);
            await mutate();
        } catch (e: any) {
            console.error(e);
            setMessage(e?.message ?? "Tokenization failed");
        } finally {
            setActionLoadingId(null);
        }
    }

    async function handleFinance(inv: Invoice) {
        try {
            setActionLoadingId(inv.id);
            setMessage(null);
            const res = await requestFinancing(inv.id);
            setMessage(`Financing requested for ${inv.externalId}. Tx: ${res.txHash ?? "N/A"}`);
            await mutate();
        } catch (e: any) {
            console.error(e);
            setMessage(e?.message ?? "Financing failed");
        } finally {
            setActionLoadingId(null);
        }
    }

    return (
        <main style={{ minHeight: "100vh", background: "#020617", color: "#e5e7eb", padding: "32px" }}>
            <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                    <div>
                        <h1 style={{ fontSize: "28px", fontWeight: 700 }}>TIFA – Invoice Dashboard</h1>
                        <p style={{ color: "#9ca3af", marginTop: "4px" }}>
                            Tokenized invoices, RWA financing & autonomous cashflow – visualized.
                        </p>
                    </div>
                    <div style={{ fontSize: "12px", textAlign: "right", color: "#64748b" }}>
                        <div>Backend: {process.env.NEXT_PUBLIC_BACKEND_URL}</div>
                        <div>Subgraph: {process.env.NEXT_PUBLIC_SUBGRAPH_URL}</div>
                    </div>
                </header>

                {message && (
                    <div
                        style={{
                            marginBottom: "16px",
                            padding: "10px 14px",
                            borderRadius: "8px",
                            background: "#0f172a",
                            border: "1px solid #334155",
                            fontSize: "14px",
                        }}
                    >
                        {message}
                    </div>
                )}

                {isLoading && <p>Loading invoices...</p>}
                {error && <p style={{ color: "#f87171" }}>Failed to load invoices.</p>}

                {data && data.length === 0 && (
                    <p>No invoices yet. Create some via Backend or ERP integration.</p>
                )}

                {data && data.length > 0 && (
                    <div
                        style={{
                            borderRadius: "12px",
                            border: "1px solid #1f2937",
                            background: "#020617",
                            overflow: "hidden",
                        }}
                    >
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ background: "#020617", borderBottom: "1px solid #111827" }}>
                                    <th style={thStyle}>Invoice</th>
                                    <th style={thStyle}>Amount</th>
                                    <th style={thStyle}>Due Date</th>
                                    <th style={thStyle}>Status</th>
                                    <th style={thStyle}>Financed</th>
                                    <th style={thStyle}>Paid</th>
                                    <th style={thStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((inv) => {
                                    const amountFormatted = formatAmount(inv.amount, inv.currency || "TRY");
                                    const dueFormatted = formatDate(inv.dueDate);
                                    const paid = Number(inv.cumulativePaid || "0");
                                    const total = Number(inv.amount || "0");
                                    const paidPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

                                    return (
                                        <tr
                                            key={inv.id}
                                            style={{
                                                borderBottom: "1px solid #020617",
                                                background: "#020617",
                                            }}
                                        >
                                            <td style={tdStyle}>
                                                <div style={{ display: "flex", flexDirection: "column" }}>
                                                    <span style={{ fontWeight: 600 }}>{inv.externalId}</span>
                                                    <span style={{ fontSize: "12px", color: "#6b7280" }}>{inv.id}</span>
                                                </div>
                                            </td>
                                            <td style={tdStyle}>{amountFormatted}</td>
                                            <td style={tdStyle}>{dueFormatted}</td>
                                            <td style={tdStyle}>
                                                <span
                                                    style={{
                                                        padding: "3px 8px",
                                                        borderRadius: "999px",
                                                        fontSize: "12px",
                                                        background: "#020617",
                                                        border: "1px solid #1f2937",
                                                        color: statusColor(inv.status),
                                                    }}
                                                >
                                                    {inv.status}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>{inv.isFinanced ? "Yes" : "No"}</td>
                                            <td style={tdStyle}>
                                                <span style={{ fontSize: "12px" }}>
                                                    {paidPct}%{" "}
                                                    <span style={{ color: "#6b7280" }}>
                                                        ({inv.cumulativePaid}/{inv.amount})
                                                    </span>
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                <div style={{ display: "flex", gap: "8px" }}>
                                                    <button
                                                        disabled={
                                                            actionLoadingId === inv.id || inv.status !== "ISSUED"
                                                        }
                                                        onClick={() => handleTokenize(inv)}
                                                        style={{
                                                            ...buttonStyle,
                                                            opacity:
                                                                actionLoadingId === inv.id || inv.status !== "ISSUED"
                                                                    ? 0.4
                                                                    : 1,
                                                        }}
                                                    >
                                                        Tokenize
                                                    </button>
                                                    <button
                                                        disabled={
                                                            actionLoadingId === inv.id ||
                                                            inv.status !== "TOKENIZED" ||
                                                            inv.isFinanced
                                                        }
                                                        onClick={() => handleFinance(inv)}
                                                        style={{
                                                            ...buttonStyle,
                                                            background:
                                                                "#16a34a",
                                                            borderColor: "#15803d",
                                                            opacity:
                                                                actionLoadingId === inv.id ||
                                                                    inv.status !== "TOKENIZED" ||
                                                                    inv.isFinanced
                                                                    ? 0.4
                                                                    : 1,
                                                        }}
                                                    >
                                                        Finance
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </main>
    );
}

const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#6b7280",
};

const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: "14px",
    borderTop: "1px solid #020617",
};

const buttonStyle: React.CSSProperties = {
    padding: "6px 10px",
    fontSize: "12px",
    borderRadius: "999px",
    border: "1px solid #4b5563",
    background: "#020617",
    color: "#e5e7eb",
    cursor: "pointer",
};
