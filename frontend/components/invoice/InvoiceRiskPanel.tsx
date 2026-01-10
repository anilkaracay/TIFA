"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAccount, usePublicClient, useWriteContract, useChainId } from "wagmi";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { formatAmount, formatDate } from "../../lib/format";
import Deployments from "../../lib/deployments.json";
import { InvoiceDetail } from "../../lib/backendClient";

interface PositionData {
    exists: boolean;
    recourseMode: number; // 0 = RECOURSE, 1 = NON_RECOURSE
    usedCredit: bigint;
    interestAccrued: bigint;
    dueDate: bigint;
    graceEndsAt: bigint;
    isInDefault: boolean;
    defaultDeclaredAt: bigint;
    maxCreditLine: bigint;
}

interface InvoiceRiskPanelProps {
    invoice: InvoiceDetail;
}

export function InvoiceRiskPanel({ invoice }: InvoiceRiskPanelProps) {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    const chainId = useChainId();
    const deploymentKey = chainId === 31337 ? "31337" : (chainId?.toString() || "31337");

    const [positionData, setPositionData] = useState<PositionData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reserveBalance, setReserveBalance] = useState<bigint | null>(null);

    // Fetch position data from contract
    useEffect(() => {
        if (!invoice.invoiceIdOnChain || !publicClient) return;

        async function fetchPosition() {
            try {
                const pool = (Deployments as any)[deploymentKey]?.FinancingPool;
                if (!pool) return;

                // invoiceIdOnChain is a hex string (bytes32), use it directly
                const invoiceIdHex = invoice.invoiceIdOnChain!.startsWith("0x")
                    ? invoice.invoiceIdOnChain! as `0x${string}`
                    : `0x${invoice.invoiceIdOnChain!}` as `0x${string}`;

                const position = await publicClient!.readContract({
                    address: pool.address as `0x${string}`,
                    abi: pool.abi,
                    functionName: "getPosition",
                    args: [invoiceIdHex],
                }) as any;

                if (position.exists) {
                    setPositionData({
                        exists: true,
                        recourseMode: Number(position.recourseMode),
                        usedCredit: position.usedCredit,
                        interestAccrued: position.interestAccrued,
                        dueDate: position.dueDate,
                        graceEndsAt: position.graceEndsAt,
                        isInDefault: position.isInDefault,
                        defaultDeclaredAt: position.defaultDeclaredAt,
                        maxCreditLine: position.maxCreditLine,
                    });

                    // Fetch reserve balance
                    const reserve = await publicClient!.readContract({
                        address: pool.address as `0x${string}`,
                        abi: pool.abi,
                        functionName: "reserveBalance",
                    }) as bigint;
                    setReserveBalance(reserve);
                }
            } catch (e: any) {
                console.error("Error fetching position:", e);
                setError(e.message || "Failed to load position data");
            }
        }

        fetchPosition();
    }, [invoice.invoiceIdOnChain, publicClient, deploymentKey]);

    // Calculate timeline status
    const timelineStatus = useMemo(() => {
        if (!positionData) return null;

        const now = BigInt(Math.floor(Date.now() / 1000));
        const dueDate = positionData.dueDate;
        const graceEndsAt = positionData.graceEndsAt;

        if (positionData.isInDefault) {
            return { status: "defaulted", label: "Defaulted", color: "#ef4444" };
        }
        if (graceEndsAt > 0n && now < graceEndsAt) {
            return { status: "in_grace", label: "In Grace", color: "#f97316" };
        }
        if (dueDate > 0n && now >= dueDate) {
            return { status: "overdue", label: "Overdue", color: "#ef4444" };
        }
        if (positionData.usedCredit > 0n) {
            return { status: "active", label: "Active", color: "#22c55e" };
        }
        return { status: "active", label: "Active", color: "#22c55e" };
    }, [positionData]);

    // Calculate estimated loss impact
    const lossImpact = useMemo(() => {
        if (!positionData || !reserveBalance) return null;

        // Safely convert to BigInt for calculations
        const usedCreditBigInt = positionData.usedCredit;
        const interestAccruedBigInt = positionData.interestAccrued;
        const totalDebtBigInt = usedCreditBigInt + interestAccruedBigInt;
        const isRecourse = positionData.recourseMode === 0;

        if (isRecourse) {
            return {
                reserveAbsorbs: 0n,
                lpImpact: 0n,
                explanation: "Recourse mode: Issuer is obligated to repay. No LP loss expected.",
            };
        }

        // Non-recourse: reserve absorbs first, then LP
        const reserveAbsorbs = totalDebtBigInt > reserveBalance ? reserveBalance : totalDebtBigInt;
        const lpImpact = totalDebtBigInt > reserveBalance ? totalDebtBigInt - reserveBalance : 0n;

        return {
            reserveAbsorbs,
            lpImpact,
            explanation: lpImpact > 0n
                ? "Non-recourse mode: Reserve may not fully cover loss. LP NAV could decrease."
                : "Non-recourse mode: Reserve should cover loss. LP protected.",
        };
    }, [positionData, reserveBalance]);

    // Handle Pay Recourse action
    async function handlePayRecourse() {
        if (!invoice.invoiceIdOnChain || !positionData || !publicClient) return;

        try {
            setLoading(true);
            const pool = (Deployments as any)[deploymentKey]?.FinancingPool;
            if (!pool) throw new Error("Pool deployment not found");

            // Safely convert to BigInt for contract call
            const usedCreditBigInt = positionData.usedCredit;
            const interestAccruedBigInt = positionData.interestAccrued;
            const totalDebt = usedCreditBigInt + interestAccruedBigInt;

            const invoiceIdHex = invoice.invoiceIdOnChain!.startsWith("0x")
                ? invoice.invoiceIdOnChain! as `0x${string}`
                : `0x${invoice.invoiceIdOnChain!}` as `0x${string}`;

            const tx = await writeContractAsync({
                address: pool.address as `0x${string}`,
                abi: pool.abi,
                functionName: "payRecourse",
                args: [invoiceIdHex, totalDebt],
            });

            await publicClient!.waitForTransactionReceipt({ hash: tx });

            // Refresh position data
            window.location.reload();
        } catch (e: any) {
            alert(`Pay Recourse failed: ${e.message || e.shortMessage || "Unknown error"}`);
        } finally {
            setLoading(false);
        }
    }

    // Handle Declare Default action
    async function handleDeclareDefault() {
        if (!invoice.invoiceIdOnChain || !publicClient) return;

        try {
            setLoading(true);
            const pool = (Deployments as any)[deploymentKey]?.FinancingPool;
            if (!pool) throw new Error("Pool deployment not found");

            const invoiceIdHex = invoice.invoiceIdOnChain!.startsWith("0x")
                ? invoice.invoiceIdOnChain! as `0x${string}`
                : `0x${invoice.invoiceIdOnChain!}` as `0x${string}`;

            const tx = await writeContractAsync({
                address: pool.address as `0x${string}`,
                abi: pool.abi,
                functionName: "declareDefault",
                args: [invoiceIdHex],
            });

            await publicClient!.waitForTransactionReceipt({ hash: tx });

            // Refresh position data
            window.location.reload();
        } catch (e: any) {
            alert(`Declare Default failed: ${e.message || e.shortMessage || "Unknown error"}`);
        } finally {
            setLoading(false);
        }
    }

    if (!invoice.invoiceIdOnChain || !invoice.isFinanced) {
        return null; // Only show for financed invoices
    }

    if (error) {
        return (
            <Card style={{ padding: "20px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                <p style={{ color: "#ef4444", fontSize: "14px" }}>⚠️ {error}</p>
            </Card>
        );
    }

    if (!positionData) {
        return (
            <Card style={{ padding: "20px" }}>
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading risk data...</p>
            </Card>
        );
    }

    const isRecourse = positionData.recourseMode === 0;
    // TODO: Proper issuer check - invoice.companyId is a database ID, not wallet address
    // For now, we'll show actions if wallet is connected (can be improved with backend check)
    const isIssuer = address !== undefined; // Simplified: show to connected wallet
    // Safely convert to BigInt for addition - ensure both are BigInt
    const usedCreditBigInt = positionData.usedCredit;
    const interestAccruedBigInt = positionData.interestAccrued;
    const totalDebtBigInt = usedCreditBigInt + interestAccruedBigInt;

    return (
        <Card style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Risk & Financing Control</h2>
            </div>

            {/* Risk Mode */}
            <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 600 }}>Risk Mode</span>
                    <Badge color={isRecourse ? "#22c55e" : "#f97316"}>
                        {isRecourse ? "RECOURSE" : "NON-RECOURSE"}
                    </Badge>
                    <span
                        style={{
                            fontSize: "11px",
                            color: "#2563eb",
                            cursor: "help",
                            marginLeft: "4px",
                            fontWeight: 500,
                            textDecoration: "underline",
                            textDecorationStyle: "dotted",
                        }}
                        title={
                            isRecourse
                                ? "Recourse: If debtor defaults, issuer is obligated to repay. LP losses are minimized."
                                : "Non-Recourse: If debtor defaults, pool bears the loss. Reserve protects LPs first."
                        }
                    >
                        Info
                    </span>
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0, lineHeight: "1.5" }}>
                    {isRecourse
                        ? "Issuer is obligated to repay if debtor defaults. LP protection: High."
                        : "Pool bears loss if debtor defaults. Reserve provides first-loss protection."}
                </p>
            </div>

            {/* Timeline */}
            <div style={{ marginBottom: "20px", padding: "16px", background: "rgba(59, 130, 246, 0.05)", borderRadius: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 600 }}>Status</span>
                    {timelineStatus && (
                        <Badge color={timelineStatus.color}>{timelineStatus.label}</Badge>
                    )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
                    <div>
                        <span style={{ color: "var(--text-muted)" }}>Due Date</span>
                        <p style={{ margin: "4px 0 0 0", fontWeight: 600 }}>
                            {positionData.dueDate > 0n
                                ? formatDate(new Date(Number(positionData.dueDate) * 1000).toISOString())
                                : "N/A"}
                        </p>
                    </div>
                    {positionData.graceEndsAt > 0n && (
                        <div>
                            <span style={{ color: "var(--text-muted)" }}>Grace Period End</span>
                            <p style={{ margin: "4px 0 0 0", fontWeight: 600 }}>
                                {formatDate(new Date(Number(positionData.graceEndsAt) * 1000).toISOString())}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Financial State */}
            <div style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", color: "var(--text)" }}>
                    Financial State
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                    <div>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Outstanding Principal</span>
                        <p style={{ margin: "4px 0 0 0", fontSize: "16px", fontWeight: 700 }}>
                            {formatAmount(Number(positionData.usedCredit) / 1e18, invoice.currency)}
                        </p>
                    </div>
                    <div>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Accrued Interest</span>
                        <p style={{ margin: "4px 0 0 0", fontSize: "16px", fontWeight: 700, color: "#f97316" }}>
                            {formatAmount(Number(positionData.interestAccrued) / 1e18, invoice.currency)}
                        </p>
                    </div>
                </div>

                {/* Loss Impact Estimate */}
                {lossImpact && totalDebtBigInt > 0n && (
                    <div style={{ padding: "12px", background: isRecourse ? "rgba(34, 197, 94, 0.1)" : "rgba(249, 115, 22, 0.1)", borderRadius: "8px", border: `1px solid ${isRecourse ? "rgba(34, 197, 94, 0.3)" : "rgba(249, 115, 22, 0.3)"}` }}>
                        <p style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px", color: "var(--text)" }}>
                            Estimated Loss Impact (if default happens now)
                        </p>
                        <div style={{ fontSize: "12px", lineHeight: "1.6" }}>
                            <div style={{ marginBottom: "4px" }}>
                                <span style={{ color: "var(--text-muted)" }}>Reserve absorbs: </span>
                                <span style={{ fontWeight: 600 }}>
                                    {formatAmount(Number(lossImpact.reserveAbsorbs) / 1e18, invoice.currency)}
                                </span>
                            </div>
                            <div style={{ marginBottom: "4px" }}>
                                <span style={{ color: "var(--text-muted)" }}>LP impact: </span>
                                <span style={{ fontWeight: 600, color: lossImpact.lpImpact > 0n ? "#ef4444" : "#22c55e" }}>
                                    {formatAmount(Number(lossImpact.lpImpact) / 1e18, invoice.currency)}
                                </span>
                            </div>
                            <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "8px 0 0 0", fontStyle: "italic" }}>
                                {lossImpact.explanation}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div style={{ paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                {isIssuer && isRecourse && positionData.isInDefault && totalDebtBigInt > 0n && (
                    <Button
                        variant="primary"
                        onClick={handlePayRecourse}
                        disabled={loading}
                        style={{ width: "100%" }}
                    >
                        {loading ? "Processing..." : "Pay Recourse"}
                    </Button>
                )}
                {/* TODO: Add admin check for declare default */}
                {positionData.graceEndsAt > 0n &&
                    BigInt(Math.floor(Date.now() / 1000)) >= positionData.graceEndsAt &&
                    !positionData.isInDefault && (
                        <Button
                            variant="warning"
                            onClick={handleDeclareDefault}
                            disabled={loading}
                            style={{ width: "100%", marginTop: "8px" }}
                        >
                            {loading ? "Processing..." : "Declare Default"}
                        </Button>
                    )}
                {!isIssuer && !positionData.isInDefault && (
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
                        No actions available
                    </p>
                )}
            </div>
        </Card>
    );
}

