"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { useAccount, useWriteContract, usePublicClient, useChainId } from "wagmi";
import Navbar from "../../components/Navbar";
import Deployments from "../../lib/deployments.json";
import Link from "next/link";
import { fetchPoolOverview, fetchLPPosition, fetchPoolMetrics, fetchLPTransactions, PoolOverview, LPPosition, PoolMetrics, LPTransaction, fetchKycProfile, fetchYieldSummary, claimYield, KycProfile, YieldSummary } from "../../lib/backendClient";
import { formatAmount, formatDate } from "../../lib/format";
import { useWalletWebSocket } from "../../lib/websocketClient";
import { useTransactionManager } from "../../lib/transactionManager";
import { useToast } from "../../components/Toast";
import { RiskExposureCard } from "../../components/lp/RiskExposureCard";

// Premium institutional fintech styling
const styles = {
    page: {
        minHeight: "100vh",
        background: "#f8f9fa",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
        display: "flex",
        flexDirection: "column" as "column",
    },
    navbar: {
        background: "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
        padding: "0 48px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        height: "72px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        position: "sticky" as const,
        top: 0,
        zIndex: 1000,
        flexShrink: 0,
    },
    navLeft: {
        display: "flex",
        alignItems: "center",
        gap: "48px",
    },
    navTitle: {
        fontSize: "22px",
        fontWeight: 700,
        color: "#0f172a",
        letterSpacing: "-0.02em",
        background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
    },
    navLinks: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
    },
    navLink: {
        textDecoration: "none",
        color: "#64748b",
        fontSize: "15px",
        fontWeight: 500,
        padding: "10px 16px",
        borderRadius: "8px",
        borderBottom: "none",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative" as const,
        letterSpacing: "-0.01em",
    },
    navLinkActive: {
        color: "#2563eb",
        background: "rgba(37, 99, 235, 0.08)",
        fontWeight: 600,
    },
    navRight: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
    },
    container: {
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "32px 40px",
        flex: 1,
        width: "100%",
    },
    pageTitle: {
        fontSize: "32px",
        fontWeight: 700,
        color: "#1a1a1a",
        marginBottom: "8px",
    },
    pageSubtitle: {
        fontSize: "14px",
        color: "#666",
        marginBottom: "32px",
    },
    overviewCards: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "20px",
        marginBottom: "32px",
    },
    overviewCard: {
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        padding: "24px",
        minHeight: "140px",
        display: "flex",
        flexDirection: "column" as const,
        justifyContent: "space-between",
    },
    cardLabel: {
        fontSize: "12px",
        color: "#666",
        marginBottom: "12px",
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    cardValue: {
        fontSize: "28px",
        fontWeight: 700,
        color: "#1a1a1a",
    },
    cardMeta: {
        fontSize: "12px",
        color: "#999",
        marginTop: "8px",
    },
    section: {
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        padding: "32px",
        marginBottom: "24px",
    },
    sectionHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
        paddingBottom: "16px",
        borderBottom: "1px solid #f0f0f0",
    },
    sectionTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#1a1a1a",
    },
    tabs: {
        display: "flex",
        gap: "8px",
        marginBottom: "24px",
        borderBottom: "1px solid #e0e0e0",
    },
    tab: {
        padding: "12px 20px",
        fontSize: "14px",
        fontWeight: 500,
        background: "transparent",
        border: "none",
        borderBottom: "2px solid transparent",
        color: "#666",
        cursor: "pointer",
        transition: "0.2s",
    },
    tabActive: {
        color: "#2563eb",
        borderBottomColor: "#2563eb",
    },
    formGroup: {
        marginBottom: "20px",
    },
    formLabel: {
        fontSize: "13px",
        fontWeight: 500,
        color: "#1a1a1a",
        marginBottom: "8px",
        display: "block",
    },
    formInput: {
        width: "100%",
        padding: "12px 16px",
        fontSize: "16px",
        fontWeight: 500,
        border: "1px solid rgba(0, 0, 0, 0.06)",
        borderRadius: "8px",
        background: "rgba(255, 255, 255, 0.98)",
        color: "#0f172a",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        letterSpacing: "-0.01em",
    },
    noticeBox: {
        padding: "12px 16px",
        background: "#f0f4f8",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        fontSize: "13px",
        color: "#666",
        marginBottom: "20px",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
    },
    noticeIcon: {
        fontSize: "16px",
        flexShrink: 0,
    },
    buttonPrimary: {
        padding: "12px 24px",
        fontSize: "14px",
        fontWeight: 600,
        background: "linear-gradient(135deg, #2563eb 0%, #6366f1 100%)",
        border: "none",
        borderRadius: "8px",
        color: "#ffffff",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        width: "100%",
        boxShadow: "0 1px 3px rgba(37, 99, 235, 0.2), 0 1px 2px rgba(37, 99, 235, 0.1)",
        letterSpacing: "-0.01em",
    },
    buttonSecondary: {
        padding: "12px 24px",
        fontSize: "14px",
        fontWeight: 600,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        color: "#4b5563",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        width: "100%",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
        letterSpacing: "-0.01em",
    },
    buttonDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
    },
    riskGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "32px",
    },
    riskList: {
        listStyle: "none",
        padding: 0,
        margin: 0,
    },
    riskItem: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        borderBottom: "1px solid #f0f0f0",
    },
    riskLabel: {
        fontSize: "14px",
        color: "#666",
    },
    riskValue: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#1a1a1a",
    },
    progressBar: {
        height: "8px",
        background: "#f0f0f0",
        borderRadius: "4px",
        overflow: "hidden",
        marginTop: "8px",
    },
    progressFill: {
        height: "100%",
        background: "#2563eb",
        borderRadius: "4px",
        transition: "width 0.3s ease",
    },
    downloadLink: {
        fontSize: "13px",
        color: "#2563eb",
        textDecoration: "none",
        fontWeight: 500,
    },
    ledgerHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
    },
    searchBar: {
        display: "flex",
        gap: "12px",
        alignItems: "center",
    },
    searchInput: {
        padding: "10px 16px",
        fontSize: "14px",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        background: "#ffffff",
        color: "#1a1a1a",
        width: "300px",
    },
    filterButton: {
        padding: "10px 16px",
        fontSize: "14px",
        fontWeight: 500,
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        color: "#1a1a1a",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse" as "collapse",
    },
    tableHeader: {
        background: "#f8f9fa",
        borderBottom: "1px solid #e0e0e0",
    },
    tableHeaderCell: {
        padding: "12px 16px",
        textAlign: "left",
        fontSize: "12px",
        fontWeight: 600,
        color: "#666",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
    },
    tableRow: {
        borderBottom: "1px solid #f0f0f0",
    },
    tableCell: {
        padding: "12px 16px",
        fontSize: "14px",
        color: "#1a1a1a",
    },
    tableCellMuted: {
        color: "#666",
    },
    statusBadge: {
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 600,
    },
    statusSettled: {
        background: "#dcfce7",
        color: "#15803d",
    },
    pagination: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "20px",
        paddingTop: "20px",
        borderTop: "1px solid #e0e0e0",
    },
    paginationInfo: {
        fontSize: "13px",
        color: "#666",
    },
    paginationControls: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
    },
    paginationButton: {
        padding: "8px 12px",
        fontSize: "13px",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        background: "#ffffff",
        color: "#1a1a1a",
        cursor: "pointer",
        minWidth: "36px",
    },
    paginationButtonActive: {
        background: "#2563eb",
        color: "#ffffff",
        borderColor: "#2563eb",
    },
    paginationButtonDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
    },
    message: {
        padding: "12px 16px",
        borderRadius: "4px",
        marginBottom: "24px",
        fontSize: "14px",
    },
    messageSuccess: {
        background: "#dcfce7",
        color: "#15803d",
        border: "1px solid #86efac",
    },
    messageError: {
        background: "#fee2e2",
        color: "#dc2626",
        border: "1px solid #fca5a5",
    },
    messageInfo: {
        background: "#dbeafe",
        color: "#1e40af",
        border: "1px solid #93c5fd",
    },
} as const;

