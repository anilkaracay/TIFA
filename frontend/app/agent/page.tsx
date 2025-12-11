"use client";

import useSWR from "swr";
import type { AgentDecision } from "../../lib/agentClient";
import { fetchAgentDecisions } from "../../lib/agentClient";
import { Card } from "../../components/ui/Card";
import { Table } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";

export default function AgentConsolePage() {
    const { data, error, isLoading } = useSWR<AgentDecision[]>(
        "agent-decisions",
        () => fetchAgentDecisions(50),
        { refreshInterval: 10000 } // 10s
    );

    const columns = [
        {
            key: "createdAt",
            title: "Time",
            render: (d: AgentDecision) => (
                <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                    {new Date(d.createdAt).toLocaleString("tr-TR", {
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                    })}
                </span>
            )
        },
        {
            key: "invoice",
            title: "Invoice",
            render: (d: AgentDecision) => (
                <div style={{ display: "flex", flexDirection: "column" }}>
                    {d.invoiceExternalId && (
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>{d.invoiceExternalId}</span>
                    )}
                    {d.invoiceOnChainId && (
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {shorten(d.invoiceOnChainId)}
                        </span>
                    )}
                </div>
            )
        },
        {
            key: "actionType",
            title: "Action",
            render: (d: AgentDecision) => <Badge>{d.actionType}</Badge>
        },
        {
            key: "status",
            title: "Status Transition",
            render: (d: AgentDecision) => (
                <span style={{ fontSize: "13px" }}>
                    {d.previousStatus && (
                        <span style={{ color: "var(--text-muted)" }}>{d.previousStatus} → </span>
                    )}
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>{d.nextStatus ?? "—"}</span>
                </span>
            )
        },
        {
            key: "riskScore",
            title: "Risk",
            render: (d: AgentDecision) => (
                <span style={{ fontWeight: 600, color: d.riskScore && d.riskScore > 70 ? "#ef4444" : "var(--text)" }}>
                    {d.riskScore != null ? d.riskScore : "—"}
                </span>
            )
        },
        {
            key: "txHash",
            title: "Tx Hash",
            render: (d: AgentDecision) => (d.txHash ? <span style={{ fontFamily: "monospace", color: "var(--accent)" }}>{shorten(d.txHash)}</span> : "—")
        },
        {
            key: "message",
            title: "Message",
            render: (d: AgentDecision) => (
                <span style={{ color: "var(--text-muted)", fontSize: "13px", display: "block", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.message || ""}>
                    {d.message ?? "—"}
                </span>
            )
        }
    ];

    return (
        <div>
            <header style={{ marginBottom: "20px" }}>
                <h1 style={{ fontSize: "28px", fontWeight: 700 }}>Agent Console 🤖</h1>
                <p style={{ color: "var(--text-muted)", marginTop: "4px" }}>
                    Live view of autonomous decisions taken by the finance agent.
                </p>
            </header>

            {isLoading && <p style={{ padding: "20px", color: "var(--text-muted)" }}>Loading agent decisions...</p>}
            {error && (
                <p style={{ padding: "20px", color: "#f87171" }}>
                    Failed to load decisions. Check backend connection.
                </p>
            )}

            {data && data.length === 0 && (
                <Card><p style={{ textAlign: "center", color: "var(--text-muted)" }}>No decisions logged yet.</p></Card>
            )}

            {data && data.length > 0 && (
                <Card
                    style={{
                        padding: 0,
                        overflow: "hidden",
                    }}
                >
                    <Table columns={columns} data={data} />
                </Card>
            )}
        </div>
    );
}

function shorten(v: string, len = 6): string {
    if (!v) return "";
    if (v.length <= len * 2) return v;
    return `${v.slice(0, len)}…${v.slice(-len)}`;
}
