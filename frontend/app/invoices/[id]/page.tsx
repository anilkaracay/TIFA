"use client";

import React, { useMemo, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { fetchInvoiceDetail, fetchInvoiceTruth, InvoiceTruth, recordPayment, payRecourse, declareDefault, requestFinancing } from "../../../lib/backendClient";
import { fetchCompanies, Company } from "../../../lib/companyClient";
import { formatAmount, formatDate, statusColor } from "../../../lib/format";
import Deployments from "../../../lib/deployments.json";
import { InvoiceRiskPanel } from "../../../components/invoice/InvoiceRiskPanel";
import { useInvoiceWebSocket } from "../../../lib/websocketClient";
import { useToast } from "../../../components/Toast";
import { fetchUserRole } from "../../../lib/backendClient";

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
        background: "#ffffff",
        borderBottom: "1px solid #e0e0e0",
        padding: "16px 40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexShrink: 0,
    },
    navLeft: {
        display: "flex",
        alignItems: "center",
        gap: "32px",
    },
    navTitle: {
        fontSize: "20px",
        fontWeight: 700,
        color: "#1a1a1a",
    },
    navLinks: {
        display: "flex",
        gap: "24px",
        alignItems: "center",
    },
    navLink: {
        textDecoration: "none",
        color: "#666",
        fontSize: "14px",
        fontWeight: 500,
        padding: "8px 0",
        borderBottom: "2px solid transparent",
        transition: "0.2s",
    },
    navLinkActive: {
        color: "#2563eb",
        borderBottomColor: "#2563eb",
    },
    navRight: {
        display: "flex",
        alignItems: "center",
    },
    container: {
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "32px 40px",
        flex: 1,
    width: "100%",
    },
    breadcrumb: {
        marginBottom: "24px",
        fontSize: "13px",
        color: "#666",
    },
    breadcrumbLink: {
        color: "#2563eb",
        textDecoration: "none",
    },
    breadcrumbSeparator: {
        margin: "0 8px",
        color: "#999",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "32px",
        paddingBottom: "24px",
        borderBottom: "1px solid #e0e0e0",
    },
    headerLeft: {
        flex: 1,
    },
    invoiceTitle: {
        fontSize: "32px",
        fontWeight: 700,
        color: "#1a1a1a",
        marginBottom: "12px",
    },
    invoiceSubtitle: {
        fontSize: "14px",
        color: "#666",
        marginBottom: "16px",
    },
    headerActions: {
        display: "flex",
        gap: "12px",
        alignItems: "center",
    },
    buttonSecondary: {
        padding: "10px 20px",
        fontSize: "14px",
        fontWeight: 500,
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        color: "#1a1a1a",
        cursor: "pointer",
        transition: "0.2s",
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    buttonPrimary: {
        padding: "10px 20px",
        fontSize: "14px",
        fontWeight: 500,
        background: "#2563eb",
        border: "none",
        borderRadius: "4px",
        color: "#ffffff",
        cursor: "pointer",
        transition: "0.2s",
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    statusBadge: {
        display: "inline-block",
        padding: "6px 12px",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: 600,
    },
    summaryCards: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "20px",
        marginBottom: "32px",
    },
    summaryCard: {
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        padding: "20px",
    },
    summaryCardLabel: {
        fontSize: "12px",
        color: "#666",
        marginBottom: "8px",
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
    },
    summaryCardValue: {
        fontSize: "18px",
        fontWeight: 700,
        color: "#1a1a1a",
    },
    summaryCardMeta: {
        fontSize: "12px",
        color: "#999",
        marginTop: "4px",
    },
    summaryCardAvatar: {
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        background: "#e0e0e0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        fontWeight: 600,
        color: "#666",
        marginBottom: "12px",
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
        alignItems: "center",
        gap: "12px",
        marginBottom: "24px",
        paddingBottom: "16px",
        borderBottom: "1px solid #f0f0f0",
    },
    sectionIcon: {
        fontSize: "20px",
        color: "#666",
    },
    sectionTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#1a1a1a",
    },
    financialGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "32px",
    },
    financialItem: {
        marginBottom: "24px",
    },
    financialLabel: {
        fontSize: "12px",
        color: "#666",
        marginBottom: "8px",
        fontWeight: 500,
    },
    financialValue: {
        fontSize: "24px",
        fontWeight: 700,
        color: "#1a1a1a",
        marginBottom: "4px",
    },
    financialNote: {
        fontSize: "12px",
        color: "#999",
    },
    progressBar: {
        height: "8px",
        background: "#f0f0f0",
        borderRadius: "4px",
        overflow: "hidden",
        marginTop: "12px",
    },
    progressFill: {
        height: "100%",
        background: "#2563eb",
        borderRadius: "4px",
        transition: "width 0.3s ease",
    },
    progressText: {
        fontSize: "13px",
        color: "#666",
        marginTop: "8px",
    },
    tokenInfo: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px",
        background: "#f8f9fa",
        borderRadius: "4px",
        marginBottom: "16px",
    },
    tokenAddress: {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#1a1a1a",
        flex: 1,
    },
    verifiedBadge: {
        padding: "4px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 600,
        background: "#dcfce7",
        color: "#15803d",
    },
    iconButton: {
        padding: "6px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: "#666",
        fontSize: "14px",
    },
    healthFactor: {
        padding: "12px",
        background: "#f0fdf4",
        border: "1px solid #86efac",
        borderRadius: "4px",
    },
    healthFactorLabel: {
        fontSize: "12px",
        color: "#666",
        marginBottom: "4px",
    },
    healthFactorValue: {
        fontSize: "20px",
        fontWeight: 700,
        color: "#15803d",
    },
    healthFactorStatus: {
        fontSize: "12px",
        color: "#15803d",
    marginTop: "4px",
        fontWeight: 500,
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
    riskItemLabel: {
        fontSize: "14px",
        color: "#666",
    },
    riskItemValue: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#1a1a1a",
    },
    riskItemValueDanger: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#dc2626",
    },
    contractLink: {
        fontSize: "13px",
        color: "#2563eb",
        textDecoration: "none",
        marginTop: "16px",
        display: "inline-block",
    },
    auditTrail: {
        listStyle: "none",
        padding: 0,
        margin: 0,
    },
    auditItem: {
        display: "flex",
        gap: "16px",
        padding: "16px 0",
        borderBottom: "1px solid #f0f0f0",
        position: "relative" as "relative",
    },
    auditTimeline: {
        position: "absolute" as "absolute",
        left: "6px",
        top: "24px",
        bottom: "-16px",
        width: "2px",
        background: "#e0e0e0",
    },
    auditDot: {
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        background: "#2563eb",
        border: "2px solid #ffffff",
        position: "relative" as "relative",
        zIndex: 1,
        flexShrink: 0,
    },
    auditContent: {
        flex: 1,
    },
    auditEvent: {
    fontSize: "14px",
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: "4px",
    },
    auditDescription: {
        fontSize: "13px",
        color: "#666",
        marginBottom: "8px",
    },
    auditTimestamp: {
        fontSize: "12px",
        color: "#999",
        marginBottom: "8px",
    },
    auditLink: {
        fontSize: "12px",
        color: "#2563eb",
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
    },
    warningBanner: {
        padding: "12px 16px",
        background: "rgba(249, 115, 22, 0.1)",
        border: "1px solid rgba(249, 115, 22, 0.3)",
        borderRadius: "4px",
        marginBottom: "24px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    warningText: {
        fontSize: "13px",
        color: "#f97316",
    },
    modalOverlay: {
        position: "fixed" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
    },
    modal: {
        background: "#ffffff",
        borderRadius: "8px",
        padding: "24px",
        maxWidth: "500px",
        width: "90%",
        maxHeight: "90vh",
        overflow: "auto",
    },
    modalHeader: {
        fontSize: "18px",
        fontWeight: 600,
        marginBottom: "20px",
        color: "#1a1a1a",
    },
    formGroup: {
        marginBottom: "16px",
    },
    formLabel: {
        display: "block",
        fontSize: "13px",
        fontWeight: 500,
        color: "#374151",
        marginBottom: "6px",
    },
    formInput: {
        width: "100%",
        padding: "8px 12px",
        fontSize: "14px",
        border: "1px solid #d1d5db",
        borderRadius: "4px",
        background: "#ffffff",
    },
    formSelect: {
        width: "100%",
        padding: "8px 12px",
        fontSize: "14px",
        border: "1px solid #d1d5db",
        borderRadius: "4px",
        background: "#ffffff",
    },
    modalActions: {
        display: "flex",
        gap: "12px",
        justifyContent: "flex-end",
        marginTop: "24px",
    },
    buttonPrimary: {
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#ffffff",
        background: "#2563eb",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
    },
    buttonSecondary: {
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#374151",
        background: "#f3f4f6",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
    },
    creditLineCard: {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "4px",
        padding: "20px",
        marginBottom: "24px",
    },
    creditLineTitle: {
        fontSize: "16px",
        fontWeight: 600,
        marginBottom: "16px",
        color: "#1a1a1a",
    },
    creditLineGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "16px",
    },
    creditLineItem: {
        display: "flex",
        flexDirection: "column" as const,
    },
    creditLineLabel: {
        fontSize: "12px",
        color: "#6b7280",
        marginBottom: "4px",
    },
    creditLineValue: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#1a1a1a",
    },
    recourseSection: {
        background: "#fff7ed",
        border: "1px solid #fed7aa",
        borderRadius: "4px",
        padding: "20px",
        marginBottom: "24px",
    },
    recourseTitle: {
        fontSize: "16px",
        fontWeight: 600,
        marginBottom: "12px",
        color: "#9a3412",
    },
    defaultSection: {
        background: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: "4px",
        padding: "20px",
        marginBottom: "24px",
    },
    defaultTitle: {
        fontSize: "16px",
        fontWeight: 600,
        marginBottom: "12px",
        color: "#991b1b",
    },
    paymentHistory: {
        marginTop: "16px",
    },
    paymentHistoryItem: {
        display: "flex",
        justifyContent: "space-between",
        padding: "12px",
        borderBottom: "1px solid #e5e7eb",
    },
};