// Transaction interface is now imported from backendClient as LPTransaction

export default function LPDashboardPage() {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const chainId = useChainId();
    const deploymentKey = chainId === 84532 ? "baseSepolia" : chainId === 5003 ? "mantleSepolia" : "baseSepolia";

    const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
    const [depositAmount, setDepositAmount] = useState("");
    const [withdrawShares, setWithdrawShares] = useState("");
    const [mintAmount, setMintAmount] = useState("");
    const [message, setMessage] = useState<React.ReactNode | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingType, setLoadingType] = useState<"deposit" | "withdraw" | "mint" | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // WebSocket connection for real-time updates
    const { subscribe: subscribeWS } = useWalletWebSocket(address || null);
    const { trackTransaction } = useTransactionManager();
    const { showToast } = useToast();

    // Fetch pool overview
    const { data: poolOverview, mutate: mutatePool } = useSWR<PoolOverview>(
        "pool-overview",
        () => fetchPoolOverview(),
        { refreshInterval: 10000 } // Reduced polling, WebSocket will handle updates
    );

    // Fetch pool metrics
    const { data: poolMetrics, mutate: mutateMetrics } = useSWR<PoolMetrics>(
        "pool-metrics",
        () => fetchPoolMetrics(),
        { refreshInterval: 10000 }
    );

    // Fetch LP position
    const { data: lpPosition, mutate: mutatePosition } = useSWR<LPPosition>(
        address ? ["lp-position", address] : null,
        () => fetchLPPosition(address),
        { refreshInterval: 10000 }
    );

    // Fetch LP transactions
    const { data: transactionsData, mutate: mutateTransactions } = useSWR<{ transactions: LPTransaction[]; total: number }>(
        address ? ["lp-transactions", address] : null,
        () => fetchLPTransactions(address).then(res => ({ transactions: res.transactions, total: res.total })),
        { refreshInterval: 10000 }
    );

    // Compliance & Yield Data
    const { data: kycProfile } = useSWR<KycProfile | null>(
        address ? "kyc-profile" : null,
        () => fetchKycProfile('LP')
    );
    const { data: yieldSummary, mutate: mutateYield } = useSWR<YieldSummary>(
        address ? "yield-summary" : null,
        () => fetchYieldSummary(),
        { refreshInterval: 10000 }
    );

    async function handleClaimYield() {
        if (!yieldSummary || parseFloat(yieldSummary.accruedYield) <= 0) return;
        setLoading(true);
        try {
            const res = await claimYield();
            if (res.success) {
                showToast('success', `Claimed ${formatAmount(res.claimedAmount)} yield`);
                mutateYield();
            } else {
                showToast('error', res.error || "Claim failed");
                if (res.error === 'COMPLIANCE_RESTRICTED') {
                    mutateYield(); // Update to show HELD amount
                }
            }
        } catch (e: any) {
            showToast('error', e.message);
        } finally {
            setLoading(false);
        }
    }

    // Subscribe to WebSocket events
    React.useEffect(() => {
        if (!address) return;

        const unsubscribeLPDeposit = subscribeWS('lp.deposited', (event) => {
            if (event.payload.wallet.toLowerCase() === address.toLowerCase()) {
                console.log('[WebSocket] lp.deposited event received, refreshing transactions...');
                mutatePosition();
                mutatePool();
                mutateMetrics();
                // CRITICAL: Force immediate refresh with revalidate
                mutateTransactions(undefined, { revalidate: true });
                showToast('success', `Deposit successful: ${formatAmount(event.payload.amount)}`);
            }
        });

        const unsubscribeLPWithdraw = subscribeWS('lp.withdrawn', (event) => {
            if (event.payload.wallet.toLowerCase() === address.toLowerCase()) {
                console.log('[WebSocket] lp.withdrawn event received, refreshing transactions...');
                mutatePosition();
                mutatePool();
                mutateMetrics();
                // CRITICAL: Force immediate refresh with revalidate
                mutateTransactions(undefined, { revalidate: true });
                showToast('success', `Withdrawal successful`);
            }
        });

        const unsubscribePoolLiquidity = subscribeWS('pool.liquidity_changed', () => {
            mutatePool();
            mutateMetrics();
            mutatePosition();
        });

        const unsubscribePoolUtilization = subscribeWS('pool.utilization_changed', () => {
            mutatePool();
            mutateMetrics();
        });

        return () => {
            unsubscribeLPDeposit();
            unsubscribeLPWithdraw();
            unsubscribePoolLiquidity();
            unsubscribePoolUtilization();
        };
    }, [subscribeWS, address, mutatePosition, mutatePool, mutateMetrics, showToast]);

    // Calculate expected LP shares for deposit
    const expectedLPShares = useMemo(() => {
        if (!depositAmount || parseFloat(depositAmount) <= 0 || !poolOverview) return null;
        const amount = parseFloat(depositAmount);
        const sharePrice = parseFloat(poolOverview.lpSharePriceFormatted || "1");
        return amount / sharePrice;
    }, [depositAmount, poolOverview]);

    // Calculate expected withdrawal amount
    const expectedWithdrawal = useMemo(() => {
        if (!withdrawShares || parseFloat(withdrawShares) <= 0 || !poolOverview) return null;
        const shares = parseFloat(withdrawShares);
        const sharePrice = parseFloat(poolOverview.lpSharePriceFormatted || "1");
        return shares * sharePrice;
    }, [withdrawShares, poolOverview]);

    // Use real transactions from backend
    const transactions = transactionsData?.transactions || [];

    // Debug: Log transactions
    React.useEffect(() => {
        console.log('[LP Transactions] Current transactions:', transactions);
        console.log('[LP Transactions] Transactions data:', transactionsData);
        console.log('[LP Transactions] Wallet address:', address);
    }, [transactions, transactionsData, address]);

    // Filter transactions
    const filteredTransactions = useMemo(() => {
        if (!searchQuery) return transactions;
        const query = searchQuery.toLowerCase();
        return transactions.filter(tx =>
            tx.id.toLowerCase().includes(query) ||
            tx.type.toLowerCase().includes(query) ||
            tx.txHash?.toLowerCase().includes(query)
        );
    }, [transactions, searchQuery]);

    // Paginate transactions
    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredTransactions.slice(start, start + itemsPerPage);
    }, [filteredTransactions, currentPage]);

    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

    // Handle Deposit
    async function handleDeposit() {
        if (!address || !depositAmount || parseFloat(depositAmount) <= 0) {
            setMessage("Please enter a valid amount");
            return;
        }

        try {
            setLoading(true);
            setLoadingType("deposit");
            setMessage(null);

            const TestToken = (Deployments as any)[deploymentKey]?.TestToken;
            const FinancingPool = (Deployments as any)[deploymentKey]?.FinancingPool;
            // TestToken uses 18 decimals
            // Convert user input (e.g., 1000) to wei: multiply by 10^18
            const amountWei = BigInt(Math.floor(parseFloat(depositAmount) * 1e18));

            // Check allowance
            const allowance = await publicClient!.readContract({
                address: TestToken.address as `0x${string}`,
                abi: TestToken.abi,
                functionName: "allowance",
                args: [address, FinancingPool.address],
            }) as bigint;

            if (allowance < amountWei) {
                setMessage("Step 1/2: Approving tokens...");
                const approveTx = await writeContractAsync({
                    address: TestToken.address as `0x${string}`,
                    abi: TestToken.abi,
                    functionName: "approve",
                    args: [FinancingPool.address, amountWei],
                });
                await publicClient!.waitForTransactionReceipt({ hash: approveTx });
            }

            setMessage("Step 2/2: Depositing liquidity...");
            const depositTx = await writeContractAsync({
                address: FinancingPool.address as `0x${string}`,
                abi: FinancingPool.abi,
                functionName: "deposit",
                args: [amountWei],
            });

            trackTransaction(depositTx);
            showToast('info', `Deposit transaction submitted: ${depositTx.slice(0, 10)}...`);

            const receipt = await publicClient!.waitForTransactionReceipt({ hash: depositTx });

            // Notify backend about the deposit so it can record the transaction
            try {
                console.log('[Deposit] Recording transaction in backend...', { depositTx, address, depositAmount });

                const FinancingPool = (Deployments as any)[deploymentKey]?.FinancingPool;
                const lpPositionResult = await publicClient!.readContract({
                    address: FinancingPool.address as `0x${string}`,
                    abi: FinancingPool.abi,
                    functionName: "getLPPosition",
                    args: [address],
                }) as [bigint, bigint, bigint]; // [lpShares, underlyingValue, sharePrice]

                // getLPPosition returns a tuple: [lpShares, underlyingValue, sharePrice]
                const lpShares = lpPositionResult[0];
                const sharePrice = lpPositionResult[2];

                console.log('[Deposit] LP Position data:', {
                    lpShares: lpShares.toString(),
                    sharePrice: sharePrice.toString(),
                });

                const requestBody = {
                    type: 'Deposit',
                    amount: depositAmount,
                    lpShares: lpShares.toString(),
                    sharePrice: sharePrice.toString(),
                    txHash: depositTx,
                    blockNumber: receipt.blockNumber.toString(),
                };

                console.log('[Deposit] Sending request to backend:', requestBody);

                // Call backend to record transaction
                const recordRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/lp/record-transaction`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-wallet-address': address!,
                    },
                    body: JSON.stringify(requestBody),
                });

                console.log('[Deposit] Backend response status:', recordRes.status);

                if (!recordRes.ok) {
                    const errorText = await recordRes.text();
                    console.error('[Deposit] ❌ Failed to record transaction:', recordRes.status, errorText);
                    showToast('error', `Failed to record transaction: ${errorText}`);
                } else {
                    const result = await recordRes.json();
                    console.log('[Deposit] ✅ Transaction recorded successfully:', result);
                    // CRITICAL: Force immediate refresh with revalidate
                    await mutateTransactions(undefined, { revalidate: true });
                    // Also refresh after a short delay to ensure it's visible
                    setTimeout(() => {
                        mutateTransactions(undefined, { revalidate: true });
                    }, 500);
                }
            } catch (err: any) {
                console.error('[Deposit] ❌ Error recording transaction:', err);
                showToast('error', `Failed to record transaction: ${err.message}`);
            }

            showToast('success', 'Deposit successful! LP shares minted.');
            setDepositAmount("");
            setMessage(null); // Clear the "Step 2/2: Depositing liquidity..." message

            // Refresh all data
            await Promise.all([
                mutatePool(undefined, { revalidate: true }),
                mutatePosition(undefined, { revalidate: true }),
                mutateTransactions(undefined, { revalidate: true }),
            ]);
        } catch (e: any) {
            console.error(e);
            setMessage(`Deposit failed: ${e.message || e.shortMessage || "Unknown error"}`);
        } finally {
            setLoading(false);
            setLoadingType(null);
        }
    }

    // Handle Mint TestToken
    async function handleMintTestToken() {
        if (!address || !mintAmount || parseFloat(mintAmount) <= 0) {
            setMessage("Please enter a valid amount");
            return;
        }

        try {
            setLoading(true);
            setLoadingType("mint");
            setMessage(null);

            const TestToken = (Deployments as any)[deploymentKey]?.TestToken;
            // TestToken uses 18 decimals
            const amountWei = BigInt(Math.floor(parseFloat(mintAmount) * 1e18));

            setMessage("Minting TestToken...");
            const mintTx = await writeContractAsync({
                address: TestToken.address as `0x${string}`,
                abi: TestToken.abi,
                functionName: "mint",
                args: [address, amountWei],
            });

            trackTransaction(mintTx);
            showToast('info', `Mint transaction submitted: ${mintTx.slice(0, 10)}...`);

            await publicClient!.waitForTransactionReceipt({ hash: mintTx });

            showToast('success', `Minted ${mintAmount} TestToken successfully!`);
            setMintAmount("");
        } catch (e: any) {
            console.error(e);
            setMessage(`Mint failed: ${e.message || e.shortMessage || "Unknown error"}`);
            showToast('error', `Mint failed: ${e.message || e.shortMessage || "Unknown error"}`);
        } finally {
            setLoading(false);
            setLoadingType(null);
        }
    }

    // Handle Withdraw
    async function handleWithdraw() {
        if (!address || !withdrawShares || parseFloat(withdrawShares) <= 0) {
            setMessage("Please enter a valid LP share amount");
            return;
        }

        try {
            setLoading(true);
            setLoadingType("withdraw");
            setMessage(null);

            if (poolOverview && parseFloat(poolOverview.utilizationPercent) >= parseFloat(poolOverview.maxUtilizationPercent)) {
                setMessage(`Withdrawal disabled: Utilization is ${poolOverview.utilizationPercent}% (max: ${poolOverview.maxUtilizationPercent}%)`);
                setLoading(false);
                setLoadingType(null);
                return;
            }

            const FinancingPool = (Deployments as any)[deploymentKey]?.FinancingPool;
            // LP shares use 18 decimals (same as ERC20 standard)
            // Convert user input (e.g., 1000) to wei: multiply by 10^18
            const sharesWei = BigInt(Math.floor(parseFloat(withdrawShares) * 1e18));

            setMessage("Withdrawing liquidity...");
            const withdrawTx = await writeContractAsync({
                address: FinancingPool.address as `0x${string}`,
                abi: FinancingPool.abi,
                functionName: "withdraw",
                args: [sharesWei],
            });

            trackTransaction(withdrawTx);
            showToast('info', `Withdrawal transaction submitted: ${withdrawTx.slice(0, 10)}...`);

            const receipt = await publicClient!.waitForTransactionReceipt({ hash: withdrawTx });

            if (receipt.status !== "success") {
                showToast('error', 'Withdrawal transaction reverted');
                setMessage(null);
                setLoading(false);
                setLoadingType(null);
                return;
            }

            // Notify backend about the withdrawal so it can record the transaction
            try {
                const FinancingPool = (Deployments as any)[deploymentKey]?.FinancingPool;
                const lpPositionResult = await publicClient!.readContract({
                    address: FinancingPool.address as `0x${string}`,
                    abi: FinancingPool.abi,
                    functionName: "getLPPosition",
                    args: [address],
                }) as [bigint, bigint, bigint]; // [lpShares, underlyingValue, sharePrice]

                // getLPPosition returns a tuple: [lpShares, underlyingValue, sharePrice]
                const sharePrice = lpPositionResult[2];
                const withdrawalAmount = await publicClient!.readContract({
                    address: FinancingPool.address as `0x${string}`,
                    abi: FinancingPool.abi,
                    functionName: "calculateWithdrawalAmount",
                    args: [sharesWei],
                }) as bigint;

                // Call backend to record transaction
                await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/lp/record-transaction`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-wallet-address': address!,
                    },
                    body: JSON.stringify({
                        type: 'Withdrawal',
                        amount: (Number(withdrawalAmount) / 1e18).toString(),
                        lpShares: withdrawShares,
                        sharePrice: sharePrice.toString(),
                        txHash: withdrawTx,
                        blockNumber: receipt.blockNumber.toString(),
                    }),
                }).catch(err => {
                    console.warn('Failed to notify backend about withdrawal:', err);
                });
            } catch (err) {
                console.warn('Failed to record transaction in backend:', err);
            }

            showToast('success', 'Withdrawal successful!');
            setWithdrawShares("");
            setMessage(null); // Clear the "Withdrawing liquidity..." message

            // Force immediate refresh
            await Promise.all([
                mutatePool(undefined, { revalidate: true }),
                mutatePosition(undefined, { revalidate: true }),
                mutateMetrics(undefined, { revalidate: true }),
                mutateTransactions(undefined, { revalidate: true }),
            ]);

            // Also trigger a second refresh after a short delay to ensure backend has synced
            setTimeout(async () => {
                await Promise.all([
                    mutatePool(),
                    mutatePosition(),
                    mutateMetrics(),
                    mutateTransactions(),
                ]);
            }, 2000);
        } catch (e: any) {
            console.error(e);
            setMessage(`Withdrawal failed: ${e.message || e.shortMessage || "Unknown error"}`);
        } finally {
            setLoading(false);
            setLoadingType(null);
        }
    }

    const isWithdrawDisabled = poolOverview && parseFloat(poolOverview.utilizationPercent) >= parseFloat(poolOverview.maxUtilizationPercent);
    const netYieldTTM = poolMetrics?.apr ? parseFloat(poolMetrics.apr) : 0;

    // Compliance Logic
    const isKycApproved = kycProfile?.status === 'APPROVED';
    const isDepositDisabled = loading || !address || !depositAmount || parseFloat(depositAmount) <= 0 || !isKycApproved;

    return (
        <div style={styles.page}>
            <Navbar />

            {/* Main Content */}
            <div style={styles.container}>
                {/* Page Header */}
                <div>
                    <h1 style={styles.pageTitle}>Liquidity Provider Dashboard</h1>
                    <p style={styles.pageSubtitle}>
                        Manage capital allocation and monitor risk exposure
                    </p>
                </div>

                {/* KYC Banner */}
                {!isKycApproved && address && (
                    <div style={{
                        padding: '16px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', marginBottom: '24px', color: '#c2410c', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <div>
                            <strong>Compliance Check Required</strong>
                            <div style={{ fontSize: '13px', marginTop: '4px' }}>
                                You must complete KYC verification to deposit liquidity and claim yields. Current Status: <strong>{kycProfile?.status || 'NOT_STARTED'}</strong>
                            </div>
                        </div>
                        <Link href="/kyc" style={{
                            background: '#ea580c', color: 'white', padding: '8px 16px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600
                        }}>
                            Verify Identity →
                        </Link>
                    </div>
                )}

                {/* Message Display */}
                {message && (
                    <div style={{
                        ...styles.message,
                        ...(typeof message === "string" && message.includes("successful") ? styles.messageSuccess :
                            typeof message === "string" && message.includes("failed") || typeof message === "string" && message.includes("disabled") ? styles.messageError :
                                styles.messageInfo)
                    }}>
                        {message}
                    </div>
                )}

                {/* LP Portfolio Overview */}
                <div style={styles.overviewCards}>
                    <div style={styles.overviewCard}>
                        <div style={styles.cardLabel}>
                            <span>📄</span>
                            <span>Total Deposited</span>
                        </div>
                        <div style={styles.cardValue}>
                            {lpPosition && lpPosition.underlyingValueFormatted
                                ? formatAmount(lpPosition.underlyingValueFormatted, "TRY")
                                : formatAmount("0", "TRY")}
                        </div>
                        <div style={styles.cardMeta}>On-chain sourced</div>
                    </div>
                    <div style={styles.overviewCard}>
                        <div style={styles.cardLabel}>
                            <span>→</span>
                            <span>Current Share Value</span>
                        </div>
                        <div style={styles.cardValue}>
                            {poolOverview?.lpSharePriceFormatted
                                ? formatAmount(poolOverview.lpSharePriceFormatted, "TRY")
                                : formatAmount("1.00", "TRY")}
                        </div>
                        <div style={styles.cardMeta}>Pool sharePrice</div>
                    </div>
                    <div style={styles.overviewCard}>
                        <div style={styles.cardLabel}>
                            <span>Net Yield (TTM)</span>
                        </div>
                        <div style={styles.cardValue}>
                            {netYieldTTM > 0 ? `${netYieldTTM.toFixed(1)}%` : "N/A"}
                        </div>
                        <div style={styles.cardMeta}>Realized events only</div>
                    </div>
                    <div style={styles.overviewCard}>
                        <div style={styles.cardLabel}>
                            <span>+</span>
                            <span>Utilization</span>
                        </div>
                        <div style={styles.cardValue}>
                            {poolOverview?.utilizationPercent || "0.0"}%
                        </div>
                        <div style={styles.cardMeta}>
                            {poolOverview && parseFloat(poolOverview.utilizationPercent) >= parseFloat(poolOverview.maxUtilizationPercent) - 5
                                ? "Near limit"
                                : "Within limits"}
                        </div>
                    </div>
                    {/* Yield Card */}
                    <div style={styles.overviewCard}>
                        <div style={styles.cardLabel}>
                            <span>💰</span>
                            <span>Unclaimed Yield</span>
                        </div>
                        <div style={styles.cardValue}>
                            {yieldSummary ? formatAmount(yieldSummary.accruedYield, "TRY") : "0.00"}
                        </div>
                        <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
                            <button
                                onClick={handleClaimYield}
                                disabled={!yieldSummary || parseFloat(yieldSummary.accruedYield) <= 0 || loading}
                                style={{
                                    width: '100%', padding: '8px', fontSize: '13px', fontWeight: 600,
                                    background: (!yieldSummary || parseFloat(yieldSummary.accruedYield) <= 0) ? '#f3f4f6' : '#2563eb',
                                    color: (!yieldSummary || parseFloat(yieldSummary.accruedYield) <= 0) ? '#9ca3af' : 'white',
                                    border: 'none', borderRadius: '4px', cursor: (!yieldSummary || parseFloat(yieldSummary.accruedYield) <= 0) ? 'default' : 'pointer'
                                }}
                            >
                                Claim Yield
                            </button>
                        </div>
                    </div>
                </div>

                {/* Capital Management & Risk Exposure */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "32px", alignItems: "flex-start" }}>
                    {/* Capital Management */}
                    <div style={{ ...styles.section, display: "flex", flexDirection: "column", maxHeight: "600px", overflow: "hidden", padding: "24px", borderRadius: "8px" }}>
                        <div style={styles.sectionHeader}>
                            <h2 style={styles.sectionTitle}>Capital Management</h2>
                        </div>
                        <div style={styles.tabs}>
                            <button
                                style={{ ...styles.tab, ...(activeTab === "deposit" ? styles.tabActive : {}) }}
                                onClick={() => setActiveTab("deposit")}
                            >
                                Deposit
                            </button>
                            <button
                                style={{ ...styles.tab, ...(activeTab === "withdraw" ? styles.tabActive : {}) }}
                                onClick={() => setActiveTab("withdraw")}
                            >
                                Withdraw
                            </button>
                        </div>

                        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
                            {activeTab === "deposit" ? (
                                <>
                                    {/* TestToken Mint Section */}
                                    <div style={styles.formGroup}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                            <label style={styles.formLabel}>Get TestToken</label>
                                            <span style={{ fontSize: "12px", color: "#999", fontWeight: 400 }}>Required for deposit</span>
                                        </div>
                                        <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={mintAmount}
                                                onChange={(e) => setMintAmount(e.target.value)}
                                                style={{ ...styles.formInput, flex: 2, padding: "12px 16px", height: "48px" }}
                                                placeholder="0.00"
                                                disabled={loading || !address}
                                            />
                                            <button
                                                style={{
                                                    ...styles.buttonSecondary,
                                                    padding: "0 16px",
                                                    height: "48px",
                                                    fontSize: "13px",
                                                    width: "auto",
                                                    whiteSpace: "nowrap",
                                                    flex: 0,
                                                    ...((loading && loadingType !== "mint") || !address || !mintAmount || parseFloat(mintAmount) <= 0 ? styles.buttonDisabled : {}),
                                                }}
                                                onClick={handleMintTestToken}
                                                disabled={loading || !address || !mintAmount || parseFloat(mintAmount) <= 0}
                                            >
                                                {loading && loadingType === "mint" ? "Minting..." : "Mint"}
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ ...styles.formGroup, marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #e0e0e0" }}>
                                        <label style={styles.formLabel}>Deposit Amount (TestToken)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value)}
                                            style={styles.formInput}
                                            placeholder="0.00"
                                            disabled={loading || !address}
                                        />
                                        {expectedLPShares !== null && depositAmount && parseFloat(depositAmount) > 0 && (
                                            <div style={styles.cardMeta}>
                                                Expected LP Shares: {expectedLPShares.toFixed(4)} TIFA-LP
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        style={{
                                            ...styles.buttonPrimary,
                                            marginTop: "auto",
                                            ...((loading && loadingType !== "deposit") || !address || !depositAmount || parseFloat(depositAmount) <= 0 || !isKycApproved ? styles.buttonDisabled : {}),
                                        }}
                                        onClick={handleDeposit}
                                        disabled={isDepositDisabled}
                                    >
                                        {loading && loadingType === "deposit" ? "Processing..." : "Initiate Transfer"}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {isWithdrawDisabled && (
                                        <div style={{
                                            ...styles.noticeBox,
                                            background: "#fee2e2",
                                            borderColor: "#fca5a5",
                                            color: "#dc2626",
                                        }}>
                                            <span style={styles.noticeIcon}>WARNING</span>
                                            <div>
                                                <strong>Withdrawals disabled:</strong> Utilization is {poolOverview?.utilizationPercent}% (max: {poolOverview?.maxUtilizationPercent}%)
                                            </div>
                                        </div>
                                    )}
                                    <div style={styles.formGroup}>
                                        <label style={styles.formLabel}>LP Shares to Burn</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            min="0"
                                            max={lpPosition?.lpSharesFormatted ? parseFloat(lpPosition.lpSharesFormatted) : undefined}
                                            value={withdrawShares}
                                            onChange={(e) => setWithdrawShares(e.target.value)}
                                            style={styles.formInput}
                                            placeholder="0.0000"
                                            disabled={loading || !address || isWithdrawDisabled}
                                        />
                                        {lpPosition?.lpSharesFormatted && (
                                            <div style={styles.cardMeta}>
                                                Available: {formatAmount(lpPosition.lpSharesFormatted, "TIFA-LP")}
                                            </div>
                                        )}
                                        {expectedWithdrawal !== null && withdrawShares && parseFloat(withdrawShares) > 0 && (
                                            <div style={styles.cardMeta}>
                                                Expected withdrawal: {formatAmount(expectedWithdrawal.toFixed(2), "TRY")}
                                            </div>
                                        )}
                                    </div>
                                    {lpPosition && parseFloat(lpPosition.lpSharesFormatted) > 0 && (
                                        <div style={styles.noticeBox}>
                                            <span style={styles.noticeIcon}>INFO</span>
                                            <div>
                                                Withdrawals are subject to pool utilization limits. If utilization exceeds {poolOverview?.maxUtilizationPercent}%, withdrawals may be temporarily disabled.
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        style={{
                                            ...styles.buttonPrimary,
                                            marginTop: "auto",
                                            ...((loading && loadingType !== "withdraw") || !address || !withdrawShares || parseFloat(withdrawShares) <= 0 || isWithdrawDisabled ? styles.buttonDisabled : {}),
                                        }}
                                        onClick={handleWithdraw}
                                        disabled={loading || !address || !withdrawShares || parseFloat(withdrawShares) <= 0 || isWithdrawDisabled}
                                    >
                                        {loading && loadingType === "withdraw" ? "Processing..." : "Initiate Withdrawal"}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Risk Exposure */}
                    <RiskExposureCard />
                </div>

                {/* Transaction Ledger */}
                <div style={styles.section}>
                    <div style={styles.ledgerHeader}>
                        <h2 style={styles.sectionTitle}>Transaction Ledger</h2>
                        <div style={styles.searchBar}>
                            <input
                                type="text"
                                placeholder="Search ID..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                style={styles.searchInput}
                            />
                            <button style={styles.filterButton}>
                                <span>🔍</span>
                                <span>Filter</span>
                            </button>
                        </div>
                    </div>
                    <table style={styles.table}>
                        <thead style={styles.tableHeader}>
                            <tr>
                                <th style={styles.tableHeaderCell}>Date</th>
                                <th style={styles.tableHeaderCell}>Transaction Type</th>
                                <th style={styles.tableHeaderCell}>Amount</th>
                                <th style={styles.tableHeaderCell}>Share Price</th>
                                <th style={styles.tableHeaderCell}>Balance Impact</th>
                                <th style={styles.tableHeaderCell}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ ...styles.tableCell, textAlign: "center", padding: "60px", color: "#666" }}>
                                        No transactions found
                                    </td>
                                </tr>
                            ) : (
                                paginatedTransactions.map((tx) => (
                                    <tr key={tx.id} style={styles.tableRow}>
                                        <td style={{ ...styles.tableCell, ...styles.tableCellMuted }}>
                                            {formatDate(tx.date)}
                                        </td>
                                        <td style={styles.tableCell}>{tx.type}</td>
                                        <td style={styles.tableCell}>
                                            {formatAmount(tx.amount, "TRY")}
                                        </td>
                                        <td style={{ ...styles.tableCell, ...styles.tableCellMuted }}>
                                            {formatAmount(tx.sharePrice, "TRY")}
                                        </td>
                                        <td style={{
                                            ...styles.tableCell,
                                            color: tx.balanceImpact.startsWith("+") ? "#15803d" : "#dc2626",
                                            fontWeight: 600,
                                        }}>
                                            {formatAmount(tx.balanceImpact.replace("+", "").replace("-", ""), "TRY")}
                                        </td>
                                        <td style={styles.tableCell}>
                                            <span style={{ ...styles.statusBadge, ...styles.statusSettled }}>
                                                {tx.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {filteredTransactions.length > 0 && (
                        <div style={styles.pagination}>
                            <div style={styles.paginationInfo}>
                                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredTransactions.length)} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} transactions
                            </div>
                            <div style={styles.paginationControls}>
                                <button
                                    style={{
                                        ...styles.paginationButton,
                                        ...(currentPage === 1 ? styles.paginationButtonDisabled : {}),
                                    }}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    ←
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }

                                    return (
                                        <button
                                            key={pageNum}
                                            style={{
                                                ...styles.paginationButton,
                                                ...(currentPage === pageNum ? styles.paginationButtonActive : {}),
                                            }}
                                            onClick={() => setCurrentPage(pageNum)}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                {totalPages > 5 && currentPage < totalPages - 2 && (
                                    <span style={{ padding: "0 8px", color: "#666" }}>...</span>
                                )}
                                {totalPages > 5 && (
                                    <button
                                        style={{
                                            ...styles.paginationButton,
                                            ...(currentPage === totalPages ? styles.paginationButtonActive : {}),
                                        }}
                                        onClick={() => setCurrentPage(totalPages)}
                                    >
                                        {totalPages}
                                    </button>
                                )}
                                <button
                                    style={{
                                        ...styles.paginationButton,
                                        ...(currentPage === totalPages ? styles.paginationButtonDisabled : {}),
                                    }}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
