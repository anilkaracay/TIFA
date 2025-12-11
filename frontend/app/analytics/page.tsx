"use client";

import useSWR from "swr";
// Adjust import path based on actual structure. 
// Assuming lib is at /frontend/lib, and this file is at /frontend/app/analytics/page.tsx
// Next.js uses @/ alias usually but user used explicit relative path "../../lib/subgraphClient"
// Since our lib is at root `lib` in previous step (729+), relative path from app/analytics is ../../lib
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

    if (isLoading) return <p>Loading analytics...</p>;
    if (error) return <p>Failed to load analytics.</p>;
    if (!data) return <p>No analytics data.</p>;

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
            },
        ],
    };

    return (
        <main style={{ padding: "32px", color: "#e5e7eb", background: "#020617", minHeight: "100vh" }}>
            <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "16px" }}>
                TIFA Analytics Dashboard 📊
            </h1>

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
                <div style={{ width: "40%" }}>
                    <h2>Status Distribution</h2>
                    <Pie data={pieData} />
                </div>
            </div>

            {/* Event Feed */}
            <h2 style={{ marginBottom: "12px" }}>📡 Live Event Feed</h2>
            <div
                style={{
                    background: "#0f172a",
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid #1e293b",
                }}
            >
                {events.map((ev: any) => (
                    <div
                        key={ev.id}
                        style={{
                            padding: "8px 0",
                            borderBottom: "1px solid #1e293b",
                        }}
                    >
                        <strong>{ev.eventType}</strong> — Invoice {ev.invoiceId} —{" "}
                        <span style={{ color: "#94a3b8" }}>{ev.txHash}</span>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                            {new Date(Number(ev.timestamp) * 1000).toLocaleString()}
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}

// Metric card component
function MetricCard({ title, value }: { title: string; value: any }) {
    return (
        <div
            style={{
                background: "#0f172a",
                padding: "16px",
                borderRadius: "8px",
                flex: 1,
                border: "1px solid #1e293b",
                textAlign: "center",
            }}
        >
            <div style={{ fontSize: "14px", color: "#94a3b8" }}>{title}</div>
            <div style={{ fontSize: "24px", fontWeight: 700 }}>{value}</div>
        </div>
    );
}