export default function InvoiceDetailPage() {
    const params = useParams();
    const id = params?.id as string;
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    const { showToast } = useToast();
    
    const { data: inv, error, isLoading, mutate: mutateInvoice } = useSWR(
        id ? ["invoice-detail", id] : null,
        () => fetchInvoiceDetail(id)
    );

    const { data: companies } = useSWR<Company[]>(
        "companies",
        () => fetchCompanies(),
    );

    const { data: invoiceTruth, mutate: mutateTruth } = useSWR<InvoiceTruth>(
        id && inv && inv.invoiceIdOnChain ? ["invoice-truth", id] : null,
        () => fetchInvoiceTruth(id!),
        {
            refreshInterval: 10000,
            onError: () => {},
        }
    );

    // Fetch user role for admin checks
    const { data: userRole } = useSWR(
        address ? ['user-role', address] : null,
        () => fetchUserRole(address!),
    );

    // WebSocket connection for real-time updates
    const { subscribe: subscribeWS } = useInvoiceWebSocket(id);

    // State for modals and forms
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showRecourseModal, setShowRecourseModal] = useState(false);
    const [showDefaultModal, setShowDefaultModal] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        amount: "",
        currency: "TRY",
        paidAt: new Date().toISOString().split("T")[0],
        psp: "",
        transactionId: "",
    });
    const [recourseForm, setRecourseForm] = useState({
        amount: "",
    });
    const [defaultForm, setDefaultForm] = useState({
        reason: "",
    });
    const [loading, setLoading] = useState(false);
    const [positionData, setPositionData] = useState<any>(null);

    // Subscribe to WebSocket events
    React.useEffect(() => {
        const unsubscribePayment = subscribeWS('invoice.payment_recorded', () => {
            mutateInvoice();
            mutateTruth();
            showToast('success', 'Payment recorded');
        });

        const unsubscribeRecourse = subscribeWS('invoice.recourse_paid', () => {
            mutateInvoice();
            mutateTruth();
            showToast('success', 'Recourse payment successful');
        });

        const unsubscribeDefault = subscribeWS('invoice.default_declared', () => {
            mutateInvoice();
            mutateTruth();
            showToast('info', 'Invoice declared as default');
        });

        const unsubscribeStatus = subscribeWS('invoice.status_changed', () => {
            mutateInvoice();
            mutateTruth();
        });

        return () => {
            unsubscribePayment();
            unsubscribeRecourse();
            unsubscribeDefault();
            unsubscribeStatus();
        };
    }, [subscribeWS, mutateInvoice, mutateTruth, showToast]);

    // Fetch position data for financed invoices
    React.useEffect(() => {
        if (inv?.isFinanced && inv.invoiceIdOnChain && publicClient) {
            const fetchPosition = async () => {
                try {
                    const FinancingPool = Deployments.FinancingPool;
                    const position = await publicClient.readContract({
                        address: FinancingPool.address as `0x${string}`,
                        abi: FinancingPool.abi,
                        functionName: "getPosition",
                        args: [inv.invoiceIdOnChain as `0x${string}`],
                    }) as any;
                    // Position data may contain BigInt values, but creditLineInfo useMemo will handle conversion
                    setPositionData(position);
                } catch (e) {
                    console.error("Failed to fetch position:", e);
                }
            };
            fetchPosition();
            const interval = setInterval(fetchPosition, 10000);
            return () => clearInterval(interval);
        } else {
            // Clear position data when invoice is not financed
            setPositionData(null);
        }
    }, [inv?.isFinanced, inv?.invoiceIdOnChain, publicClient]);

    // Company lookup
    const issuerCompany = useMemo(() => {
        if (!companies || !inv) return null;
        return companies.find(c => c.id === inv.companyId);
    }, [companies, inv]);

    // Calculate days until maturity
    const daysUntilMaturity = useMemo(() => {
        if (!inv) return null;
        const dueDate = new Date(inv.dueDate);
        const now = new Date();
        const diffTime = dueDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }, [inv]);

    // Calculate repayment progress
    const repaymentProgress = useMemo(() => {
        if (!inv) return { paid: 0, total: 0, percentage: 0 };
        
        let paidAmount: number;
        let totalAmount: number;
        
        // Safely convert BigInt or string to number
        const safeToNumber = (value: any): number => {
            if (value === null || value === undefined) return 0;
            if (typeof value === 'bigint') return Number(value);
            if (typeof value === 'string') return Number(value) || 0;
            if (typeof value === 'number') return value;
            return Number(value.toString()) || 0;
        };
        
        if (inv.isFinanced && inv.usedCredit !== undefined) {
            const paidCents = safeToNumber(inv.cumulativePaid);
            const remainingDebtCents = safeToNumber(inv.usedCredit);
            const totalDebtCents = paidCents + remainingDebtCents;
            paidAmount = paidCents / 100;
            totalAmount = totalDebtCents / 100;
        } else {
            const paidCents = safeToNumber(inv.cumulativePaid);
            const invoiceAmount = safeToNumber(inv.amount);
            paidAmount = paidCents / 100;
            totalAmount = invoiceAmount;
        }
        
        const percentage = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;
        return { paid: paidAmount, total: totalAmount, percentage };
    }, [inv]);

    // Get status badge style
    const getStatusBadgeStyle = (status: string) => {
        const color = statusColor(status);
        return {
            ...styles.statusBadge,
            background: color === "#0ea5e9" ? "#e0f2fe" :
                       color === "#a855f7" ? "#f3e8ff" :
                       color === "#22c55e" ? "#dcfce7" :
                       color === "#16a34a" ? "#f0fdf4" :
                       color === "#ef4444" ? "#fee2e2" :
                       "#f5f5f5",
            color: color === "#0ea5e9" ? "#0369a1" :
                   color === "#a855f7" ? "#7c3aed" :
                   color === "#22c55e" ? "#16a34a" :
                   color === "#16a34a" ? "#15803d" :
                   color === "#ef4444" ? "#dc2626" :
                   "#666",
        };
    };

    // Get company initials
    const getCompanyInitials = (companyId: string, company?: Company | null) => {
        if (company?.name) {
            return company.name
                .split(" ")
                .map(word => word[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
        }
        return companyId.slice(0, 2).toUpperCase();
    };

    // Copy to clipboard
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // Handler functions
    const handleRecordPayment = async () => {
        if (!address || !paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
            showToast('error', 'Please enter a valid amount');
            return;
        }
        try {
            setLoading(true);
            await recordPayment(id, {
                amount: paymentForm.amount,
                currency: paymentForm.currency,
                paidAt: new Date(paymentForm.paidAt).toISOString(),
                psp: paymentForm.psp || undefined,
                transactionId: paymentForm.transactionId || undefined,
            }, address);
            setShowPaymentModal(false);
            setPaymentForm({
                amount: "",
                currency: "TRY",
                paidAt: new Date().toISOString().split("T")[0],
                psp: "",
                transactionId: "",
            });
            await mutateInvoice();
        } catch (e: any) {
            showToast('error', e.message || 'Failed to record payment');
        } finally {
            setLoading(false);
        }
    };

    const handlePayRecourse = async () => {
        if (!address || !recourseForm.amount || parseFloat(recourseForm.amount) <= 0) {
            showToast('error', 'Please enter a valid amount');
            return;
        }
        try {
            setLoading(true);
            await payRecourse(id, {
                amount: recourseForm.amount,
            }, address);
            setShowRecourseModal(false);
            setRecourseForm({ amount: "" });
            await mutateInvoice();
        } catch (e: any) {
            showToast('error', e.message || 'Failed to pay recourse');
        } finally {
            setLoading(false);
        }
    };

    // Finance Handler
    const handleFinance = async () => {
        if (!address || !publicClient || !inv) {
            showToast('error', 'Please connect your wallet first');
            return;
        }
        if (!inv.tokenId || !inv.invoiceIdOnChain) {
            showToast('error', 'Invoice must be tokenized first');
            return;
        }
        try {
            setLoading(true);
            showToast('info', 'Starting finance process...');

            const pool = Deployments.FinancingPool;
            const token = Deployments.InvoiceToken;
            const poolAddress = pool.address as `0x${string}`;

            // Step 1: Check approval
            let isApproved = await publicClient.readContract({
                address: token.address as `0x${string}`,
                abi: token.abi,
                functionName: "isApprovedForAll",
                args: [address, poolAddress]
            }) as boolean;

            if (!isApproved) {
                showToast('info', 'Step 1/4: Approving token...');
                const tx = await writeContractAsync({
                    address: token.address as `0x${string}`,
                    abi: token.abi,
                    functionName: "setApprovalForAll",
                    args: [poolAddress, true]
                });
                await publicClient.waitForTransactionReceipt({ hash: tx });
                showToast('success', 'Token approved');
            }

            // Step 2: Check ownership and lock
            let owner: string;
            try {
                owner = await publicClient.readContract({
                    address: token.address as `0x${string}`,
                    abi: token.abi,
                    functionName: "ownerOf",
                    args: [BigInt(inv.tokenId)]
                }) as string;
            } catch (err: any) {
                showToast('error', 'Token not found on-chain');
                return;
            }

            if (owner.toLowerCase() === address.toLowerCase()) {
                showToast('info', 'Step 2/4: Locking collateral...');
                const POOL_ABI_MINIMAL = [
                    {
                        "inputs": [
                            { "internalType": "bytes32", "name": "invoiceId", "type": "bytes32" },
                            { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
                            { "internalType": "address", "name": "company", "type": "address" }
                        ],
                        "name": "lockCollateral",
                        "outputs": [],
                        "stateMutability": "nonpayable",
                        "type": "function"
                    }
                ];

                const tx = await writeContractAsync({
                    address: poolAddress,
                    abi: POOL_ABI_MINIMAL,
                    functionName: "lockCollateral",
                    args: [inv.invoiceIdOnChain as `0x${string}`, BigInt(inv.tokenId), address]
                });

                await publicClient.waitForTransactionReceipt({ hash: tx });
                showToast('success', 'Collateral locked');
                owner = poolAddress;
            }

            // Step 3: Draw credit
            if (owner.toLowerCase() === poolAddress.toLowerCase()) {
                showToast('info', 'Step 3/4: Drawing credit...');
                
                // Check pool liquidity first
                const poolAvailableLiquidity = await publicClient.readContract({
                    address: poolAddress,
                    abi: pool.abi,
                    functionName: "availableLiquidity",
                }) as bigint;
                
                const position = await publicClient.readContract({
                    address: poolAddress,
                    abi: pool.abi,
                    functionName: "getPosition",
                    args: [inv.invoiceIdOnChain as `0x${string}`]
                }) as any;

                const maxCreditLine = position.maxCreditLine as bigint;
                const currentUsedCredit = position.usedCredit as bigint;
                const availableCredit = maxCreditLine - currentUsedCredit;
                
                // Check if pool has enough liquidity
                if (poolAvailableLiquidity <= 0n) {
                    showToast('error', `Pool has no available liquidity. Please add liquidity via LP Dashboard.`);
                    setLoading(false);
                    return;
                }
                
                // Check if invoice has available credit line
                if (availableCredit <= 0n) {
                    // Safely convert BigInt to number, then divide by 100
                    const maxCreditNum = Number(maxCreditLine) / 100;
                    const usedCreditNum = Number(currentUsedCredit) / 100;
                    showToast('error', `No available credit line for this invoice. Max credit: ${formatAmount(maxCreditNum, inv.currency || "TRY")}, Used: ${formatAmount(usedCreditNum, inv.currency || "TRY")}`);
                    setLoading(false);
                    return;
                }
                
                // Use the minimum of available credit and pool liquidity
                const creditToDraw = availableCredit > poolAvailableLiquidity 
                    ? poolAvailableLiquidity 
                    : availableCredit;
                
                if (creditToDraw <= 0n) {
                    // Safely convert BigInt to number, then divide by 100
                    const poolLiquidityNum = Number(poolAvailableLiquidity) / 100;
                    showToast('error', `Cannot draw credit: Pool liquidity (${formatAmount(poolLiquidityNum, inv.currency || "TRY")}) is insufficient.`);
                    setLoading(false);
                    return;
                }

                const POOL_ABI_DRAW = [
                    {
                        "inputs": [
                            { "internalType": "bytes32", "name": "invoiceId", "type": "bytes32" },
                            { "internalType": "uint256", "name": "amount", "type": "uint256" },
                            { "internalType": "address", "name": "to", "type": "address" }
                        ],
                        "name": "drawCredit",
                        "outputs": [],
                        "stateMutability": "nonpayable",
                        "type": "function"
                    }
                ];

                const tx = await writeContractAsync({
                    address: poolAddress,
                    abi: POOL_ABI_DRAW,
                    functionName: "drawCredit",
                    args: [inv.invoiceIdOnChain as `0x${string}`, creditToDraw, address]
                });

                const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

                // Step 4: Notify backend
                showToast('info', 'Step 4/4: Notifying backend...');
                try {
                    await requestFinancing(
                        inv.id, 
                        address, 
                        receipt.transactionHash,
                        creditToDraw.toString()
                    );
                    // Convert BigInt to number safely, then divide by 100
                    const creditDrawnNumber = Number(creditToDraw) / 100;
                    showToast('success', `Credit drawn successfully! Amount: ${formatAmount(creditDrawnNumber, inv.currency || "TRY")}`);
                    await mutateInvoice();
                    await mutateTruth();
                } catch (backendError: any) {
                    console.error('[Finance] Backend notification failed:', backendError);
                    showToast('warning', 'Credit drawn on-chain, but backend sync failed. Please refresh.');
                }
            }
        } catch (e: any) {
            console.error('[Finance] Error:', e);
            showToast('error', e?.message ?? "Financing failed");
        } finally {
            setLoading(false);
        }
    };

    const handleDeclareDefault = async () => {
        if (!address || !userRole?.isAdmin) {
            showToast('error', 'Admin access required');
            return;
        }
        try {
            setLoading(true);
            await declareDefault(id, {
                reason: defaultForm.reason || undefined,
            }, address);
            setShowDefaultModal(false);
            setDefaultForm({ reason: "" });
            await mutateInvoice();
        } catch (e: any) {
            showToast('error', e.message || 'Failed to declare default');
        } finally {
            setLoading(false);
        }
    };

    // Calculate credit line info
    const creditLineInfo = useMemo(() => {
        if (!positionData || !inv) return null;
        
        // Safely convert BigInt values to numbers - CRITICAL: Must ensure all are numbers
        const safeToNumber = (value: any): number => {
            if (value === null || value === undefined) return 0;
            if (typeof value === 'bigint') return Number(value);
            if (typeof value === 'string') {
                const parsed = Number(value);
                return isNaN(parsed) ? 0 : parsed;
            }
            if (typeof value === 'number') {
                return isNaN(value) ? 0 : value;
            }
            try {
                const parsed = Number(value.toString());
                return isNaN(parsed) ? 0 : parsed;
            } catch {
                return 0;
            }
        };
        
        // Convert all values to numbers explicitly
        const maxCreditLineNum = safeToNumber(positionData.maxCreditLine) / 100;
        const usedCreditNum = safeToNumber(positionData.usedCredit) / 100;
        const interestAccruedNum = safeToNumber(positionData.interestAccrued) / 100;
        const availableCreditNum = maxCreditLineNum - usedCreditNum;
        const ltvBpsNum = safeToNumber(positionData.ltvBps);
        const recourseModeNum = safeToNumber(positionData.recourseMode || "1"); // 0 = RECOURSE, 1 = NON_RECOURSE
        const isInDefaultBool = Boolean(positionData.isInDefault || false);
        const graceEndsAtStr = positionData.graceEndsAt ? String(safeToNumber(positionData.graceEndsAt)) : "0";
        const totalDebtNum = usedCreditNum + interestAccruedNum;
        
        // Ensure all values are primitive numbers/booleans/strings (not BigInt)
        return {
            maxCreditLine: Number(maxCreditLineNum),
            usedCredit: Number(usedCreditNum),
            interestAccrued: Number(interestAccruedNum),
            availableCredit: Number(availableCreditNum),
            ltvBps: Number(ltvBpsNum),
            recourseMode: Number(recourseModeNum),
            isInDefault: Boolean(isInDefaultBool),
            graceEndsAt: String(graceEndsAtStr),
            totalDebt: Number(totalDebtNum),
        };
    }, [positionData, inv]);

    // Calculate recourse obligation
    const recourseObligation = useMemo(() => {
        if (!creditLineInfo || creditLineInfo.recourseMode !== 0 || !creditLineInfo.isInDefault) {
            return null;
        }
        // Ensure totalDebt is a number, not BigInt
        return Number(creditLineInfo.totalDebt);
    }, [creditLineInfo]);

    // Build audit trail from invoice data
    const auditTrail = useMemo(() => {
        if (!inv) return [];
        
        const trail = [];
        
        // Invoice Issued
        trail.push({
            event: "Invoice Issued",
            description: `Invoice ${inv.externalId} was created and issued.`,
            timestamp: inv.createdAt,
            link: null,
        });
        
        // Invoice Tokenized
        if ((inv.status as string) === "TOKENIZED" || (inv.status as string) === "FINANCED" || inv.isFinanced) {
            trail.push({
                event: "Invoice Tokenized",
                description: `Invoice #${inv.externalId} minted as NFT on-chain.`,
                timestamp: inv.updatedAt,
                link: inv.invoiceIdOnChain ? `https://sepolia.basescan.org/tx/${inv.invoiceIdOnChain}` : null,
            });
        }
        
        // Collateral Locked
        if (inv.isFinanced && inv.invoiceIdOnChain) {
            trail.push({
                event: "Collateral Locked",
                description: "Asset token locked in smart contract vault.",
                timestamp: inv.updatedAt,
                link: inv.invoiceIdOnChain ? `https://sepolia.basescan.org/address/${Deployments.FinancingPool.address}` : null,
            });
        }
        
        // Financing Disbursed
        if (inv.isFinanced) {
            trail.push({
                event: "Financing Disbursed",
                description: "Funds released to issuer wallet. Financing active.",
                timestamp: inv.updatedAt,
                link: inv.invoiceIdOnChain ? `https://sepolia.basescan.org/tx/${inv.invoiceIdOnChain}` : null,
            });
        }
        
        // Payments
        if (inv.payments && inv.payments.length > 0) {
            inv.payments.forEach((payment: any) => {
                trail.push({
                    event: payment.amount === repaymentProgress.total ? "Full Repayment Received" : "Partial Repayment Received",
                    description: `A repayment of ${formatAmount(payment.amount, payment.currency)} was processed successfully.`,
                    timestamp: payment.paidAt,
                    link: null,
                });
            });
        }
        
        // Sort by timestamp (newest first)
        return trail.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [inv, repaymentProgress]);

    if (isLoading) {
        return (
            <div style={styles.page}>
                <div style={styles.container}>
                    <p style={{ padding: "60px", textAlign: "center", color: "#666" }}>Loading invoice...</p>
                </div>
            </div>
        );
    }

    if (error || !inv) {
        return (
            <div style={styles.page}>
                <div style={styles.container}>
                    <p style={{ padding: "60px", textAlign: "center", color: "#dc2626" }}>Failed to load invoice detail.</p>
                </div>
            </div>
        );
    }

    const pathname = usePathname();

    return (
        <div style={styles.page}>
            {/* Top Navbar */}
            <nav style={styles.navbar}>
                <div style={styles.navLeft}>
                    <div style={styles.navTitle}>TIFA Dashboard</div>
                    <div style={styles.navLinks}>
                        <Link href="/overview" style={{ ...styles.navLink, ...(pathname === "/overview" ? styles.navLinkActive : {}) }}>
                            Overview
                        </Link>
                        <Link href="/invoices" style={{ ...styles.navLink, ...(pathname?.startsWith("/invoices") ? styles.navLinkActive : {}) }}>
                            Invoices
                        </Link>
                        <Link href="/lp" style={{ ...styles.navLink, ...(pathname === "/lp" ? styles.navLinkActive : {}) }}>
                            LP Dashboard
                        </Link>
                        <Link href="/analytics" style={{ ...styles.navLink, ...(pathname === "/analytics" ? styles.navLinkActive : {}) }}>
                            Analytics
                        </Link>
                        <Link href="/agent" style={{ ...styles.navLink, ...(pathname === "/agent" ? styles.navLinkActive : {}) }}>
                            Agent Console
                        </Link>
                    </div>
                </div>
                <div style={styles.navRight}>
                    <ConnectButton />
                </div>
            </nav>

            <div style={styles.container}>
                {/* Breadcrumb */}
                <div style={styles.breadcrumb}>
                    <Link href="/invoices" style={styles.breadcrumbLink}>Invoices</Link>
                    <span style={styles.breadcrumbSeparator}>/</span>
                    <span>{inv.externalId}</span>
                </div>

                {/* Warning Banner */}
                {invoiceTruth?.dbOutOfSync && (
                    <div style={styles.warningBanner}>
                        <span>⚠️</span>
                        <div style={styles.warningText}>
                            <strong>Backend Cache Out of Sync:</strong> Backend database differs from on-chain state. Showing on-chain status.
                        </div>
                    </div>
                )}

                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        <h1 style={styles.invoiceTitle}>{inv.externalId}</h1>
                        <div style={styles.invoiceSubtitle}>
                            Issued by {issuerCompany?.name || inv.companyId}
                            {daysUntilMaturity !== null && (
                                <>
                                    {" • "}
                                    Due {formatDate(inv.dueDate)}
                                    {daysUntilMaturity > 0 && ` (${daysUntilMaturity} days left)`}
                                    {daysUntilMaturity <= 0 && " (Overdue)"}
                                </>
                            )}
                        </div>
                        <span style={getStatusBadgeStyle(inv.status)}>
                            {inv.status}
                        </span>
                    </div>
                    <div style={styles.headerActions}>
                        <button style={styles.buttonSecondary}>
                            <span>📥</span>
                            <span>Download PDF</span>
                        </button>
                        {(inv.status as string) === "TOKENIZED" && !inv.isFinanced && (
                            <button 
                                style={styles.buttonPrimary}
                                onClick={handleFinance}
                                disabled={loading || !address}
                            >
                                <span>✓</span>
                                <span>{loading ? "Processing..." : "Approve Financing"}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Summary Cards */}
                <div style={styles.summaryCards}>
                    <div style={styles.summaryCard}>
                        <div style={styles.summaryCardLabel}>Issuer</div>
                        <div style={styles.summaryCardAvatar}>
                            {getCompanyInitials(inv.companyId, issuerCompany)}
                        </div>
                        <div style={styles.summaryCardValue}>
                            {issuerCompany?.name || inv.companyId}
                        </div>
                    </div>
                    <div style={styles.summaryCard}>
                        <div style={styles.summaryCardLabel}>Counterparty</div>
                        <div style={styles.summaryCardAvatar}>
                            {inv.debtorId.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={styles.summaryCardValue}>
                            {inv.debtorId}
                            </div>
                        <div style={styles.summaryCardMeta}>Debtor</div>
                            </div>
                    <div style={styles.summaryCard}>
                        <div style={styles.summaryCardLabel}>Face Value</div>
                        <div style={styles.summaryCardValue}>
                            {formatAmount(inv.amount, inv.currency || "TRY")}
                            </div>
                            </div>
                    <div style={styles.summaryCard}>
                        <div style={styles.summaryCardLabel}>Maturity Date</div>
                        <div style={styles.summaryCardValue}>
                            {formatDate(inv.dueDate)}
                        </div>
                        {daysUntilMaturity !== null && (
                            <div style={{
                                ...styles.summaryCardMeta,
                                color: daysUntilMaturity <= 7 ? "#f97316" : "#666",
                                fontWeight: daysUntilMaturity <= 7 ? 600 : 400,
                            }}>
                                {daysUntilMaturity > 0 ? `${daysUntilMaturity} days left` : "Overdue"}
                            </div>
                        )}
                    </div>
                </div>

                {/* Financial State Section */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <span style={styles.sectionIcon}>$</span>
                        <h2 style={styles.sectionTitle}>Financial State</h2>
                    </div>
                    <div style={styles.financialGrid}>
                            <div>
                            <div style={styles.financialItem}>
                                <div style={styles.financialLabel}>Principal Outstanding</div>
                                <div style={styles.financialValue}>
                                    {inv.isFinanced && inv.usedCredit
                                        ? (() => {
                                            // Safely convert BigInt or number to number, then divide by 100
                                            const usedCreditNum = typeof inv.usedCredit === 'bigint' 
                                                ? Number(inv.usedCredit) 
                                                : Number(inv.usedCredit || 0);
                                            return formatAmount(usedCreditNum / 100, inv.currency || "TRY");
                                        })()
                                        : formatAmount(inv.amount, inv.currency || "TRY")}
                                </div>
                                {inv.payments && inv.payments.length > 0 && (
                                    <div style={styles.financialNote}>
                                        ↓ {formatAmount(inv.payments[inv.payments.length - 1].amount, inv.currency || "TRY")} paid recently
                                    </div>
                                )}
                            </div>
                            {inv.isFinanced && (
                                <div style={styles.financialItem}>
                                    <div style={styles.financialLabel}>Accrued Interest</div>
                                    <div style={{ ...styles.financialValue, color: "#f97316" }}>
                                        {/* TODO: Fetch from contract */}
                                        {formatAmount("0", inv.currency || "TRY")}
                                    </div>
                                    <div style={styles.financialNote}>
                                        + $20.50 daily rate
                                    </div>
                                </div>
                            )}
                            <div style={styles.financialItem}>
                                <div style={styles.financialLabel}>Repayment Progress</div>
                                <div style={styles.progressBar}>
                                    <div style={{ ...styles.progressFill, width: `${repaymentProgress.percentage}%` }}></div>
                                </div>
                                <div style={styles.progressText}>
                                    {formatAmount(repaymentProgress.paid, inv.currency || "TRY")} Repaid
                                    {" / "}
                                    {formatAmount(repaymentProgress.total, inv.currency || "TRY")} Total
                                </div>
                            </div>
                        </div>
                        <div>
                            {inv.invoiceIdOnChain && (
                                <div style={styles.financialItem}>
                                    <div style={styles.financialLabel}>Token Identification</div>
                                    <div style={styles.tokenInfo}>
                                        <span style={styles.tokenAddress}>
                                            {inv.invoiceIdOnChain.slice(0, 6)}...{inv.invoiceIdOnChain.slice(-4)}
                                        </span>
                                        <span style={styles.verifiedBadge}>VERIFIED</span>
                                        <button
                                            style={styles.iconButton}
                                            onClick={() => copyToClipboard(inv.invoiceIdOnChain!)}
                                            title="Copy address"
                                        >
                                            📋
                                        </button>
                                        <a
                                            href={`https://sepolia.basescan.org/address/${inv.invoiceIdOnChain}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={styles.iconButton}
                                            title="View on BaseScan"
                                        >
                                            🔗
                                        </a>
                                    </div>
                                </div>
                            )}
                            {inv.isFinanced && (
                                <div style={styles.financialItem}>
                                    <div style={styles.financialLabel}>Collateral Health</div>
                                    <div style={styles.healthFactor}>
                                        <div style={styles.healthFactorLabel}>Current Valuation</div>
                                        <div style={styles.healthFactorValue}>
                                            {formatAmount(inv.amount, inv.currency || "TRY")}
                                        </div>
                                        <div style={styles.healthFactorLabel}>Health Factor</div>
                                        <div style={styles.healthFactorValue}>1.25</div>
                                        <div style={styles.healthFactorStatus}>Safe</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Credit Line Management Section */}
                {inv.isFinanced && creditLineInfo && (
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <span style={styles.sectionIcon}>💳</span>
                            <h2 style={styles.sectionTitle}>Credit Line Management</h2>
                        </div>
                        <div style={styles.creditLineCard}>
                            <div style={styles.creditLineGrid}>
                                <div style={styles.creditLineItem}>
                                    <div style={styles.creditLineLabel}>Max Credit Line</div>
                                    <div style={styles.creditLineValue}>
                                        {formatAmount(Number(creditLineInfo.maxCreditLine), inv.currency || "TRY")}
                                    </div>
                                </div>
                                <div style={styles.creditLineItem}>
                                    <div style={styles.creditLineLabel}>Used Credit</div>
                                    <div style={{ ...styles.creditLineValue, color: "#dc2626" }}>
                                        {formatAmount(Number(creditLineInfo.usedCredit), inv.currency || "TRY")}
                                    </div>
                                </div>
                                <div style={styles.creditLineItem}>
                                    <div style={styles.creditLineLabel}>Available Credit</div>
                                    <div style={{ ...styles.creditLineValue, color: "#16a34a" }}>
                                        {formatAmount(Math.max(0, Number(creditLineInfo.availableCredit)), inv.currency || "TRY")}
                                    </div>
                                </div>
                                <div style={styles.creditLineItem}>
                                    <div style={styles.creditLineLabel}>LTV Ratio</div>
                                    <div style={styles.creditLineValue}>
                                        {(Number(creditLineInfo.ltvBps) / 100).toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                            {Number(creditLineInfo.interestAccrued) > 0 && (
                                <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e5e7eb" }}>
                                    <div style={styles.creditLineLabel}>Accrued Interest</div>
                                    <div style={{ ...styles.creditLineValue, color: "#f97316" }}>
                                        {formatAmount(Number(creditLineInfo.interestAccrued), inv.currency || "TRY")}
                                    </div>
                                </div>
                            )}
                            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e5e7eb" }}>
                                <div style={styles.creditLineLabel}>Total Debt</div>
                                <div style={{ ...styles.creditLineValue, color: "#dc2626" }}>
                                    {formatAmount(Number(creditLineInfo.totalDebt), inv.currency || "TRY")}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Recourse Payment Section */}
                {creditLineInfo && creditLineInfo.recourseMode === 0 && creditLineInfo.isInDefault && recourseObligation && (
                    <div style={styles.recourseSection}>
                        <div style={styles.recourseTitle}>Recourse Payment Required</div>
                        <div style={{ marginBottom: "16px", fontSize: "14px", color: "#7c2d12" }}>
                            This invoice is in RECOURSE mode and has been declared in default. You are required to pay the recourse obligation.
                        </div>
                        <div style={{ marginBottom: "16px" }}>
                            <div style={styles.creditLineLabel}>Recourse Obligation</div>
                            <div style={{ ...styles.creditLineValue, color: "#dc2626" }}>
                                {formatAmount(Number(recourseObligation), inv.currency || "TRY")}
                            </div>
                        </div>
                        <button
                            style={styles.buttonPrimary}
                            onClick={() => setShowRecourseModal(true)}
                            disabled={loading || !address}
                        >
                            Pay Recourse
                        </button>
                    </div>
                )}

                {/* Payment Recording Section */}
                {inv.isFinanced && (
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <span style={styles.sectionIcon}>💰</span>
                            <h2 style={styles.sectionTitle}>Payment Recording</h2>
                        </div>
                        <button
                            style={styles.buttonPrimary}
                            onClick={() => setShowPaymentModal(true)}
                            disabled={loading || !address}
                        >
                            Record Payment
                        </button>
                        {inv.payments && inv.payments.length > 0 && (
                            <div style={styles.paymentHistory}>
                                <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", marginTop: "20px" }}>
                                    Payment History
                                </div>
                                {inv.payments.map((payment: any, index: number) => (
                                    <div key={index} style={styles.paymentHistoryItem}>
                                        <div>
                                            <div style={{ fontSize: "14px", fontWeight: 500 }}>
                                                {formatAmount(payment.amount, payment.currency)}
                                            </div>
                                            <div style={{ fontSize: "12px", color: "#6b7280" }}>
                                                {formatDate(payment.paidAt, true)}
                                                {payment.psp && ` • ${payment.psp}`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Default Handling Section (Admin Only) */}
                {userRole?.isAdmin && inv.isFinanced && creditLineInfo && (
                    <div style={styles.defaultSection}>
                        <div style={styles.defaultTitle}>Default Handling</div>
                        {creditLineInfo.isInDefault ? (
                            <div style={{ fontSize: "14px", color: "#991b1b", marginBottom: "12px" }}>
                                This invoice has been declared in default.
                            </div>
                        ) : (
                            <>
                                {creditLineInfo.graceEndsAt !== "0" && (
                                    <div style={{ fontSize: "14px", color: "#7c2d12", marginBottom: "12px" }}>
                                        Grace period ends: {new Date(parseInt(creditLineInfo.graceEndsAt) * 1000).toLocaleString()}
                                    </div>
                                )}
                                <button
                                    style={styles.buttonPrimary}
                                    onClick={() => setShowDefaultModal(true)}
                                    disabled={loading || !address || creditLineInfo.graceEndsAt === "0"}
                                >
                                    Declare Default
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Risk & Terms Section */}
                {inv.isFinanced && (
                    <InvoiceRiskPanel invoice={inv} />
                )}

                {/* Audit Trail */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <span style={styles.sectionIcon}>🕐</span>
                        <h2 style={styles.sectionTitle}>Audit Trail</h2>
                    </div>
                    <ul style={styles.auditTrail}>
                        {auditTrail.map((item, index) => (
                            <li key={index} style={styles.auditItem}>
                                {index < auditTrail.length - 1 && <div style={styles.auditTimeline}></div>}
                                <div style={styles.auditDot}></div>
                                <div style={styles.auditContent}>
                                    <div style={styles.auditEvent}>{item.event}</div>
                                    <div style={styles.auditDescription}>{item.description}</div>
                                    <div style={styles.auditTimestamp}>
                                        {formatDate(item.timestamp, true)} UTC
                                    </div>
                                    {item.link && (
                                        <a
                                            href={item.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={styles.auditLink}
                                        >
                                            View Transaction <span>↗</span>
                                        </a>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Payment Recording Modal */}
            {showPaymentModal && (
                <div style={styles.modalOverlay} onClick={() => !loading && setShowPaymentModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>Record Payment</div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Amount</label>
                            <input
                                type="number"
                                style={styles.formInput}
                                value={paymentForm.amount}
                                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Currency</label>
                            <select
                                style={styles.formSelect}
                                value={paymentForm.currency}
                                onChange={(e) => setPaymentForm({ ...paymentForm, currency: e.target.value })}
                            >
                                <option value="TRY">TRY</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Payment Date</label>
                            <input
                                type="date"
                                style={styles.formInput}
                                value={paymentForm.paidAt}
                                onChange={(e) => setPaymentForm({ ...paymentForm, paidAt: e.target.value })}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>PSP (Optional)</label>
                            <input
                                type="text"
                                style={styles.formInput}
                                value={paymentForm.psp}
                                onChange={(e) => setPaymentForm({ ...paymentForm, psp: e.target.value })}
                                placeholder="Payment Service Provider"
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Transaction ID (Optional)</label>
                            <input
                                type="text"
                                style={styles.formInput}
                                value={paymentForm.transactionId}
                                onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })}
                                placeholder="Transaction reference"
                            />
                        </div>
                        <div style={styles.modalActions}>
                            <button
                                style={styles.buttonSecondary}
                                onClick={() => setShowPaymentModal(false)}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                style={styles.buttonPrimary}
                                onClick={handleRecordPayment}
                                disabled={loading || !paymentForm.amount}
                            >
                                {loading ? "Recording..." : "Record Payment"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recourse Payment Modal */}
            {showRecourseModal && (
                <div style={styles.modalOverlay} onClick={() => !loading && setShowRecourseModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>Pay Recourse Obligation</div>
                        <div style={{ marginBottom: "16px", fontSize: "14px", color: "#7c2d12" }}>
                            You are required to pay the recourse obligation for this invoice.
                            {recourseObligation && (
                                <div style={{ marginTop: "8px", fontWeight: 600 }}>
                                    Total Obligation: {formatAmount(recourseObligation, inv.currency || "TRY")}
                                </div>
                            )}
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Amount</label>
                            <input
                                type="number"
                                style={styles.formInput}
                                value={recourseForm.amount}
                                onChange={(e) => setRecourseForm({ ...recourseForm, amount: e.target.value })}
                                placeholder={recourseObligation !== null ? Number(recourseObligation).toFixed(2) : "0.00"}
                                step="0.01"
                                min="0"
                            />
                        </div>
                        <div style={styles.modalActions}>
                            <button
                                style={styles.buttonSecondary}
                                onClick={() => setShowRecourseModal(false)}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                style={styles.buttonPrimary}
                                onClick={handlePayRecourse}
                                disabled={loading || !recourseForm.amount}
                            >
                                {loading ? "Processing..." : "Pay Recourse"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Default Declaration Modal */}
            {showDefaultModal && (
                <div style={styles.modalOverlay} onClick={() => !loading && setShowDefaultModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>Declare Default</div>
                        <div style={{ marginBottom: "16px", fontSize: "14px", color: "#991b1b" }}>
                            This action will mark the invoice as defaulted. This cannot be undone.
                            {creditLineInfo && (
                                <div style={{ marginTop: "8px" }}>
                                    Total Debt: {formatAmount(creditLineInfo.totalDebt, inv.currency || "TRY")}
                                </div>
                            )}
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Reason (Optional)</label>
                            <textarea
                                style={{ ...styles.formInput, minHeight: "80px", resize: "vertical" as const }}
                                value={defaultForm.reason}
                                onChange={(e) => setDefaultForm({ ...defaultForm, reason: e.target.value })}
                                placeholder="Reason for default declaration"
                            />
                        </div>
                        <div style={styles.modalActions}>
                            <button
                                style={styles.buttonSecondary}
                                onClick={() => setShowDefaultModal(false)}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                style={{ ...styles.buttonPrimary, background: "#dc2626" }}
                                onClick={handleDeclareDefault}
                                disabled={loading}
                            >
                                {loading ? "Declaring..." : "Declare Default"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
