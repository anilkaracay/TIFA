"use client";

import React, { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { fetchPoolOverview, fetchLPPosition, fetchPoolMetrics, PoolOverview, LPPosition, PoolMetrics } from "../../lib/backendClient";
import { formatAmount } from "../../lib/format";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { RiskExposurePanel } from "../../components/lp/RiskExposurePanel";
import Deployments from "../../lib/deployments.json";

export default function LPDashboardPage() {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    const [depositAmount, setDepositAmount] = useState("");
    const [withdrawShares, setWithdrawShares] = useState("");
    const [message, setMessage] = useState<string | React.ReactNode>(null);
    const [loading, setLoading] = useState(false);
    const [loadingType, setLoadingType] = useState<"deposit" | "withdraw" | null>(null);

    // Fetch pool overview
    const { data: poolOverview, mutate: mutatePool } = useSWR<PoolOverview>(
        "pool-overview",
        () => fetchPoolOverview(),
        { 
            refreshInterval: 3000,
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            dedupingInterval: 1000,
        }
    );

    // Fetch pool metrics (for APY/APR)
    const { data: poolMetrics, mutate: mutateMetrics } = useSWR<PoolMetrics>(
        "pool-metrics",
        () => fetchPoolMetrics(),
        { 
            refreshInterval: 3000,
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            dedupingInterval: 1000,
        }
    );

    // Fetch LP position
    const { data: lpPosition, mutate: mutatePosition, isLoading: isLoadingPosition, error: lpPositionError } = useSWR<LPPosition>(
        address ? ["lp-position", address] : null,
        async () => {
            try {
                return await fetchLPPosition(address);
            } catch (error) {
                console.error("[LP Dashboard] Error fetching LP position:", error);
                throw error;
            }
        },
        { 
            refreshInterval: 3000,
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            dedupingInterval: 1000,
            errorRetryCount: 3,
            errorRetryInterval: 2000,
        }
    );

    // Calculate expected LP shares for deposit
    const expectedLPShares = useMemo(() => {
        if (!depositAmount || parseFloat(depositAmount) <= 0 || !poolOverview) return null;
        const amount = parseFloat(depositAmount);
        const nav = parseFloat(poolOverview.navFormatted || "0");
        const totalShares = parseFloat(poolOverview.lpTokenSupplyFormatted || "0");
        
        if (totalShares === 0) {
            return amount; // First deposit: 1:1
        }
        if (nav === 0) return null;
        
        const sharePrice = parseFloat(poolOverview.lpSharePriceFormatted || "1");
        return amount / sharePrice;
    }, [depositAmount, poolOverview]);

    // Calculate expected earnings for deposit
    const expectedEarnings = useMemo(() => {
        if (!depositAmount || parseFloat(depositAmount) <= 0 || !poolMetrics) return null;
        const amount = parseFloat(depositAmount);
        const apy = parseFloat(poolMetrics.apy || "0");
        
        if (apy <= 0) return null;
        
        return {
            annual: (amount * apy) / 100,
            monthly: (amount * apy) / (100 * 12),
            daily: (amount * apy) / (100 * 365),
        };
    }, [depositAmount, poolMetrics]);

    // Calculate expected withdrawal amount
    const expectedWithdrawal = useMemo(() => {
        if (!withdrawShares || parseFloat(withdrawShares) <= 0 || !poolOverview) return null;
        const shares = parseFloat(withdrawShares);
        const sharePrice = parseFloat(poolOverview.lpSharePriceFormatted || "1");
        return shares * sharePrice;
    }, [withdrawShares, poolOverview]);

    // Calculate LP position PnL and projected earnings
    const positionMetrics = useMemo(() => {
        if (!lpPosition || !poolMetrics) return null;
        
        const currentValue = parseFloat(lpPosition.underlyingValueFormatted || "0");
        const initialDeposit = parseFloat(lpPosition.dbShares || lpPosition.underlyingValueFormatted || "0");
        const pnl = currentValue - initialDeposit;
        const pnlPercent = initialDeposit > 0 ? (pnl / initialDeposit) * 100 : 0;
        
        const apy = parseFloat(poolMetrics.apy || "0");
        const projectedAnnual = currentValue > 0 && apy > 0 ? (currentValue * apy) / 100 : 0;
        const projectedMonthly = projectedAnnual / 12;
        const projectedDaily = projectedAnnual / 365;
        
        return {
            pnl,
            pnlPercent,
            projectedAnnual,
            projectedMonthly,
            projectedDaily,
        };
    }, [lpPosition, poolMetrics]);

    async function handleDeposit() {
        if (!address || !depositAmount || parseFloat(depositAmount) <= 0) {
            setMessage(<span style={{ color: "#ef4444" }}>⚠️ Please enter a valid amount</span>);
            return;
        }

        try {
            setLoading(true);
            setLoadingType("deposit");
            setMessage(null);

            const TestToken = Deployments.TestToken;
            const FinancingPool = Deployments.FinancingPool;

            const amountWei = BigInt(Math.floor(parseFloat(depositAmount) * 10 ** 18));

            const allowance = await publicClient!.readContract({
                address: TestToken.address as `0x${string}`,
                abi: TestToken.abi,
                functionName: "allowance",
                args: [address, FinancingPool.address],
            }) as bigint;

            if (allowance < amountWei) {
                setMessage(<span style={{ color: "#3b82f6" }}>⏳ Step 1/2: Approving tokens... (Please confirm in wallet)</span>);
                const approveTx = await writeContractAsync({
                    address: TestToken.address as `0x${string}`,
                    abi: TestToken.abi,
                    functionName: "approve",
                    args: [FinancingPool.address, amountWei],
                });
                await publicClient!.waitForTransactionReceipt({ hash: approveTx });
            }

            setMessage(<span style={{ color: "#3b82f6" }}>⏳ Step 2/2: Depositing liquidity... (Please confirm in wallet)</span>);
            const depositTx = await writeContractAsync({
                address: FinancingPool.address as `0x${string}`,
                abi: FinancingPool.abi,
                functionName: "deposit",
                args: [amountWei],
            });

            setMessage(<span style={{ color: "#3b82f6" }}>⏳ Transaction sent. Waiting for confirmation...</span>);
            const receipt = await publicClient!.waitForTransactionReceipt({ hash: depositTx });

            if (receipt.status === "success") {
                setMessage(
                    <div style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "20px" }}>✅</span>
                        <span>Deposit successful! LP shares minted.</span>
                    </div>
                );
                setDepositAmount("");
                
                // Refresh data
                await Promise.all([
                    mutatePool(undefined, { revalidate: true }),
                    mutatePosition(undefined, { revalidate: true }),
                    mutateMetrics(undefined, { revalidate: true }),
                ]);
                
                setTimeout(async () => {
                    await Promise.all([
                        mutatePool(undefined, { revalidate: true }),
                        mutatePosition(undefined, { revalidate: true }),
                        mutateMetrics(undefined, { revalidate: true }),
                    ]);
                }, 2000);
            } else {
                setMessage(<span style={{ color: "#ef4444" }}>❌ Error: Deposit transaction reverted.</span>);
            }
        } catch (e: any) {
            console.error(e);
            setMessage(
                <div style={{ color: "#ef4444" }}>
                    ❌ Deposit failed: {e.message || e.shortMessage || "Unknown error"}
                </div>
            );
        } finally {
            setLoading(false);
            setLoadingType(null);
        }
    }

    async function handleWithdraw() {
        if (!address || !withdrawShares || parseFloat(withdrawShares) <= 0) {
            setMessage(<span style={{ color: "#ef4444" }}>⚠️ Please enter a valid LP share amount</span>);
            return;
        }

        try {
            setLoading(true);
            setLoadingType("withdraw");
            setMessage(null);

            if (poolOverview && parseFloat(poolOverview.utilizationPercent) >= parseFloat(poolOverview.maxUtilizationPercent)) {
                setMessage(
                    <span style={{ color: "#ef4444" }}>
                        ⚠️ Withdrawal disabled: Utilization is {poolOverview.utilizationPercent}% (max: {poolOverview.maxUtilizationPercent}%)
                    </span>
                );
                return;
            }

            const FinancingPool = Deployments.FinancingPool;
            const sharesWei = BigInt(Math.floor(parseFloat(withdrawShares) * 10 ** 18));

            setMessage(<span style={{ color: "#3b82f6" }}>⏳ Withdrawing liquidity... (Please confirm in wallet)</span>);
            const withdrawTx = await writeContractAsync({
                address: FinancingPool.address as `0x${string}`,
                abi: FinancingPool.abi,
                functionName: "withdraw",
                args: [sharesWei],
            });

            setMessage(<span style={{ color: "#3b82f6" }}>⏳ Transaction sent. Waiting for confirmation...</span>);
            const receipt = await publicClient!.waitForTransactionReceipt({ hash: withdrawTx });

            if (receipt.status === "success") {
                setMessage(
                    <div style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "20px" }}>✅</span>
                        <span>Withdrawal successful!</span>
                    </div>
                );
                setWithdrawShares("");
                
                // Refresh data
                await Promise.all([
                    mutatePool(undefined, { revalidate: true }),
                    mutatePosition(undefined, { revalidate: true }),
                    mutateMetrics(undefined, { revalidate: true }),
                ]);
                
                setTimeout(async () => {
                    await Promise.all([
                        mutatePool(undefined, { revalidate: true }),
                        mutatePosition(undefined, { revalidate: true }),
                        mutateMetrics(undefined, { revalidate: true }),
                    ]);
                }, 2000);
            } else {
                setMessage(<span style={{ color: "#ef4444" }}>❌ Error: Withdrawal transaction reverted.</span>);
            }
        } catch (e: any) {
            console.error(e);
            setMessage(
                <div style={{ color: "#ef4444" }}>
                    ❌ Withdrawal failed: {e.message || e.shortMessage || "Unknown error"}
                </div>
            );
        } finally {
            setLoading(false);
            setLoadingType(null);
        }
    }

    const isWithdrawDisabled = poolOverview && parseFloat(poolOverview.utilizationPercent) >= parseFloat(poolOverview.maxUtilizationPercent);
    const currentAPY = poolMetrics?.apy ? parseFloat(poolMetrics.apy) : poolOverview?.apy ? parseFloat(poolOverview.apy) : 0;
    const currentAPR = poolMetrics?.apr ? parseFloat(poolMetrics.apr) : poolOverview?.apr ? parseFloat(poolOverview.apr) : 0;

    return (
        <div style={{ 
            maxWidth: "1400px", 
            margin: "0 auto",
            padding: "0 20px",
            minHeight: "100vh",
        }}>
            {/* Header */}
            <div style={{ 
                marginBottom: "32px", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "flex-start",
                gap: "20px",
                flexWrap: "wrap",
            }}>
                <div style={{ flex: "1", minWidth: "300px" }}>
                    <h1 style={{ 
                        fontSize: "clamp(28px, 4vw, 36px)", 
                        fontWeight: 800, 
                        marginBottom: "8px",
                        background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        lineHeight: "1.2",
                    }}>
                        LP Dashboard
                    </h1>
                    <p style={{ 
                        color: "var(--text-muted)", 
                        fontSize: "16px",
                        lineHeight: "1.6"
                    }}>
                        Provide liquidity and earn yield from invoice financing
                    </p>
                </div>
                <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
                    <Button variant="secondary" style={{ 
                        padding: "10px 20px",
                        fontSize: "14px",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        whiteSpace: "nowrap",
                    }}>
                        ← Back to Invoices
                    </Button>
                </Link>
            </div>

            {/* Message Alert */}
            {message && (
                <div style={{
                    marginBottom: "24px",
                    padding: "16px 20px",
                    background: typeof message === "string" && (message.includes("❌") || message.includes("⚠️")) 
                        ? "rgba(239, 68, 68, 0.1)" 
                        : typeof message === "string" && message.includes("✅")
                        ? "rgba(34, 197, 94, 0.1)"
                        : "rgba(59, 130, 246, 0.1)",
                    border: `1px solid ${
                        typeof message === "string" && (message.includes("❌") || message.includes("⚠️"))
                            ? "rgba(239, 68, 68, 0.3)" 
                            : typeof message === "string" && message.includes("✅")
                            ? "rgba(34, 197, 94, 0.3)"
                            : "rgba(59, 130, 246, 0.3)"
                    }`,
                    borderRadius: "12px",
                    fontSize: "14px",
                    fontWeight: 500,
                    animation: "fadeIn 0.3s ease-out",
                }}>
                    {message}
                </div>
            )}

            {/* Pool Overview */}
            {poolOverview && (
                <Card style={{ 
                    marginBottom: "32px",
                    background: "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)",
                    border: "2px solid rgba(59, 130, 246, 0.2)",
                    padding: "28px",
                }}>
                    <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center",
                        marginBottom: "24px",
                        flexWrap: "wrap",
                        gap: "12px",
                    }}>
                        <h2 style={{ 
                            fontSize: "24px", 
                            fontWeight: 700,
                            background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}>
                            💧 Pool Overview
                        </h2>
                        <div style={{
                            padding: "6px 12px",
                            background: "rgba(59, 130, 246, 0.15)",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#3b82f6"
                        }}>
                            Live
                        </div>
                    </div>
                    <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
                        gap: "20px",
                        marginBottom: "24px"
                    }}>
                        <div style={{
                            padding: "20px",
                            background: "rgba(59, 130, 246, 0.1)",
                            borderRadius: "12px",
                            border: "1px solid rgba(59, 130, 246, 0.2)",
                        }}>
                            <p style={{ 
                                fontSize: "12px", 
                                color: "var(--text-muted)", 
                                marginBottom: "8px",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                fontWeight: 600
                            }}>
                                Total Liquidity (TVL)
                            </p>
                            <p style={{ 
                                fontSize: "clamp(20px, 3vw, 28px)", 
                                fontWeight: 800,
                                color: "#3b82f6",
                                margin: 0,
                                wordBreak: "break-word",
                            }}>
                                {formatAmount(poolOverview.totalLiquidityFormatted, "TRY")}
                            </p>
                        </div>
                        <div style={{
                            padding: "20px",
                            background: "rgba(239, 68, 68, 0.1)",
                            borderRadius: "12px",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                        }}>
                            <p style={{ 
                                fontSize: "12px", 
                                color: "var(--text-muted)", 
                                marginBottom: "8px",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                fontWeight: 600
                            }}>
                                Borrowed
                            </p>
                            <p style={{ 
                                fontSize: "clamp(20px, 3vw, 28px)", 
                                fontWeight: 800, 
                                color: "#ef4444",
                                margin: 0,
                            }}>
                                {formatAmount(poolOverview.totalBorrowedFormatted, "TRY")}
                            </p>
                        </div>
                        <div style={{
                            padding: "20px",
                            background: "rgba(34, 197, 94, 0.1)",
                            borderRadius: "12px",
                            border: "1px solid rgba(34, 197, 94, 0.2)",
                        }}>
                            <p style={{ 
                                fontSize: "12px", 
                                color: "var(--text-muted)", 
                                marginBottom: "8px",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                fontWeight: 600
                            }}>
                                Available
                            </p>
                            <p style={{ 
                                fontSize: "clamp(20px, 3vw, 28px)", 
                                fontWeight: 800, 
                                color: "#22c55e",
                                margin: 0,
                            }}>
                                {formatAmount(poolOverview.availableLiquidityFormatted, "TRY")}
                            </p>
                        </div>
                        <div style={{
                            padding: "20px",
                            background: parseFloat(poolOverview.utilizationPercent) > 75 
                                ? "rgba(239, 68, 68, 0.1)"
                                : parseFloat(poolOverview.utilizationPercent) > 50
                                ? "rgba(249, 115, 22, 0.1)"
                                : "rgba(34, 197, 94, 0.1)",
                            borderRadius: "12px",
                            border: `1px solid ${
                                parseFloat(poolOverview.utilizationPercent) > 75 
                                    ? "rgba(239, 68, 68, 0.2)"
                                    : parseFloat(poolOverview.utilizationPercent) > 50
                                    ? "rgba(249, 115, 22, 0.2)"
                                    : "rgba(34, 197, 94, 0.2)"
                            }`,
                        }}>
                            <p style={{ 
                                fontSize: "12px", 
                                color: "var(--text-muted)", 
                                marginBottom: "8px",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                fontWeight: 600
                            }}>
                                Utilization
                            </p>
                            <p style={{ 
                                fontSize: "clamp(20px, 3vw, 28px)", 
                                fontWeight: 800, 
                                color: parseFloat(poolOverview.utilizationPercent) > 75 
                                    ? "#ef4444" 
                                    : parseFloat(poolOverview.utilizationPercent) > 50
                                    ? "#f97316"
                                    : "#22c55e",
                                margin: 0,
                            }}>
                                {poolOverview.utilizationPercent}%
                            </p>
                        </div>
                        <div style={{
                            padding: "20px",
                            background: "rgba(251, 191, 36, 0.1)",
                            borderRadius: "12px",
                            border: "1px solid rgba(251, 191, 36, 0.2)",
                        }}>
                            <p style={{ 
                                fontSize: "12px", 
                                color: "var(--text-muted)", 
                                marginBottom: "8px",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                fontWeight: 600
                            }}>
                                LP APR
                            </p>
                            <p style={{ 
                                fontSize: "clamp(20px, 3vw, 28px)", 
                                fontWeight: 800, 
                                color: "#fbbf24",
                                margin: 0,
                            }}>
                                {currentAPR > 0 ? `${currentAPR.toFixed(2)}%` : "N/A"}
                            </p>
                        </div>
                        <div style={{
                            padding: "20px",
                            background: "rgba(168, 85, 247, 0.1)",
                            borderRadius: "12px",
                            border: "1px solid rgba(168, 85, 247, 0.2)",
                        }}>
                            <p style={{ 
                                fontSize: "12px", 
                                color: "var(--text-muted)", 
                                marginBottom: "8px",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                fontWeight: 600
                            }}>
                                LP APY
                            </p>
                            <p style={{ 
                                fontSize: "clamp(20px, 3vw, 28px)", 
                                fontWeight: 800, 
                                color: "#a855f7",
                                margin: 0,
                            }}>
                                {currentAPY > 0 ? `${currentAPY.toFixed(2)}%` : "N/A"}
                            </p>
                        </div>
                        <div style={{
                            padding: "20px",
                            background: "rgba(59, 130, 246, 0.1)",
                            borderRadius: "12px",
                            border: "1px solid rgba(59, 130, 246, 0.2)",
                        }}>
                            <p style={{ 
                                fontSize: "12px", 
                                color: "var(--text-muted)", 
                                marginBottom: "8px",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                fontWeight: 600
                            }}>
                                Share Price
                            </p>
                            <p style={{ 
                                fontSize: "clamp(20px, 3vw, 28px)", 
                                fontWeight: 800, 
                                color: "#3b82f6",
                                margin: 0,
                            }}>
                                {formatAmount(poolOverview.lpSharePriceFormatted, "TRY")}
                            </p>
                        </div>
                    </div>
                    
                    {/* Utilization Progress Bar */}
                    <div>
                        <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            marginBottom: "10px", 
                            fontSize: "13px", 
                            color: "var(--text-muted)",
                            fontWeight: 600
                        }}>
                            <span>Pool Utilization</span>
                            <span>{poolOverview.utilizationPercent}% / {poolOverview.maxUtilizationPercent}%</span>
                        </div>
                        <div style={{
                            width: "100%",
                            height: "10px",
                            background: "rgba(59, 130, 246, 0.1)",
                            borderRadius: "10px",
                            overflow: "hidden",
                            position: "relative",
                            border: "1px solid rgba(59, 130, 246, 0.2)",
                        }}>
                            <div style={{
                                width: `${Math.min(100, (parseFloat(poolOverview.utilizationPercent) / parseFloat(poolOverview.maxUtilizationPercent)) * 100)}%`,
                                height: "100%",
                                background: parseFloat(poolOverview.utilizationPercent) > 75 
                                    ? "linear-gradient(90deg, #ef4444 0%, #dc2626 100%)"
                                    : parseFloat(poolOverview.utilizationPercent) > 50
                                    ? "linear-gradient(90deg, #f97316 0%, #ea580c 100%)"
                                    : "linear-gradient(90deg, #22c55e 0%, #16a34a 100%)",
                                transition: "width 0.5s ease",
                                borderRadius: "10px",
                            }} />
                        </div>
                    </div>
                </Card>
            )}

            {/* Action Cards */}
            <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 500px), 1fr))", 
                gap: "28px",
                marginBottom: "32px"
            }}>
                {/* Deposit Section */}
                <Card style={{
                    background: "linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)",
                    border: "2px solid rgba(59, 130, 246, 0.2)",
                    padding: "32px",
                    position: "relative",
                    overflow: "hidden",
                }}>
                    <div style={{
                        position: "absolute",
                        top: "-50px",
                        right: "-50px",
                        width: "200px",
                        height: "200px",
                        background: "radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)",
                        borderRadius: "50%",
                    }} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                        <div style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: "12px",
                            marginBottom: "12px"
                        }}>
                            <div style={{
                                width: "48px",
                                height: "48px",
                                background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                                borderRadius: "12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "24px",
                            }}>
                                💧
                            </div>
                            <div>
                                <h2 style={{ 
                                    fontSize: "22px", 
                                    fontWeight: 700,
                                    marginBottom: "4px"
                                }}>
                                    Provide Liquidity
                                </h2>
                                <p style={{ 
                                    fontSize: "13px", 
                                    color: "var(--text-muted)",
                                }}>
                                    Deposit stablecoins to earn yield
                                </p>
                            </div>
                        </div>

                        <div style={{ marginTop: "28px", marginBottom: "20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                <label style={{ 
                                    fontSize: "14px", 
                                    fontWeight: 600, 
                                    display: "block",
                                    color: "var(--text)"
                                }}>
                                    Amount to Deposit
                                </label>
                                {poolOverview && poolOverview.availableLiquidityFormatted && (
                                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                        Available: {formatAmount(poolOverview.availableLiquidityFormatted, "TRY")}
                                    </span>
                                )}
                            </div>
                            <div style={{ position: "relative", marginBottom: "8px" }}>
                                <input
                                    id="deposit-input"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    placeholder="0.00"
                                    style={{
                                        width: "100%",
                                        padding: "16px 70px 16px 20px",
                                        background: "var(--bg-panel)",
                                        border: "2px solid var(--border)",
                                        borderRadius: "12px",
                                        color: "var(--text)",
                                        fontSize: "18px",
                                        fontWeight: 600,
                                        transition: "all 0.2s",
                                        outline: "none",
                                        boxSizing: "border-box",
                                    }}
                                    disabled={loading || !address}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = "#3b82f6";
                                        e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = "var(--border)";
                                        e.target.style.boxShadow = "none";
                                    }}
                                />
                                <span style={{
                                    position: "absolute",
                                    right: "20px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    color: "var(--text-muted)",
                                    fontSize: "16px",
                                    fontWeight: 700,
                                    pointerEvents: "none",
                                }}>
                                    TRY
                                </span>
                            </div>
                            {poolOverview && poolOverview.availableLiquidityFormatted && (
                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                    {["25", "50", "75", "100"].map((percent) => {
                                        const available = parseFloat(poolOverview.availableLiquidityFormatted || "0");
                                        const amount = (available * parseFloat(percent)) / 100;
                                        return (
                                            <button
                                                key={percent}
                                                onClick={() => setDepositAmount(amount.toFixed(2))}
                                                disabled={loading || !address || amount <= 0}
                                                style={{
                                                    padding: "6px 12px",
                                                    background: "rgba(59, 130, 246, 0.1)",
                                                    border: "1px solid rgba(59, 130, 246, 0.3)",
                                                    borderRadius: "8px",
                                                    fontSize: "12px",
                                                    fontWeight: 600,
                                                    color: "#3b82f6",
                                                    cursor: (loading || !address || amount <= 0) ? "not-allowed" : "pointer",
                                                    opacity: (loading || !address || amount <= 0) ? 0.5 : 1,
                                                    transition: "all 0.2s",
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!loading && address && amount > 0) {
                                                        e.currentTarget.style.background = "rgba(59, 130, 246, 0.2)";
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = "rgba(59, 130, 246, 0.1)";
                                                }}
                                            >
                                                {percent}%
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Expected LP Shares */}
                        {expectedLPShares !== null && depositAmount && parseFloat(depositAmount) > 0 && (
                            <div style={{
                                padding: "16px",
                                background: "rgba(59, 130, 246, 0.15)",
                                borderRadius: "12px",
                                marginBottom: "12px",
                                border: "1px solid rgba(59, 130, 246, 0.3)",
                            }}>
                                <p style={{ 
                                    color: "var(--text-muted)", 
                                    marginBottom: "6px",
                                    fontSize: "13px",
                                    fontWeight: 600
                                }}>
                                    Expected LP Shares
                                </p>
                                <p style={{ 
                                    fontWeight: 700, 
                                    color: "#3b82f6",
                                    fontSize: "18px",
                                    margin: 0,
                                }}>
                                    {expectedLPShares.toFixed(4)} <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>TIFA-LP</span>
                                </p>
                            </div>
                        )}

                        {/* Expected Earnings */}
                        {expectedEarnings && depositAmount && parseFloat(depositAmount) > 0 && (
                            <div style={{
                                padding: "16px",
                                background: "rgba(168, 85, 247, 0.15)",
                                borderRadius: "12px",
                                marginBottom: "20px",
                                border: "1px solid rgba(168, 85, 247, 0.3)",
                            }}>
                                <p style={{ 
                                    color: "var(--text-muted)", 
                                    marginBottom: "12px",
                                    fontSize: "13px",
                                    fontWeight: 600
                                }}>
                                    💰 Projected Earnings (at {currentAPY.toFixed(2)}% APY)
                                </p>
                                <div style={{ 
                                    display: "grid", 
                                    gridTemplateColumns: "repeat(3, 1fr)", 
                                    gap: "12px" 
                                }}>
                                    <div>
                                        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600 }}>Annual</p>
                                        <p style={{ fontSize: "16px", fontWeight: 700, color: "#a855f7", margin: 0 }}>
                                            {formatAmount(expectedEarnings.annual.toFixed(2), "TRY")}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600 }}>Monthly</p>
                                        <p style={{ fontSize: "16px", fontWeight: 700, color: "#a855f7", margin: 0 }}>
                                            {formatAmount(expectedEarnings.monthly.toFixed(2), "TRY")}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600 }}>Daily</p>
                                        <p style={{ fontSize: "16px", fontWeight: 700, color: "#a855f7", margin: 0 }}>
                                            {formatAmount(expectedEarnings.daily.toFixed(2), "TRY")}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Button
                            variant="primary"
                            onClick={handleDeposit}
                            disabled={loading || !address || !depositAmount || parseFloat(depositAmount) <= 0}
                            style={{ 
                                width: "100%",
                                padding: "14px",
                                fontSize: "16px",
                                fontWeight: 700,
                                opacity: (loading && loadingType !== "deposit") || !address || !depositAmount || parseFloat(depositAmount) <= 0 ? 0.5 : 1,
                            }}
                        >
                            {loading && loadingType === "deposit" ? (
                                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                    <span className="spinner" /> Processing...
                                </span>
                            ) : (
                                "Provide Liquidity"
                            )}
                        </Button>
                    </div>
                </Card>

                {/* Withdraw Section */}
                <Card style={{
                    background: "linear-gradient(135deg, rgba(249, 115, 22, 0.05) 0%, rgba(239, 68, 68, 0.05) 100%)",
                    border: "2px solid rgba(249, 115, 22, 0.2)",
                    padding: "32px",
                    position: "relative",
                    overflow: "hidden",
                    opacity: isWithdrawDisabled ? 0.6 : 1,
                }}>
                    <div style={{
                        position: "absolute",
                        top: "-50px",
                        right: "-50px",
                        width: "200px",
                        height: "200px",
                        background: "radial-gradient(circle, rgba(249, 115, 22, 0.1) 0%, transparent 70%)",
                        borderRadius: "50%",
                    }} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                        <div style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: "12px",
                            marginBottom: "12px"
                        }}>
                            <div style={{
                                width: "48px",
                                height: "48px",
                                background: "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
                                borderRadius: "12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "24px",
                            }}>
                                💰
                            </div>
                            <div>
                                <h2 style={{ 
                                    fontSize: "22px", 
                                    fontWeight: 700,
                                    marginBottom: "4px"
                                }}>
                                    Withdraw Liquidity
                                </h2>
                                <p style={{ 
                                    fontSize: "13px", 
                                    color: "var(--text-muted)",
                                }}>
                                    Burn LP shares to withdraw
                                </p>
                            </div>
                        </div>

                        {isWithdrawDisabled && (
                            <div style={{
                                padding: "14px",
                                background: "rgba(239, 68, 68, 0.15)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                borderRadius: "12px",
                                marginBottom: "20px",
                                fontSize: "13px",
                                color: "#ef4444",
                                fontWeight: 600,
                            }}>
                                ⚠️ Withdrawals disabled: Utilization is {poolOverview?.utilizationPercent}% (max: {poolOverview?.maxUtilizationPercent}%)
                            </div>
                        )}

                        <div style={{ marginTop: "28px", marginBottom: "20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                <label style={{ 
                                    fontSize: "14px", 
                                    fontWeight: 600, 
                                    display: "block",
                                    color: "var(--text)"
                                }}>
                                    LP Shares to Burn
                                </label>
                                {lpPosition && lpPosition.lpSharesFormatted && parseFloat(lpPosition.lpSharesFormatted) > 0 && (
                                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                        You have: {formatAmount(lpPosition.lpSharesFormatted, "TIFA-LP")}
                                    </span>
                                )}
                            </div>
                            <div style={{ position: "relative", marginBottom: "8px" }}>
                                <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    max={lpPosition && lpPosition.lpSharesFormatted ? parseFloat(lpPosition.lpSharesFormatted) : undefined}
                                    value={withdrawShares}
                                    onChange={(e) => setWithdrawShares(e.target.value)}
                                    placeholder="0.0000"
                                    style={{
                                        width: "100%",
                                        padding: "16px 90px 16px 20px",
                                        background: "var(--bg-panel)",
                                        border: "2px solid var(--border)",
                                        borderRadius: "12px",
                                        color: "var(--text)",
                                        fontSize: "18px",
                                        fontWeight: 600,
                                        transition: "all 0.2s",
                                        outline: "none",
                                        boxSizing: "border-box",
                                    }}
                                    disabled={loading || !address || isWithdrawDisabled}
                                    onFocus={(e) => {
                                        if (!isWithdrawDisabled) {
                                            e.target.style.borderColor = "#f97316";
                                            e.target.style.boxShadow = "0 0 0 3px rgba(249, 115, 22, 0.1)";
                                        }
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = "var(--border)";
                                        e.target.style.boxShadow = "none";
                                    }}
                                />
                                <span style={{
                                    position: "absolute",
                                    right: "20px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    color: "var(--text-muted)",
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    pointerEvents: "none",
                                }}>
                                    TIFA-LP
                                </span>
                            </div>
                            {lpPosition && lpPosition.lpSharesFormatted && parseFloat(lpPosition.lpSharesFormatted) > 0 && !isWithdrawDisabled && (
                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                    {["25", "50", "75", "100"].map((percent) => {
                                        const totalShares = parseFloat(lpPosition.lpSharesFormatted || "0");
                                        const shares = (totalShares * parseFloat(percent)) / 100;
                                        return (
                                            <button
                                                key={percent}
                                                onClick={() => setWithdrawShares(shares.toFixed(4))}
                                                disabled={loading || !address || shares <= 0}
                                                style={{
                                                    padding: "6px 12px",
                                                    background: "rgba(249, 115, 22, 0.1)",
                                                    border: "1px solid rgba(249, 115, 22, 0.3)",
                                                    borderRadius: "8px",
                                                    fontSize: "12px",
                                                    fontWeight: 600,
                                                    color: "#f97316",
                                                    cursor: (loading || !address || shares <= 0) ? "not-allowed" : "pointer",
                                                    opacity: (loading || !address || shares <= 0) ? 0.5 : 1,
                                                    transition: "all 0.2s",
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!loading && address && shares > 0) {
                                                        e.currentTarget.style.background = "rgba(249, 115, 22, 0.2)";
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = "rgba(249, 115, 22, 0.1)";
                                                }}
                                            >
                                                {percent}%
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {expectedWithdrawal !== null && withdrawShares && parseFloat(withdrawShares) > 0 && (
                            <div style={{
                                padding: "16px",
                                background: "rgba(249, 115, 22, 0.15)",
                                borderRadius: "12px",
                                marginBottom: "20px",
                                border: "1px solid rgba(249, 115, 22, 0.3)",
                            }}>
                                <p style={{ 
                                    color: "var(--text-muted)", 
                                    marginBottom: "6px",
                                    fontSize: "13px",
                                    fontWeight: 600
                                }}>
                                    Expected Withdrawal
                                </p>
                                <p style={{ 
                                    fontWeight: 700, 
                                    color: "#f97316",
                                    fontSize: "18px",
                                    margin: 0,
                                }}>
                                    {formatAmount(expectedWithdrawal.toFixed(2), "TRY")}
                                </p>
                            </div>
                        )}

                        <Button
                            variant="warning"
                            onClick={handleWithdraw}
                            disabled={
                                loading || 
                                !address || 
                                !withdrawShares || 
                                parseFloat(withdrawShares) <= 0 ||
                                isWithdrawDisabled
                            }
                            style={{ 
                                width: "100%",
                                padding: "14px",
                                fontSize: "16px",
                                fontWeight: 700,
                                opacity: (loading && loadingType !== "withdraw") || !address || !withdrawShares || parseFloat(withdrawShares) <= 0 || isWithdrawDisabled ? 0.5 : 1,
                            }}
                        >
                            {loading && loadingType === "withdraw" ? (
                                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                    <span className="spinner" /> Processing...
                                </span>
                            ) : (
                                "Withdraw Liquidity"
                            )}
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Risk Exposure Panel */}
            <RiskExposurePanel poolOverview={poolOverview} poolMetrics={poolMetrics} />

            {/* LP Position */}
            {address && (
                <Card style={{ 
                    marginTop: "32px",
                    background: lpPosition && lpPosition.lpSharesFormatted && parseFloat(lpPosition.lpSharesFormatted) > 0
                        ? "linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)"
                        : "linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)",
                    border: lpPosition && lpPosition.lpSharesFormatted && parseFloat(lpPosition.lpSharesFormatted) > 0
                        ? "2px solid rgba(34, 197, 94, 0.2)"
                        : "2px solid rgba(59, 130, 246, 0.2)",
                    padding: "32px",
                }}>
                    <div style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between",
                        marginBottom: "24px",
                        flexWrap: "wrap",
                        gap: "12px",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{
                                width: "48px",
                                height: "48px",
                                background: lpPosition && lpPosition.lpSharesFormatted && parseFloat(lpPosition.lpSharesFormatted) > 0
                                    ? "linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)"
                                    : "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                                borderRadius: "12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "24px",
                            }}>
                                {lpPosition && lpPosition.lpSharesFormatted && parseFloat(lpPosition.lpSharesFormatted) > 0 ? "📊" : "💼"}
                            </div>
                            <div>
                                <h2 style={{ 
                                    fontSize: "22px", 
                                    fontWeight: 700,
                                    marginBottom: "4px"
                                }}>
                                    Your LP Position
                                </h2>
                                <p style={{ 
                                    fontSize: "13px", 
                                    color: "var(--text-muted)"
                                }}>
                                    {isLoadingPosition 
                                        ? "Loading position..."
                                        : lpPositionError
                                        ? "Error loading position"
                                        : lpPosition && lpPosition.lpSharesFormatted && parseFloat(lpPosition.lpSharesFormatted) > 0 
                                        ? `Your current liquidity provider position`
                                        : "No liquidity provided yet"}
                                </p>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {lpPosition && lpPosition.lpSharesFormatted && parseFloat(lpPosition.lpSharesFormatted) > 0 && (
                                <div style={{
                                    padding: "6px 12px",
                                    background: "rgba(34, 197, 94, 0.15)",
                                    borderRadius: "20px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    color: "#22c55e"
                                }}>
                                    Active
                                </div>
                            )}
                            {!isLoadingPosition && (
                                <button
                                    onClick={async () => {
                                        await Promise.all([
                                            mutatePool(undefined, { revalidate: true }),
                                            mutatePosition(undefined, { revalidate: true }),
                                            mutateMetrics(undefined, { revalidate: true }),
                                        ]);
                                    }}
                                    style={{
                                        padding: "6px 12px",
                                        background: "rgba(59, 130, 246, 0.15)",
                                        border: "1px solid rgba(59, 130, 246, 0.3)",
                                        borderRadius: "20px",
                                        fontSize: "12px",
                                        fontWeight: 600,
                                        color: "#3b82f6",
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "rgba(59, 130, 246, 0.25)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "rgba(59, 130, 246, 0.15)";
                                    }}
                                >
                                    🔄 Refresh
                                </button>
                            )}
                        </div>
                    </div>

                    {isLoadingPosition ? (
                        <div style={{
                            padding: "40px",
                            textAlign: "center",
                        }}>
                            <div className="spinner" style={{ 
                                width: "32px", 
                                height: "32px", 
                                margin: "0 auto 16px",
                                borderWidth: "3px"
                            }} />
                            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                                Loading your LP position...
                            </p>
                        </div>
                    ) : lpPosition && lpPosition.lpSharesFormatted && parseFloat(lpPosition.lpSharesFormatted) > 0 ? (
                        <>
                            <div style={{ 
                                display: "grid", 
                                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
                                gap: "20px",
                                marginBottom: "24px",
                            }}>
                                <div style={{
                                    padding: "20px",
                                    background: "rgba(59, 130, 246, 0.1)",
                                    borderRadius: "12px",
                                    border: "1px solid rgba(59, 130, 246, 0.2)",
                                    transition: "transform 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.2)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                                >
                                    <p style={{ 
                                        fontSize: "12px", 
                                        color: "var(--text-muted)", 
                                        marginBottom: "8px",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.5px",
                                        fontWeight: 600
                                    }}>
                                        LP Shares
                                    </p>
                                    <p style={{ 
                                        fontSize: "clamp(20px, 3vw, 28px)", 
                                        fontWeight: 800,
                                        color: "#3b82f6",
                                        margin: 0,
                                        wordBreak: "break-word",
                                    }}>
                                        {formatAmount(lpPosition.lpSharesFormatted, "TIFA-LP")}
                                    </p>
                                </div>
                                <div style={{
                                    padding: "20px",
                                    background: "rgba(34, 197, 94, 0.1)",
                                    borderRadius: "12px",
                                    border: "1px solid rgba(34, 197, 94, 0.2)",
                                    transition: "transform 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(34, 197, 94, 0.2)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                                >
                                    <p style={{ 
                                        fontSize: "12px", 
                                        color: "var(--text-muted)", 
                                        marginBottom: "8px",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.5px",
                                        fontWeight: 600
                                    }}>
                                        Underlying Value
                                    </p>
                                    <p style={{ 
                                        fontSize: "clamp(20px, 3vw, 28px)", 
                                        fontWeight: 800, 
                                        color: "#22c55e",
                                        margin: 0,
                                    }}>
                                        {formatAmount(lpPosition.underlyingValueFormatted, "TRY")}
                                    </p>
                                </div>
                                <div style={{
                                    padding: "20px",
                                    background: "rgba(139, 92, 246, 0.1)",
                                    borderRadius: "12px",
                                    border: "1px solid rgba(139, 92, 246, 0.2)",
                                    transition: "transform 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(139, 92, 246, 0.2)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                                >
                                    <p style={{ 
                                        fontSize: "12px", 
                                        color: "var(--text-muted)", 
                                        marginBottom: "8px",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.5px",
                                        fontWeight: 600
                                    }}>
                                        Share Price
                                    </p>
                                    <p style={{ 
                                        fontSize: "clamp(20px, 3vw, 28px)", 
                                        fontWeight: 800,
                                        color: "#8b5cf6",
                                        margin: 0,
                                    }}>
                                        {formatAmount(lpPosition.sharePriceFormatted, "TRY")}
                                    </p>
                                </div>
                                {poolMetrics && currentAPY > 0 && (
                                    <div style={{
                                        padding: "20px",
                                        background: "rgba(168, 85, 247, 0.1)",
                                        borderRadius: "12px",
                                        border: "1px solid rgba(168, 85, 247, 0.2)",
                                        transition: "transform 0.2s",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = "translateY(-2px)";
                                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(168, 85, 247, 0.2)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = "translateY(0)";
                                        e.currentTarget.style.boxShadow = "none";
                                    }}
                                    >
                                        <p style={{ 
                                            fontSize: "12px", 
                                            color: "var(--text-muted)", 
                                            marginBottom: "8px",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.5px",
                                            fontWeight: 600
                                        }}>
                                            Estimated APY
                                        </p>
                                        <p style={{ 
                                            fontSize: "clamp(20px, 3vw, 28px)", 
                                            fontWeight: 800,
                                            color: "#a855f7",
                                            margin: 0,
                                        }}>
                                            {currentAPY.toFixed(2)}%
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* PnL and Projected Earnings */}
                            {positionMetrics && (
                                <div style={{
                                    padding: "20px",
                                    background: "rgba(251, 191, 36, 0.1)",
                                    borderRadius: "12px",
                                    border: "1px solid rgba(251, 191, 36, 0.2)",
                                    marginBottom: "20px",
                                }}>
                                    <p style={{ 
                                        fontSize: "14px", 
                                        color: "var(--text-muted)", 
                                        marginBottom: "16px",
                                        fontWeight: 600
                                    }}>
                                        💰 Yield Information
                                    </p>
                                    <div style={{ 
                                        display: "grid", 
                                        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", 
                                        gap: "16px" 
                                    }}>
                                        <div>
                                            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600 }}>PnL</p>
                                            <p style={{ 
                                                fontSize: "18px", 
                                                fontWeight: 700, 
                                                color: positionMetrics.pnl >= 0 ? "#22c55e" : "#ef4444",
                                                margin: 0,
                                            }}>
                                                {positionMetrics.pnl >= 0 ? "+" : ""}{formatAmount(positionMetrics.pnl.toFixed(2), "TRY")}
                                            </p>
                                            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", margin: 0 }}>
                                                ({positionMetrics.pnlPercent >= 0 ? "+" : ""}{positionMetrics.pnlPercent.toFixed(2)}%)
                                            </p>
                                        </div>
                                        {currentAPY > 0 && (
                                            <>
                                                <div>
                                                    <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600 }}>Projected Annual</p>
                                                    <p style={{ fontSize: "18px", fontWeight: 700, color: "#a855f7", margin: 0 }}>
                                                        {formatAmount(positionMetrics.projectedAnnual.toFixed(2), "TRY")}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600 }}>Projected Monthly</p>
                                                    <p style={{ fontSize: "18px", fontWeight: 700, color: "#a855f7", margin: 0 }}>
                                                        {formatAmount(positionMetrics.projectedMonthly.toFixed(2), "TRY")}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600 }}>Projected Daily</p>
                                                    <p style={{ fontSize: "18px", fontWeight: 700, color: "#a855f7", margin: 0 }}>
                                                        {formatAmount(positionMetrics.projectedDaily.toFixed(2), "TRY")}
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{
                            padding: "40px",
                            textAlign: "center",
                            background: "rgba(59, 130, 246, 0.05)",
                            borderRadius: "12px",
                            border: "2px dashed rgba(59, 130, 246, 0.3)",
                        }}>
                            <div style={{ fontSize: "48px", marginBottom: "16px" }}>💧</div>
                            <p style={{ 
                                color: "var(--text)", 
                                fontSize: "18px",
                                fontWeight: 600,
                                marginBottom: "8px"
                            }}>
                                No Liquidity Provided Yet
                            </p>
                            <p style={{ 
                                color: "var(--text-muted)", 
                                fontSize: "14px",
                                marginBottom: "20px"
                            }}>
                                Start earning yield by providing liquidity to the pool
                            </p>
                            <Button
                                variant="primary"
                                onClick={() => {
                                    document.getElementById("deposit-input")?.scrollIntoView({ behavior: "smooth", block: "center" });
                                    setTimeout(() => {
                                        document.getElementById("deposit-input")?.focus();
                                    }, 500);
                                }}
                                style={{
                                    padding: "12px 24px",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                }}
                            >
                                Provide Liquidity →
                            </Button>
                        </div>
                    )}
                </Card>
            )}

            {!address && (
                <Card style={{ 
                    marginTop: "32px", 
                    textAlign: "center", 
                    padding: "60px 40px",
                    background: "rgba(59, 130, 246, 0.05)",
                    border: "2px dashed rgba(59, 130, 246, 0.3)",
                }}>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
                    <p style={{ 
                        color: "var(--text-muted)", 
                        fontSize: "18px",
                        fontWeight: 600,
                        marginBottom: "8px"
                    }}>
                        Connect Your Wallet
                    </p>
                    <p style={{ 
                        color: "var(--text-muted)", 
                        fontSize: "14px"
                    }}>
                        Please connect your wallet to view and manage your LP position
                    </p>
                </Card>
            )}
        </div>
    );
}
