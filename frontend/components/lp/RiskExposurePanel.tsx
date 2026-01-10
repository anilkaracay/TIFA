"use client";

import React, { useEffect, useState, useMemo } from "react";
import { usePublicClient, useChainId } from "wagmi";
import { Card } from "../ui/Card";
import { formatAmount } from "../../lib/format";
import { PoolOverview, PoolMetrics } from "../../lib/backendClient";
import Deployments from "../../lib/deployments.json";

interface RiskExposurePanelProps {
    poolOverview: PoolOverview;
    poolMetrics: PoolMetrics;
}

interface PositionSummary {
    totalRecourse: bigint;
    totalNonRecourse: bigint;
    defaultedPrincipal: bigint;
    totalPrincipal: bigint;
}

export function RiskExposurePanel({ poolMetrics }: RiskExposurePanelProps) {
    const publicClient = usePublicClient();
    const chainId = useChainId();
    const deploymentKey = chainId === 31337 ? "31337" : (chainId?.toString() || "31337");

    const [exposureData, setExposureData] = useState<PositionSummary | null>(null);
    const [reserveBalance, setReserveBalance] = useState<bigint | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch exposure breakdown from contract
    useEffect(() => {
        if (!publicClient) return;

        async function fetchRiskData() {
            try {
                setLoading(true);
                const pool = (Deployments as any)[deploymentKey]?.FinancingPool;
                if (!pool) {
                    console.warn(`No deployment found for chainId ${chainId}`);
                    setLoading(false);
                    return;
                }

                // Fetch reserve balance (public state variable)
                let reserve: bigint = 0n;
                try {
                    reserve = await publicClient!.readContract({
                        address: pool.address as `0x${string}`,
                        abi: pool.abi,
                        functionName: "reserveBalance",
                    }) as bigint;
                } catch (e) {
                    console.warn("Error reading reserveBalance:", e);
                }

                setReserveBalance(reserve);

                // TODO: Fetch all positions and aggregate
                // For now, we'll use a simplified approach
                // In production, this should come from subgraph or backend aggregation endpoint
                // totalPrincipalOutstandingFormatted is in TRY (already formatted), convert to wei
                const totalPrincipal = poolMetrics?.totalPrincipalOutstandingFormatted
                    ? BigInt(Math.floor(parseFloat(poolMetrics.totalPrincipalOutstandingFormatted) * 1e18))
                    : 0n;

                // TODO: Fetch actual breakdown from backend/subgraph
                // For now, estimate: Assume 60% non-recourse, 40% recourse
                // This should be replaced with actual aggregated data from all positions
                const nonRecoursePrincipal = (totalPrincipal * 60n) / 100n;
                const recoursePrincipal = totalPrincipal - nonRecoursePrincipal;

                setExposureData({
                    totalRecourse: recoursePrincipal,
                    totalNonRecourse: nonRecoursePrincipal,
                    defaultedPrincipal: 0n,
                    totalPrincipal: totalPrincipal,
                });
            } catch (e: any) {
                console.error("Error fetching exposure data:", e);
                setError(e.message || "Failed to load exposure data");
            } finally {
                setLoading(false);
            }
        }

        fetchRiskData();
    }, [publicClient, poolMetrics, deploymentKey]);

    // Calculate coverage ratio
    const coverageRatio = useMemo(() => {
        if (!exposureData || !reserveBalance || exposureData.totalNonRecourse === 0n) {
            return null;
        }
        return Number(reserveBalance) / Number(exposureData.totalNonRecourse);
    }, [exposureData, reserveBalance]);

    // Calculate stress impact
    const stressImpact = useMemo(() => {
        if (!exposureData || !reserveBalance || !poolMetrics) return null;

        // NAV is already in formatted string (TRY), convert to wei for calculation
        const navWei = BigInt(Math.floor(parseFloat(poolMetrics.navFormatted || "0") * 1e18));
        if (navWei === 0n) return null;

        const nonRecourseLoss = exposureData.totalNonRecourse > reserveBalance
            ? exposureData.totalNonRecourse - reserveBalance
            : 0n;

        const impactPercent = (Number(nonRecourseLoss) / Number(navWei)) * 100;
        return impactPercent;
    }, [exposureData, reserveBalance, poolMetrics]);

    if (loading) {
        return (
            <Card style={{ padding: "24px" }}>
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading risk exposure data...</p>
            </Card>
        );
    }

    if (error) {
        return (
            <Card style={{ padding: "24px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                <p style={{ color: "#ef4444", fontSize: "14px" }}>⚠️ {error}</p>
            </Card>
        );
    }

    if (!exposureData || !poolMetrics) {
        return null;
    }

    const recoursePercent = exposureData.totalPrincipal > 0n
        ? (Number(exposureData.totalRecourse) / Number(exposureData.totalPrincipal)) * 100
        : 0;
    const nonRecoursePercent = 100 - recoursePercent;

    return (
        <Card style={{ padding: "24px", marginTop: "32px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "20px" }}>
                Risk Exposure & Protection
            </h2>

            {/* Exposure Breakdown */}
            <div style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", color: "var(--text)" }}>
                    Exposure Breakdown
                </h3>
                <div style={{ marginBottom: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Recourse Positions</span>
                        <span style={{ fontSize: "13px", fontWeight: 600 }}>{recoursePercent.toFixed(1)}%</span>
                    </div>
                    <div style={{ width: "100%", height: "8px", background: "rgba(34, 197, 94, 0.1)", borderRadius: "4px", overflow: "hidden" }}>
                        <div
                            style={{
                                width: `${recoursePercent}%`,
                                height: "100%",
                                background: "#22c55e",
                                transition: "width 0.3s ease",
                            }}
                        />
                    </div>
                </div>
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Non-Recourse Positions</span>
                        <span style={{ fontSize: "13px", fontWeight: 600 }}>{nonRecoursePercent.toFixed(1)}%</span>
                    </div>
                    <div style={{ width: "100%", height: "8px", background: "rgba(249, 115, 22, 0.1)", borderRadius: "4px", overflow: "hidden" }}>
                        <div
                            style={{
                                width: `${nonRecoursePercent}%`,
                                height: "100%",
                                background: "#f97316",
                                transition: "width 0.3s ease",
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Protection Layer */}
            <div style={{ marginBottom: "24px", padding: "16px", background: "rgba(59, 130, 246, 0.05)", borderRadius: "8px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", color: "var(--text)" }}>
                    Protection Layer
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px", marginBottom: "12px" }}>
                    <div>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Reserve Balance</span>
                        <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: 700, color: "#3b82f6" }}>
                            {reserveBalance !== null
                                ? formatAmount((Number(reserveBalance) / 1e18).toFixed(2), "TRY")
                                : "N/A"}
                        </p>
                    </div>
                </div>
                {coverageRatio !== null && (
                    <div style={{ padding: "12px", background: coverageRatio >= 1 ? "rgba(34, 197, 94, 0.1)" : "rgba(249, 115, 22, 0.1)", borderRadius: "6px", border: `1px solid ${coverageRatio >= 1 ? "rgba(34, 197, 94, 0.3)" : "rgba(249, 115, 22, 0.3)"}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600 }}>Coverage Ratio</span>
                            <span style={{ fontSize: "16px", fontWeight: 700, color: coverageRatio >= 1 ? "#22c55e" : "#f97316" }}>
                                {(coverageRatio * 100).toFixed(1)}%
                            </span>
                        </div>
                        <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "6px 0 0 0" }}>
                            Reserve / Non-Recourse Exposure
                            {coverageRatio >= 1
                                ? " — Fully protected"
                                : " — Partial protection"}
                        </p>
                    </div>
                )}
            </div>

            {/* Stress Preview */}
            {stressImpact !== null && (
                <div style={{ padding: "16px", background: stressImpact > 5 ? "rgba(239, 68, 68, 0.1)" : "rgba(251, 191, 36, 0.1)", borderRadius: "8px", border: `1px solid ${stressImpact > 5 ? "rgba(239, 68, 68, 0.3)" : "rgba(251, 191, 36, 0.3)"}` }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px", color: "var(--text)" }}>
                        Stress Preview
                    </h3>
                    <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px", lineHeight: "1.5" }}>
                        If all non-recourse invoices default today, estimated LP NAV impact:
                    </p>
                    <p style={{ fontSize: "20px", fontWeight: 700, color: stressImpact > 5 ? "#ef4444" : "#fbbf24", margin: 0 }}>
                        {stressImpact > 0 ? `−${stressImpact.toFixed(2)}%` : "0%"}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "8px 0 0 0", fontStyle: "italic" }}>
                        Estimate: (Non-Recourse Outstanding − Reserve) / NAV
                    </p>
                </div>
            )}

            {/* TODO Note */}
            {exposureData.totalPrincipal === 0n && (
                <div style={{ marginTop: "16px", padding: "12px", background: "rgba(251, 191, 36, 0.1)", borderRadius: "6px", border: "1px solid rgba(251, 191, 36, 0.3)" }}>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                        ℹ️ Exposure breakdown is estimated. In production, this should be aggregated from all positions via subgraph or backend endpoint.
                    </p>
                </div>
            )}
        </Card>
    );
}

