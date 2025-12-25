"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { RoleGate } from "../../components/auth/RoleGate";
import { Role, resolveUserRole, getRoleDisplayName } from "../../lib/roles";
import { fetchUserRole } from "../../lib/backendClient";
import Deployments from "../../lib/deployments.json";
import { ethers } from "ethers";
import { useWebSocket } from "../../lib/websocketClient";
import { useTransactionManager } from "../../lib/transactionManager";
import { useToast } from "../../components/Toast";

export default function AdminPanelPage() {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    
    const [message, setMessage] = useState<string | React.ReactNode>(null);
    const [loading, setLoading] = useState(false);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    // Fetch user role
    const { data: userRole, isLoading: isLoadingRole } = useSWR(
        address ? ['admin-role', address] : null,
        () => fetchUserRole(address!),
        {
            revalidateOnFocus: true,
        }
    );

    // WebSocket connection for real-time updates
    const { subscribe: subscribeWS } = useWebSocket('global');
    const { trackTransaction } = useTransactionManager();
    const { showToast } = useToast();

    // Fetch pool status
    const { data: poolStatus, mutate: mutatePoolStatus } = useSWR(
        'admin-pool-status',
        async () => {
            const res = await fetch('http://localhost:4000/admin/pool/status');
            if (!res.ok) throw new Error('Failed to fetch pool status');
            return res.json();
        },
        {
            refreshInterval: 10000, // Reduced polling, WebSocket will handle updates
        }
    );

    // Subscribe to WebSocket events
    React.useEffect(() => {
        const unsubscribePoolPaused = subscribeWS('pool.paused', () => {
            mutatePoolStatus();
            showToast('info', 'Pool paused');
        });

        const unsubscribePoolUnpaused = subscribeWS('pool.unpaused', () => {
            mutatePoolStatus();
            showToast('info', 'Pool unpaused');
        });

        const unsubscribePoolParams = subscribeWS('pool.params_updated', () => {
            mutatePoolStatus();
            showToast('success', 'Pool parameters updated');
        });

        const unsubscribePoolReserve = subscribeWS('pool.reserve_funded', () => {
            mutatePoolStatus();
            showToast('success', 'Reserve funded');
        });

        return () => {
            unsubscribePoolPaused();
            unsubscribePoolUnpaused();
            unsubscribePoolParams();
            unsubscribePoolReserve();
        };
    }, [subscribeWS, mutatePoolStatus, showToast]);

    const isAdmin = userRole?.isAdmin || false;
    const isReadOnly = !isAdmin;

    async function handlePause() {
        if (!address) {
            setMessage("Please connect your wallet");
            return;
        }

        try {
            setLoading(true);
            setLoadingAction('pause');
            setMessage(null);

            const FinancingPool = Deployments.FinancingPool;
            const tx = await writeContractAsync({
                address: FinancingPool.address as `0x${string}`,
                abi: FinancingPool.abi,
                functionName: 'pause',
                args: [],
            });

            setMessage("Pausing pool... Waiting for confirmation...");
            const receipt = await publicClient!.waitForTransactionReceipt({ hash: tx });
            
            if (receipt.status === 'success') {
                setMessage("Pool paused successfully");
                mutatePoolStatus();
            } else {
                setMessage("Transaction failed");
            }
        } catch (e: any) {
            setMessage(`Error: ${e.message || 'Failed to pause pool'}`);
        } finally {
            setLoading(false);
            setLoadingAction(null);
        }
    }

    async function handleUnpause() {
        if (!address) {
            setMessage("Please connect your wallet");
            return;
        }

        try {
            setLoading(true);
            setLoadingAction('unpause');
            setMessage(null);

            const FinancingPool = Deployments.FinancingPool;
            const tx = await writeContractAsync({
                address: FinancingPool.address as `0x${string}`,
                abi: FinancingPool.abi,
                functionName: 'unpause',
                args: [],
            });

            setMessage("Unpausing pool... Waiting for confirmation...");
            const receipt = await publicClient!.waitForTransactionReceipt({ hash: tx });
            
            if (receipt.status === 'success') {
                setMessage("Pool unpaused successfully");
                mutatePoolStatus();
            } else {
                setMessage("Transaction failed");
            }
        } catch (e: any) {
            setMessage(`Error: ${e.message || 'Failed to unpause pool'}`);
        } finally {
            setLoading(false);
            setLoadingAction(null);
        }
    }

    return (
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
            {/* Navigation */}
            <div style={{ marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center" }}>
                <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
                    Invoices
                </Link>
                <span style={{ color: "var(--text-muted)" }}>|</span>
                <Link href="/lp" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
                    LP Dashboard
                </Link>
                <span style={{ color: "var(--text-muted)" }}>|</span>
                <Link href="/admin" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                    Admin
                </Link>
            </div>

            <div style={{ marginBottom: "32px" }}>
                <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>
                    Admin Panel
                </h1>
                <p style={{ color: "var(--text-muted)" }}>
                    Manage protocol parameters and emergency controls
                </p>
            </div>

            {/* Role Check */}
            {!address && (
                <Card style={{ marginBottom: "24px", padding: "20px", textAlign: "center", background: "rgba(59, 130, 246, 0.05)" }}>
                    <p style={{ color: "var(--text-muted)", margin: 0 }}>
                        Connect your admin wallet to access admin controls
                    </p>
                </Card>
            )}

            {address && isLoadingRole && (
                <Card style={{ marginBottom: "24px", padding: "20px", textAlign: "center" }}>
                    <p style={{ color: "var(--text-muted)", margin: 0 }}>Checking permissions...</p>
                </Card>
            )}

            {address && !isLoadingRole && isReadOnly && (
                <Card style={{ 
                    marginBottom: "24px", 
                    padding: "20px", 
                    background: "rgba(249, 115, 22, 0.1)",
                    border: "2px solid rgba(249, 115, 22, 0.3)",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "24px" }}>⚠️</span>
                        <div>
                            <p style={{ fontWeight: 600, color: "#f97316", margin: 0 }}>
                                Read-Only Mode
                            </p>
                            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                                Your wallet ({address.slice(0, 6)}...{address.slice(-4)}) does not have admin permissions.
                                Admin actions are disabled.
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Message */}
            {message && (
                <Card style={{ 
                    marginBottom: "24px", 
                    padding: "16px",
                    background: typeof message === 'string' && (message.includes('successfully') || message.includes('success'))
                        ? "rgba(34, 197, 94, 0.1)" 
                        : typeof message === 'string' && (message.includes('failed') || message.includes('Error:'))
                        ? "rgba(239, 68, 68, 0.1)"
                        : "rgba(59, 130, 246, 0.1)",
                }}>
                    <p style={{ margin: 0, fontSize: "14px" }}>{message}</p>
                </Card>
            )}

            {/* Pool Controls */}
            <Card style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "20px" }}>
                    Pool Controls
                </h2>

                {/* Emergency Pause */}
                <div style={{ marginBottom: "24px", padding: "20px", background: "rgba(239, 68, 68, 0.05)", borderRadius: "12px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <div>
                            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>Emergency Controls</h3>
                            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                                Pause all pool operations in case of emergency
                            </p>
                        </div>
                        {poolStatus && (
                            <div style={{
                                padding: "8px 16px",
                                background: poolStatus.paused ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)",
                                borderRadius: "8px",
                                fontSize: "14px",
                                fontWeight: 600,
                                color: poolStatus.paused ? "#ef4444" : "#22c55e",
                            }}>
                                {poolStatus.paused ? "PAUSED" : "ACTIVE"}
                            </div>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: "12px" }}>
                        <RoleGate allowed={[Role.ADMIN]} showDisabled disabledMessage="Admin only">
                            <Button
                                variant="danger"
                                onClick={handlePause}
                                disabled={loading || isReadOnly || poolStatus?.paused}
                            >
                                {loading && loadingAction === 'pause' ? "Pausing..." : "Pause Pool"}
                            </Button>
                        </RoleGate>
                        <RoleGate allowed={[Role.ADMIN]} showDisabled disabledMessage="Admin only">
                            <Button
                                variant="primary"
                                onClick={handleUnpause}
                                disabled={loading || isReadOnly || !poolStatus?.paused}
                            >
                                {loading && loadingAction === 'unpause' ? "Unpausing..." : "Unpause Pool"}
                            </Button>
                        </RoleGate>
                    </div>
                </div>

                {/* Pool Parameters */}
                {poolStatus && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
                        <div style={{ padding: "16px", background: "var(--bg-panel)", borderRadius: "8px" }}>
                            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Max Utilization</p>
                            <p style={{ fontSize: "18px", fontWeight: 700 }}>{Number(poolStatus.maxUtilizationBps) / 100}%</p>
                        </div>
                        <div style={{ padding: "16px", background: "var(--bg-panel)", borderRadius: "8px" }}>
                            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Max Single Loan</p>
                            <p style={{ fontSize: "18px", fontWeight: 700 }}>{Number(poolStatus.maxLoanBpsOfTVL) / 100}%</p>
                        </div>
                        <div style={{ padding: "16px", background: "var(--bg-panel)", borderRadius: "8px" }}>
                            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Max Issuer Exposure</p>
                            <p style={{ fontSize: "18px", fontWeight: 700 }}>{Number(poolStatus.maxIssuerExposureBps) / 100}%</p>
                        </div>
                    </div>
                )}
            </Card>

            {/* Reserve Management */}
            <Card style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "20px" }}>
                    Reserve Management
                </h2>
                {poolStatus && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
                        <div style={{ padding: "16px", background: "var(--bg-panel)", borderRadius: "8px" }}>
                            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Reserve Balance</p>
                            <p style={{ fontSize: "18px", fontWeight: 700 }}>
                                {ethers.utils.formatUnits(poolStatus.reserveBalance || '0', 18)} TRY
                            </p>
                        </div>
                        <div style={{ padding: "16px", background: "var(--bg-panel)", borderRadius: "8px" }}>
                            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Reserve Target</p>
                            <p style={{ fontSize: "18px", fontWeight: 700 }}>{Number(poolStatus.reserveTargetBps) / 100}%</p>
                        </div>
                    </div>
                )}
                <div style={{ marginTop: "20px" }}>
                    <RoleGate allowed={[Role.ADMIN]} fallback={
                        <div style={{ padding: "16px", background: "rgba(249, 115, 22, 0.05)", borderRadius: "8px", textAlign: "center" }}>
                            <p style={{ fontSize: "13px", color: "#f97316", margin: 0 }}>
                                Reserve funding is available to admins only
                            </p>
                        </div>
                    }>
                        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>
                            Reserve funding functionality coming soon
                        </p>
                    </RoleGate>
                </div>
            </Card>
        </div>
    );
}

