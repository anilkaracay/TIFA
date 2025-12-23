"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { fetchInvoiceDetail, recordPayment } from "../../../lib/backendClient";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatAmount, formatDate, statusColor } from "../../../lib/format";
import { InvoiceRiskPanel } from "../../../components/invoice/InvoiceRiskPanel";
import { useState } from "react";

const inputStyle: React.CSSProperties = {
    width: "100%",
    marginTop: "4px",
    padding: "6px 8px",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    background: "var(--bg-panel)",
    color: "var(--text)",
    fontSize: "14px",
};

export default function InvoiceDetailPage() {
    const params = useParams();
    const id = params?.id as string;
    const { data: inv, error, isLoading, mutate } = useSWR(
        id ? ["invoice-detail", id] : null,
        () => fetchInvoiceDetail(id)
    );

    const [payAmount, setPayAmount] = useState("");
    const [payDate, setPayDate] = useState("");
    const [loading, setLoading] = useState(false);

    if (isLoading) return <p style={{ padding: 24 }}>Loading invoice...</p>;
    if (error || !inv) return <p style={{ padding: 24 }}>Failed to load invoice detail.</p>;

    async function handleRecordPayment() {
        if (!payAmount || !payDate) return;
        try {
            setLoading(true);
            await recordPayment(inv.id, {
                amount: payAmount,
                currency: inv.currency,
                paidAt: new Date(payDate).toISOString(),
                transactionId: "MANUAL-" + Date.now().toString(),
            } as any);
            setPayAmount("");
            setPayDate("");
            await mutate();
        } catch (e) {
            alert("Payment failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ display: "flex", gap: "24px", flexDirection: "column" }}>
            {/* Top: Summary & Payment */}
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                <div style={{ flex: 2, minWidth: "300px" }}>
                    <Card>
                        <h1 style={{ fontSize: "22px", marginBottom: "8px" }}>Invoice {inv.externalId}</h1>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "16px" }}>
                            <Badge color={statusColor(inv.status)}>{inv.status}</Badge>
                            {inv.isFinanced && <Badge color="#22c55e">Financed</Badge>}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                            <div>
                                <p style={{ color: "#94a3b8", fontSize: "12px" }}>Amount</p>
                                <p style={{ fontSize: "18px", fontWeight: 600 }}>{formatAmount(inv.amount, inv.currency)}</p>
                            </div>
                            <div>
                                <p style={{ color: "#94a3b8", fontSize: "12px" }}>Due Date</p>
                                <p>{formatDate(inv.dueDate)}</p>
                            </div>
                            <div>
                                <p style={{ color: "#94a3b8", fontSize: "12px" }}>Company ID</p>
                                <p>{inv.companyId}</p>
                            </div>
                            <div>
                                <p style={{ color: "#94a3b8", fontSize: "12px" }}>Debtor ID</p>
                                <p>{inv.debtorId}</p>
                            </div>
                        </div>

                        {(inv.invoiceIdOnChain || inv.tokenId) && (
                            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                                {inv.invoiceIdOnChain && (
                                    <p style={{ fontSize: "12px", color: "#64748b", fontFamily: "monospace" }}>
                                        Chain ID: {inv.invoiceIdOnChain}
                                    </p>
                                )}
                                {inv.tokenAddress && (
                                    <p style={{ fontSize: "12px", color: "#64748b", fontFamily: "monospace", marginTop: 4 }}>
                                        Token: {inv.tokenAddress} #{inv.tokenId}
                                    </p>
                                )}
                            </div>
                        )}
                    </Card>
                </div>

                <div style={{ flex: 1, minWidth: "250px" }}>
                    <Card>
                        <h2 style={{ fontSize: "16px", marginBottom: "8px" }}>Record Payment</h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>Amount</label>
                                <input
                                    type="number"
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    style={inputStyle}
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>Paid At</label>
                                <input
                                    type="date"
                                    value={payDate}
                                    onChange={(e) => setPayDate(e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                            <Button onClick={handleRecordPayment} disabled={loading}>
                                {loading ? "Saving..." : "Save Payment"}
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Risk & Financing Panel */}
            <InvoiceRiskPanel invoice={inv} />

            {/* Bottom: History */}
            <Card>
                <h2 style={{ fontSize: "16px", marginBottom: "16px" }}>Payment History</h2>
                {inv.payments.length === 0 && <p style={{ color: "#94a3b8" }}>No payments recorded yet.</p>}
                {inv.payments.length > 0 && (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                        <thead>
                            <tr style={{ textAlign: "left", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                                <th style={{ padding: "8px" }}>Date</th>
                                <th style={{ padding: "8px" }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inv.payments.map((p) => (
                                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{ padding: "8px" }}>{new Date(p.paidAt).toLocaleDateString()}</td>
                                    <td style={{ padding: "8px" }}>{formatAmount(p.amount, p.currency)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </div>
    );
}
