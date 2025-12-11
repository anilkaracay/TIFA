"use client";

import useSWR from "swr";
import { fetchAnalytics } from "../../lib/subgraphClient";
import { Pie } from "react-chartjs-2";
import {
    Chart as ChartJS,
    LineElement,
    ArcElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Tooltip,
    Legend,
} from "chart.js";
import { Card } from "../../components/ui/Card";

ChartJS.register(
    LineElement,
    ArcElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Tooltip,
    Legend
);

export default function AnalyticsPage() {
    const { data, error, isLoading } = useSWR("analytics", fetchAnalytics, {
        refreshInterval: 15000,
    });

    if (isLoading) return <p style={{ padding: "20px", color: "var(--text-muted)" }}>Loading analytics...</p>;
    if (error) return <p style={{ padding: "20px", color: "#f87171" }}>Failed to load analytics.</p>;
    if (!data) return <p style={{ padding: "20px", color: "var(--text-muted)" }}>No analytics data.</p>;

    const invoices = data.invoices || [];
    const financed = data.financed || [];
    const events = data.events || [];

    // Compute metrics
    const totalInvoices = invoices.length;
    const tokenized = invoices.filter((i: any) => i.status === "TOKENIZED").length;
    const financedCount = invoices.filter((i: any) => i.status === "FINANCED").length;
    const defaultedCount = invoices.filter((i: any) => i.status === "DEFAULTED").length;

    const totalFinancedAmount = financed.length;

    const defaultRate =
        totalInvoices === 0 ? 0 : Math.round((defaultedCount / totalInvoices) * 100);

    // Chart data (status distribution)
    const statusCounts: Record<string, number> = {};
    invoices.forEach((inv: any) => {
        statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1;
    });

    const pieData = {
        labels: Object.keys(statusCounts),
        datasets: [
            {
                data: Object.values(statusCounts),
                backgroundColor: ["#3b82f6", "#a855f7", "#22c55e", "#f97316", "#ef4444", "#6b7280"],
                borderColor: "transparent",
            },
        ],
    };

    return (
        <div>
            <header style={{ marginBottom: "24px" }}>
                <h1 style={{ fontSize: "28px", fontWeight: 700 }}>Analytics Dashboard</h1>
                <p style={{ color: "var(--text-muted)", marginTop: "4px" }}>
                    Live on-chain metrics & event feed.
                </p>
            </header>

            {/* Metrics Row */}
            <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
                <MetricCard title="Total Invoices" value={totalInvoices} />
                <MetricCard title="Tokenized" value={tokenized} />
                <MetricCard title="Financed" value={financedCount} />
                <MetricCard title="Default Rate" value={`${defaultRate}%`} />
                <MetricCard title="Total Collateral Positions" value={totalFinancedAmount} />
            </div>

            {/* Charts */}
            <div style={{ display: "flex", gap: "24px", marginBottom: "32px" }}>
                <Card style={{ width: "40%" }}>
                    <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", color: "var(--text)" }}>Status Distribution</h2>
                    <Pie data={pieData} options={{ plugins: { legend: { labels: { color: "#9ca3af" } } } }} />
                </Card>
            </div>

            {/* Event Feed */}
            <h2 style={{ marginBottom: "12px", fontSize: "18px", fontWeight: 600 }}>📡 Live Event Feed</h2>
            <Card style={{ padding: 0, overflow: "hidden" }}>
                {events.map((ev: any) => (
                    <div
                        key={ev.id}
                        style={{
                            padding: "12px 16px",
                            borderBottom: "1px solid var(--border)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                        }}
                    >
                        <div>
                            <strong style={{ color: "var(--accent)" }}>{ev.eventType}</strong>
                            <span style={{ color: "var(--text-muted)", margin: "0 8px" }}>—</span>
                            Invoice {ev.invoiceId}
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--text-muted)" }}>{ev.txHash}</div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                                {new Date(Number(ev.timestamp) * 1000).toLocaleString()}
                            </div>
                        </div>
                    </div>
                ))}
                {events.length === 0 && <div style={{ padding: "16px", color: "var(--text-muted)" }}>No events yet.</div>}
            </Card>
        </div>
    );
}

// Metric card component
function MetricCard({ title, value }: { title: string; value: any }) {
    return (
        <Card
            style={{
                flex: 1,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center"
            }}
        >
            <div style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "8px" }}>{title}</div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--text)" }}>{value}</div>
        </Card>
    );
}
