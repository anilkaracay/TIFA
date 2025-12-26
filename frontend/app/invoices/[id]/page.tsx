"use client";

import React, { useMemo, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import Navbar from "../../../components/Navbar";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useTransactionManager } from "../../../lib/transactionManager";
import { fetchInvoiceDetail, fetchInvoiceTruth, InvoiceTruth, recordPayment, payRecourse, declareDefault, requestFinancing, notifyRepayment } from "../../../lib/backendClient";
import { fetchCompanies, Company } from "../../../lib/companyClient";
import { formatAmount, formatDate, statusColor } from "../../../lib/format";
import Deployments from "../../../lib/deployments.json";
import { InvoiceRiskPanel } from "../../../components/invoice/InvoiceRiskPanel";
import { useInvoiceWebSocket } from "../../../lib/websocketClient";
import { useToast } from "../../../components/Toast";
import { fetchUserRole } from "../../../lib/backendClient";
import { X402PaymentButton } from "../../../components/invoice/X402PaymentButton";

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
        marginBottom: "24px",
        paddingBottom: "16px",
        borderBottom: "1px solid #e5e7eb",
    },
    sectionTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#1a1a1a",
        margin: 0,
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
    // Financial Control Surface Styles
    financialControlSurface: {
        background: "#1e293b", // deep navy
        borderRadius: "8px",
        border: "1px solid #334155",
        padding: "24px",
        marginBottom: "24px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    },
    fcsHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: "16px",
        borderBottom: "1px solid #334155",
        marginBottom: "16px",
    },
    fcsHeaderLeft: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    fcsHeaderRight: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    fcsRiskLabel: {
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.5px",
        color: "#94a3b8",
        textTransform: "uppercase" as const,
    },
    fcsRiskBadgeContainer: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
    },
    fcsRiskBadge: {
        padding: "4px 12px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.5px",
        border: "1px solid",
        background: "transparent",
    },
    fcsInfoTooltip: {
        fontSize: "11px",
        color: "#64748b",
        cursor: "help",
        fontWeight: 600,
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        border: "1px solid #64748b",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: "1",
    },
    fcsStatusLabel: {
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.5px",
        color: "#94a3b8",
        textTransform: "uppercase" as const,
    },
    fcsStatusBadge: {
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.5px",
    },
    fcsAiStrip: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 12px",
        background: "rgba(59, 130, 246, 0.08)",
        borderRadius: "4px",
        marginBottom: "20px",
        border: "1px solid rgba(59, 130, 246, 0.15)",
    },
    fcsAiContent: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    fcsAiPulse: {
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: "#3b82f6",
        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
    },
    fcsAiText: {
        fontSize: "11px",
        color: "#cbd5e1",
        fontWeight: 500,
    },
    fcsAiTimestamp: {
        fontSize: "10px",
        color: "#94a3b8",
    },
    fcsFinancialState: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "32px",
        marginBottom: "24px",
    },
    fcsFinancialColumn: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "20px",
    },
    fcsFinancialMetric: {
        display: "flex",
        flexDirection: "column" as const,
    },
    fcsMetricLabel: {
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.5px",
        color: "#94a3b8",
        textTransform: "uppercase" as const,
        marginBottom: "6px",
    },
    fcsMetricValue: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#f1f5f9",
        lineHeight: "1.3",
    },
    fcsMetricNote: {
        fontSize: "11px",
        color: "#94a3b8",
        marginTop: "4px",
    },
    fcsActionLayer: {
        paddingTop: "20px",
        borderTop: "1px solid #334155",
    },
    fcsActionButtons: {
        display: "flex",
        gap: "12px",
        marginBottom: "12px",
    },
    fcsActionPrimary: {
        padding: "10px 20px",
        fontSize: "13px",
        fontWeight: 500,
        background: "#3b82f6",
        border: "none",
        borderRadius: "4px",
        color: "#ffffff",
        cursor: "pointer",
        transition: "0.2s",
    },
    fcsActionSecondary: {
        padding: "10px 20px",
        fontSize: "13px",
        fontWeight: 500,
        background: "transparent",
        border: "1px solid #475569",
        borderRadius: "4px",
        color: "#cbd5e1",
        cursor: "pointer",
        transition: "0.2s",
    },
    fcsActionWarning: {
        borderColor: "#f59e0b",
        color: "#fbbf24",
    },
    fcsWarningLine: {
        fontSize: "11px",
        color: "#f59e0b",
        marginBottom: "12px",
        paddingLeft: "12px",
        borderLeft: "2px solid #f59e0b",
    },
    fcsComplianceNote: {
        fontSize: "10px",
        color: "#64748b",
        fontStyle: "italic",
        marginTop: "8px",
    },
};

export default function InvoiceDetailPage() {
    const params = useParams();
    const id = params?.id as string;
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    const { showToast } = useToast();
    const { trackTransaction } = useTransactionManager();
    
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
    const [showRepayModal, setShowRepayModal] = useState(false);
    const [showFinanceModal, setShowFinanceModal] = useState(false);
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
    const [repayAmount, setRepayAmount] = useState("");
    const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null);
    const [currentDebt, setCurrentDebt] = useState<bigint>(0n);
    const [financeAmount, setFinanceAmount] = useState("");
    const [selectedFinancePercentage, setSelectedFinancePercentage] = useState<number | null>(null);
    const [availableCredit, setAvailableCredit] = useState<bigint>(0n);
    const [poolAvailableLiquidity, setPoolAvailableLiquidity] = useState<bigint>(0n);
    const [loading, setLoading] = useState(false);
    const [positionData, setPositionData] = useState<any>(null);
    const [repayments, setRepayments] = useState<Array<{ txHash: string; amount: string; timestamp: string }>>([]);

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
        if (!financeAmount || parseFloat(financeAmount) <= 0) {
            showToast('error', 'Please enter a valid amount');
            return;
        }
        
        // Convert amount to BigInt (amount is in human-readable format, multiply by 100)
        let amountToDraw = BigInt(Math.floor(parseFloat(financeAmount) * 100));
        
        // Validate amount
        if (amountToDraw > availableCredit) {
            showToast('error', `Amount exceeds available credit. Max: ${formatAmount((Number(availableCredit) / 100).toString(), inv.currency || "TRY")}`);
            return;
        }
        
        if (amountToDraw > poolAvailableLiquidity) {
            showToast('error', `Amount exceeds pool liquidity. Max: ${formatAmount((Number(poolAvailableLiquidity) / 100).toString(), inv.currency || "TRY")}`);
            return;
        }
        
        if (amountToDraw <= 0n) {
            showToast('error', 'Amount must be greater than zero');
            return;
        }
        
        try {
            setLoading(true);
            setShowFinanceModal(false);
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
                
                // Re-check position after lock (if it was just locked)
                const position = await publicClient.readContract({
                    address: poolAddress,
                    abi: pool.abi,
                    functionName: "getPosition",
                    args: [inv.invoiceIdOnChain as `0x${string}`]
                }) as any;

                const maxCreditLine = position.maxCreditLine as bigint;
                const currentUsedCredit = position.usedCredit as bigint;
                const availableCreditAfterLock = maxCreditLine - currentUsedCredit;
                
                // Validate amountToDraw against current position
                if (amountToDraw > availableCreditAfterLock) {
                    showToast('error', `Amount exceeds available credit line. Max: ${formatAmount((Number(availableCreditAfterLock) / 100).toString(), inv.currency || "TRY")}`);
                    setLoading(false);
                    return;
                }
                
                // Re-check pool liquidity
                const currentPoolLiquidity = await publicClient.readContract({
                    address: poolAddress,
                    abi: pool.abi,
                    functionName: "availableLiquidity",
                }) as bigint;
                
                if (amountToDraw > currentPoolLiquidity) {
                    showToast('error', `Amount exceeds pool liquidity. Available: ${formatAmount((Number(currentPoolLiquidity) / 100).toString(), inv.currency || "TRY")}`);
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
                    args: [inv.invoiceIdOnChain as `0x${string}`, amountToDraw, address]
                });

                const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

                // Step 4: Notify backend
                showToast('info', 'Step 4/4: Notifying backend...');
                try {
                    const backendResponse = await requestFinancing(
                        inv.id, 
                        address, 
                        receipt.transactionHash,
                        amountToDraw.toString()
                    );
                    
                    // Check if backend successfully processed the notification
                    if (backendResponse && (backendResponse.approved || backendResponse.invoiceId)) {
                        showToast('success', `Credit drawn successfully! Amount: ${formatAmount(financeAmount, inv.currency || "TRY")}`);
                        setFinanceAmount("");
                        setSelectedFinancePercentage(null);
                        await mutateInvoice();
                        await mutateTruth();
                    } else {
                        // Backend returned unexpected response, but transaction was successful
                        console.warn('[Finance] Backend returned unexpected response:', backendResponse);
                        showToast('success', `Credit drawn successfully! Amount: ${formatAmount(financeAmount, inv.currency || "TRY")}`);
                        setFinanceAmount("");
                        setSelectedFinancePercentage(null);
                        // Still refresh to get latest state
                        await mutateInvoice();
                        await mutateTruth();
                    }
                } catch (backendError: any) {
                    console.error('[Finance] Backend notification failed:', backendError);
                    
                    // Check if error is "Already financed" - this means backend already has the state
                    if (backendError.message && backendError.message.includes('Already financed')) {
                        console.log('[Finance] Invoice already financed in backend, refreshing state...');
                        showToast('success', `Credit drawn successfully! Amount: ${formatAmount(financeAmount, inv.currency || "TRY")}`);
                        setFinanceAmount("");
                        setSelectedFinancePercentage(null);
                        await mutateInvoice();
                        await mutateTruth();
                    } else {
                        // Real error - show warning but don't block user
                        console.warn('[Finance] Backend sync may have failed, but on-chain transaction was successful');
                        showToast('warning', `Credit drawn on-chain (${formatAmount(financeAmount, inv.currency || "TRY")}). Backend sync may be delayed.`);
                        setFinanceAmount("");
                        setSelectedFinancePercentage(null);
                        // Still refresh to get latest state
                        await mutateInvoice();
                        await mutateTruth();
                    }
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

    // Open Finance Modal
    const openFinanceModal = async () => {
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
            const pool = Deployments.FinancingPool;
            const poolAddress = pool.address as `0x${string}`;
            
            // Check pool liquidity
            const liquidity = await publicClient.readContract({
                address: poolAddress,
                abi: pool.abi,
                functionName: "availableLiquidity",
            }) as bigint;
            setPoolAvailableLiquidity(liquidity);
            
            // Get position (may not exist yet if not locked)
            let position: any = null;
            try {
                position = await publicClient.readContract({
                    address: poolAddress,
                    abi: pool.abi,
                    functionName: "getPosition",
                    args: [inv.invoiceIdOnChain]
                }) as any;
            } catch (e) {
                // Position may not exist yet, that's okay
            }
            
            let creditLine = 0n;
            let usedCredit = 0n;
            
            if (position && position.exists) {
                creditLine = position.maxCreditLine as bigint;
                usedCredit = position.usedCredit as bigint;
            } else {
                // If position doesn't exist yet, we'll need to estimate
                // For now, use invoice amount * 0.6 as estimate (will be set after lock)
                const invoiceAmount = BigInt(Math.floor(parseFloat(inv.amount || "0") * 100));
                creditLine = (invoiceAmount * 60n) / 100n; // 60% LTV estimate
            }
            
            const available = creditLine - usedCredit;
            const maxAvailable = available > liquidity ? liquidity : available;
            setAvailableCredit(maxAvailable > 0n ? maxAvailable : 0n);
            
            setFinanceAmount("");
            setSelectedFinancePercentage(null);
            setShowFinanceModal(true);
            setLoading(false);
        } catch (e: any) {
            console.error('[Finance] Error fetching credit info:', e);
            showToast('error', 'Error fetching credit information: ' + e.message);
            setLoading(false);
        }
    };

    // Open Repay Modal
    const openRepayModal = async () => {
        if (!address || !publicClient || !inv) {
            showToast('error', 'Please connect your wallet first');
            return;
        }
        if (!inv.invoiceIdOnChain || !inv.isFinanced) {
            showToast('error', 'Invoice must be financed to repay');
            return;
        }
        try {
            setLoading(true);
            const pool = Deployments.FinancingPool;
            const position = await publicClient.readContract({
                address: pool.address as `0x${string}`,
                abi: pool.abi,
                functionName: "getPosition",
                args: [inv.invoiceIdOnChain]
            }) as any;

            const debt = position.usedCredit as bigint;
            setCurrentDebt(debt);
            setRepayAmount("");
            setSelectedPercentage(null);
            setShowRepayModal(true);
            setLoading(false);
        } catch (e: any) {
            console.error('[Repay] Error fetching debt:', e);
            showToast('error', 'Error fetching debt: ' + e.message);
            setLoading(false);
        }
    };

    // Execute Repayment
    const executeRepayment = async () => {
        if (!inv || !repayAmount || !publicClient || !address) {
            showToast('error', 'Please enter a valid amount');
            return;
        }

        try {
            setLoading(true);
            const pool = Deployments.FinancingPool;
            const token = Deployments.TestToken;

            let amountToRepay = BigInt(Math.floor(parseFloat(repayAmount) * 100));

            if (amountToRepay > currentDebt) {
                amountToRepay = currentDebt;
                setRepayAmount((Number(currentDebt) / 100).toString());
                setSelectedPercentage(100);
                setLoading(false);
                return;
            }

            if (amountToRepay <= 0n) {
                setLoading(false);
                return;
            }

            setShowRepayModal(false);
            showToast('info', 'Step 1/2: Approving Payment Token...');

            // Check allowance
            const allowance = await publicClient.readContract({
                address: token.address as `0x${string}`,
                abi: token.abi,
                functionName: "allowance",
                args: [address, pool.address]
            }) as bigint;

            if (allowance < amountToRepay) {
                const approveTx = await writeContractAsync({
                    address: token.address as `0x${string}`,
                    abi: token.abi,
                    functionName: "approve",
                    args: [pool.address, amountToRepay]
                });
                trackTransaction(approveTx);
                await publicClient.waitForTransactionReceipt({ hash: approveTx });
            }

            // Repay
            showToast('info', 'Step 2/2: Repaying Credit...');
            const repayTx = await writeContractAsync({
                address: pool.address as `0x${string}`,
                abi: pool.abi,
                functionName: "repayCredit",
                args: [inv.invoiceIdOnChain, amountToRepay]
            });

            trackTransaction(repayTx);
            const receipt = await publicClient.waitForTransactionReceipt({ hash: repayTx });

            // Add repayment to state for Audit Trail
            setRepayments(prev => [...prev, {
                txHash: repayTx,
                amount: repayAmount,
                timestamp: new Date().toISOString(),
            }]);

            // Notify backend about repayment
            try {
                await notifyRepayment(id, {
                    txHash: repayTx,
                    amount: repayAmount,
                }, address);
            } catch (e: any) {
                console.error('[Repay] Backend notification failed:', e);
                // Don't show error to user, on-chain transaction succeeded
            }

            showToast('success', `Repayment successful! Amount: ${formatAmount(repayAmount, inv.currency || "TRY")}`);
            setRepayAmount("");
            setSelectedPercentage(null);
            
            // Refresh data
            await Promise.all([
                mutateInvoice(),
                mutateTruth(),
            ]);
            
            // Refresh position data
            if (inv.invoiceIdOnChain) {
                const pool = Deployments.FinancingPool;
                const position = await publicClient.readContract({
                    address: pool.address as `0x${string}`,
                    abi: pool.abi,
                    functionName: "getPosition",
                    args: [inv.invoiceIdOnChain]
                }) as any;
                setPositionData(position);
            }
        } catch (e: any) {
            console.error('[Repay] Error:', e);
            showToast('error', e?.message ?? "Repayment failed");
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
        const defaultDeclaredAtStr = positionData.defaultDeclaredAt && positionData.defaultDeclaredAt > 0n 
            ? String(safeToNumber(positionData.defaultDeclaredAt)) 
            : null;
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
            defaultDeclaredAt: defaultDeclaredAtStr,
            totalDebt: Number(totalDebtNum),
        };
    }, [positionData, inv]);

    // Calculate repayment progress (after creditLineInfo is defined)
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
        
        if (inv.isFinanced && creditLineInfo) {
            // For financed invoices:
            // - Paid = cumulativePaid (already paid amount)
            // - Current debt = usedCredit + interestAccrued (remaining debt)
            // - Total debt = current debt + paid = usedCredit + interestAccrued + cumulativePaid
            const paidCents = safeToNumber(inv.cumulativePaid);
            const usedCreditNum = Number(creditLineInfo.usedCredit) * 100; // Convert back to cents
            const interestAccruedNum = Number(creditLineInfo.interestAccrued) * 100; // Convert back to cents
            const currentDebtCents = usedCreditNum + interestAccruedNum;
            const totalDebtCents = currentDebtCents + paidCents; // Total = remaining + paid
            
            paidAmount = paidCents / 100;
            totalAmount = totalDebtCents / 100;
        } else if (inv.isFinanced && inv.usedCredit !== undefined) {
            // Fallback: use inv.usedCredit if creditLineInfo not available
            const paidCents = safeToNumber(inv.cumulativePaid);
            const remainingDebtCents = safeToNumber(inv.usedCredit);
            const totalDebtCents = remainingDebtCents + paidCents; // Total = remaining + paid
            
            paidAmount = paidCents / 100;
            totalAmount = totalDebtCents / 100;
        } else {
            // For non-financed invoices, use invoice amount
            const paidCents = safeToNumber(inv.cumulativePaid);
            const invoiceAmount = safeToNumber(inv.amount);
            paidAmount = paidCents / 100;
            totalAmount = invoiceAmount;
        }
        
        // Ensure paid doesn't exceed total
        paidAmount = Math.min(paidAmount, totalAmount);
        const percentage = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;
        return { paid: paidAmount, total: totalAmount, percentage };
    }, [inv, creditLineInfo]);

    // Calculate dynamic payment status based on repayment progress
    const paymentStatus = useMemo(() => {
        if (!inv || !repaymentProgress) return inv?.status || "pending";
        
        // If fully paid
        if (repaymentProgress.total > 0 && repaymentProgress.paid >= repaymentProgress.total) {
            return "PAID";
        }
        
        // If partially paid
        if (repaymentProgress.paid > 0 && repaymentProgress.paid < repaymentProgress.total) {
            return "PARTIALLY_PAID";
        }
        
        // Otherwise use invoice status
        return inv.status || "pending";
    }, [inv, repaymentProgress]);

    // Calculate recourse obligation
    const recourseObligation = useMemo(() => {
        if (!creditLineInfo || creditLineInfo.recourseMode !== 0 || !creditLineInfo.isInDefault) {
            return null;
        }
        // Ensure totalDebt is a number, not BigInt
        return Number(creditLineInfo.totalDebt);
    }, [creditLineInfo]);

    // Calculate timeline status (from InvoiceRiskPanel logic)
    const timelineStatus = useMemo(() => {
        if (!positionData) return null;

        const now = BigInt(Math.floor(Date.now() / 1000));
        const dueDate = positionData.dueDate;
        const graceEndsAt = positionData.graceEndsAt;

        if (positionData.isInDefault) {
            return { status: "defaulted", label: "Defaulted", color: "#ef4444" };
        }
        if (graceEndsAt > 0n && now < graceEndsAt) {
            return { status: "in_grace", label: "In Grace", color: "#f59e0b" };
        }
        if (dueDate > 0n && now >= dueDate) {
            return { status: "overdue", label: "Overdue", color: "#ef4444" };
        }
        if (positionData.usedCredit > 0n) {
            return { status: "active", label: "Active", color: "#22c55e" };
        }
        return { status: "active", label: "Active", color: "#22c55e" };
    }, [positionData]);

    // Build audit trail from invoice data
    const auditTrail = useMemo(() => {
        if (!inv) return [];
        
        const trail = [];
        const createdAtTime = new Date(inv.createdAt).getTime();
        const updatedAtTime = new Date(inv.updatedAt).getTime();
        
        // 1. Invoice Issued (first event - uses createdAt)
        trail.push({
            event: "Invoice Issued",
            description: `Invoice ${inv.externalId} was created and issued.`,
            timestamp: inv.createdAt,
            order: 1,
            link: null,
        });
        
        // 2. Invoice Tokenized (happens after issue, before financing)
        if ((inv.status as string) === "TOKENIZED" || (inv.status as string) === "FINANCED" || inv.isFinanced) {
            // Use updatedAt if tokenized, but ensure it's after createdAt
            const tokenizedTime = Math.max(createdAtTime + 1000, updatedAtTime - 2000);
            trail.push({
                event: "Invoice Tokenized",
                description: `Invoice #${inv.externalId} minted as NFT on-chain.`,
                timestamp: new Date(tokenizedTime).toISOString(),
                order: 2,
                link: inv.invoiceIdOnChain ? `https://sepolia.basescan.org/tx/${inv.invoiceIdOnChain}` : null,
            });
        }
        
        // 3. Collateral Locked (happens during financing, before disbursement)
        if (inv.isFinanced && inv.invoiceIdOnChain) {
            // Collateral is locked right before financing disbursement
            const collateralTime = Math.max(createdAtTime + 2000, updatedAtTime - 1000);
            trail.push({
                event: "Collateral Locked",
                description: "Asset token locked in smart contract vault.",
                timestamp: new Date(collateralTime).toISOString(),
                order: 3,
                link: inv.invoiceIdOnChain ? `https://sepolia.basescan.org/address/${Deployments.FinancingPool.address}` : null,
            });
        }
        
        // 4. Financing Disbursed (final step of financing)
        if (inv.isFinanced) {
            trail.push({
                event: "Financing Disbursed",
                description: "Funds released to issuer wallet. Financing active.",
                timestamp: inv.updatedAt,
                order: 4,
                link: inv.invoiceIdOnChain ? `https://sepolia.basescan.org/tx/${inv.invoiceIdOnChain}` : null,
            });
        }
        
        // 5. Payments (happen after financing)
        if (inv.payments && inv.payments.length > 0) {
            inv.payments.forEach((payment: any) => {
                trail.push({
                    event: payment.amount === repaymentProgress.total ? "Full Repayment Received" : "Partial Repayment Received",
                    description: `A repayment of ${formatAmount(payment.amount, payment.currency)} was processed successfully.`,
                    timestamp: payment.paidAt,
                    order: 5,
                    link: null,
                });
            });
        }
        
        // 6. On-chain Credit Repayments (repayCredit transactions)
        repayments.forEach((repayment) => {
            trail.push({
                event: "Credit Repayment",
                description: `Credit repayment of ${formatAmount(repayment.amount, inv.currency || "TRY")} processed on-chain.`,
                timestamp: repayment.timestamp,
                order: 6,
                link: `https://sepolia.basescan.org/tx/${repayment.txHash}`,
            });
        });
        
        // Sort by order first (logical sequence), then by timestamp (oldest first)
        // Then reverse to show newest first (top to bottom)
        return trail.sort((a, b) => {
            if (a.order !== b.order) {
                return a.order - b.order;
            }
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        }).reverse();
    }, [inv, repaymentProgress, repayments]);

    if (isLoading) {
        return (
            <>
                <style>{`
                    @keyframes pulse {
                        0%, 100% {
                            opacity: 1;
                        }
                        50% {
                            opacity: 0.5;
                        }
                    }
                `}</style>
            <div style={styles.page}>
                <div style={styles.container}>
                    <p style={{ padding: "60px", textAlign: "center", color: "#666" }}>Loading invoice...</p>
                </div>
            </div>
            </>
        );
    }

    if (error || !inv) {
        return (
            <>
                <style>{`
                    @keyframes pulse {
                        0%, 100% {
                            opacity: 1;
                        }
                        50% {
                            opacity: 0.5;
                        }
                    }
                `}</style>
            <div style={styles.page}>
                <div style={styles.container}>
                    <p style={{ padding: "60px", textAlign: "center", color: "#dc2626" }}>Failed to load invoice detail.</p>
                </div>
            </div>
            </>
        );
    }

    const pathname = usePathname();

    return (
        <>
            <style>{`
                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.5;
                    }
                }
            `}</style>
        <div style={styles.page}>
            <Navbar />

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
                        <span style={{ fontWeight: 700, color: "#f59e0b" }}>WARNING</span>
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
                        <span style={getStatusBadgeStyle(paymentStatus)}>
                            {paymentStatus}
                        </span>
                    </div>
                    <div style={styles.headerActions}>
                        <button style={styles.buttonSecondary}>
                            <span>Download PDF</span>
                        </button>
                        {((inv.status as string) === "TOKENIZED" || (inv.status as string) === "FINANCED" || inv.isFinanced) && (
                            (() => {
                                // Check if there's available credit to draw
                                let hasAvailableCredit = false;
                                
                                if (inv.isFinanced || (inv.status as string) === "FINANCED") {
                                    // If already financed, check if there's remaining available credit
                                    if (creditLineInfo) {
                                        hasAvailableCredit = creditLineInfo.availableCredit > 0;
                                    } else {
                                        // Fallback: use invoice data if creditLineInfo not loaded yet
                                        // Both are strings in cents format
                                        const usedCreditStr = inv.usedCredit ? String(inv.usedCredit) : "0";
                                        const maxCreditLineStr = inv.maxCreditLine ? String(inv.maxCreditLine) : "0";
                                        
                                        const usedCreditNum = Number(usedCreditStr);
                                        const maxCreditLineNum = Number(maxCreditLineStr);
                                        
                                        if (!isNaN(usedCreditNum) && !isNaN(maxCreditLineNum)) {
                                            hasAvailableCredit = (maxCreditLineNum - usedCreditNum) > 0;
                                        } else {
                                            // If we can't parse the values, assume there might be credit available
                                            // This prevents the button from disappearing while data loads
                                            hasAvailableCredit = true;
                                        }
                                    }
                                } else {
                                    // If not financed yet, can always finance (will be limited by position after lock)
                                    hasAvailableCredit = true;
                                }
                                
                                return hasAvailableCredit ? (
                                    <button 
                                        style={styles.buttonPrimary}
                                        onClick={openFinanceModal}
                                        disabled={loading || !address}
                                    >
                                        <span>✓</span>
                                        <span>{inv.isFinanced || (inv.status as string) === "FINANCED" ? "Draw More Credit" : "Approve Financing"}</span>
                                    </button>
                                ) : null;
                            })()
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
                        <h2 style={styles.sectionTitle}>Financial State</h2>
                    </div>
                    <div style={styles.financialGrid}>
                            <div>
                            <div style={styles.financialItem}>
                                <div style={styles.financialLabel}>Principal Outstanding</div>
                                <div style={styles.financialValue}>
                                    {inv.isFinanced && creditLineInfo && creditLineInfo.usedCredit > 0
                                        ? formatAmount(Number(creditLineInfo.usedCredit), inv.currency || "TRY")
                                        : inv.isFinanced && inv.usedCredit
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
                            {inv.isFinanced && creditLineInfo && (
                                <div style={styles.financialItem}>
                                    <div style={styles.financialLabel}>Accrued Interest</div>
                                    <div style={{ ...styles.financialValue, color: "#f97316" }}>
                                        {creditLineInfo.interestAccrued > 0
                                            ? formatAmount(Number(creditLineInfo.interestAccrued), inv.currency || "TRY")
                                            : "—"}
                                    </div>
                                    {creditLineInfo.interestAccrued > 0 && (
                                    <div style={styles.financialNote}>
                                            Accruing daily
                                    </div>
                                    )}
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
                                            Copy
                                        </button>
                                        <a
                                            href={`https://sepolia.basescan.org/address/${inv.invoiceIdOnChain}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={styles.iconButton}
                                            title="View on BaseScan"
                                        >
                                            View
                                        </a>
                                    </div>
                                </div>
                            )}
                            {inv.isFinanced && creditLineInfo && (
                                <div style={styles.financialItem}>
                                    <div style={styles.financialLabel}>Collateral Health</div>
                                    <div style={styles.healthFactor}>
                                        <div style={styles.healthFactorLabel}>Current Valuation</div>
                                        <div style={styles.healthFactorValue}>
                                            {formatAmount(Number(creditLineInfo.maxCreditLine), inv.currency || "TRY")}
                                        </div>
                                        <div style={styles.healthFactorLabel}>Health Factor</div>
                                        <div style={styles.healthFactorValue}>
                                            {creditLineInfo.maxCreditLine > 0 && creditLineInfo.usedCredit > 0
                                                ? (creditLineInfo.maxCreditLine / creditLineInfo.usedCredit).toFixed(2)
                                                : "—"}
                                        </div>
                                        <div style={styles.healthFactorStatus}>
                                            {creditLineInfo.maxCreditLine > 0 && creditLineInfo.usedCredit > 0
                                                ? (creditLineInfo.maxCreditLine / creditLineInfo.usedCredit) >= 1.2
                                                    ? "Safe"
                                                    : (creditLineInfo.maxCreditLine / creditLineInfo.usedCredit) >= 1.0
                                                    ? "Warning"
                                                    : "Critical"
                                                : "—"}
                                        </div>
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

                {/* Financial Control Surface - Unified Institutional Panel */}
                {inv.isFinanced && positionData && creditLineInfo && (
                    <div style={styles.financialControlSurface}>
                        {/* Header Layer - Risk Context */}
                        <div style={styles.fcsHeader}>
                            <div style={styles.fcsHeaderLeft}>
                                <span style={styles.fcsRiskLabel}>RISK MODE</span>
                                <div style={styles.fcsRiskBadgeContainer}>
                                    <span style={{
                                        ...styles.fcsRiskBadge,
                                        borderColor: positionData.recourseMode === 0 ? "#64748b" : "#f97316",
                                        color: positionData.recourseMode === 0 ? "#64748b" : "#f97316",
                                    }}>
                                        {positionData.recourseMode === 0 ? "RECOURSE" : "NON-RECOURSE"}
                                    </span>
                                    <span
                                        style={styles.fcsInfoTooltip}
                                        title={
                                            positionData.recourseMode === 0
                                                ? "Recourse: If debtor defaults, issuer is obligated to repay. LP losses are minimized."
                                                : "Non-Recourse: If debtor defaults, pool bears the loss. Reserve protects LPs first."
                                        }
                                    >
                                        i
                                    </span>
                                </div>
                            </div>
                            <div style={styles.fcsHeaderRight}>
                                <span style={styles.fcsStatusLabel}>SYSTEM STATUS</span>
                                <span style={{
                                    ...styles.fcsStatusBadge,
                                    color: creditLineInfo.isInDefault ? "#ef4444" : timelineStatus?.status === "overdue" ? "#f59e0b" : "#22c55e",
                                }}>
                                    {creditLineInfo.isInDefault ? "DEFAULTED" : timelineStatus?.label || "ACTIVE"}
                                </span>
                            </div>
                        </div>

                        {/* AI Monitoring Strip */}
                        <div style={styles.fcsAiStrip}>
                            <div style={styles.fcsAiContent}>
                                <div style={styles.fcsAiPulse}></div>
                                <span style={styles.fcsAiText}>AI Risk Agent monitoring payment behavior in real time</span>
                            </div>
                            <span style={styles.fcsAiTimestamp}>
                                Last evaluation: {formatDate(new Date().toISOString(), true)}
                            </span>
                        </div>

                        {/* Core Financial State - Two Columns */}
                        <div style={styles.fcsFinancialState}>
                            <div style={styles.fcsFinancialColumn}>
                                <div style={styles.fcsFinancialMetric}>
                                    <div style={styles.fcsMetricLabel}>OUTSTANDING PRINCIPAL</div>
                                    <div style={styles.fcsMetricValue}>
                                        {creditLineInfo.usedCredit > 0
                                            ? formatAmount(Number(creditLineInfo.usedCredit), inv.currency || "TRY")
                                            : "—"}
                                    </div>
                                </div>
                                <div style={styles.fcsFinancialMetric}>
                                    <div style={styles.fcsMetricLabel}>ACCRUED INTEREST</div>
                                    <div style={{ ...styles.fcsMetricValue, color: "#f97316" }}>
                                        {creditLineInfo.interestAccrued > 0
                                            ? formatAmount(Number(creditLineInfo.interestAccrued), inv.currency || "TRY")
                                            : "—"}
                                    </div>
                                </div>
                                <div style={styles.fcsFinancialMetric}>
                                    <div style={styles.fcsMetricLabel}>NEXT DUE DATE</div>
                                    <div style={styles.fcsMetricValue}>
                                        {positionData.dueDate > 0n
                                            ? formatDate(new Date(Number(positionData.dueDate) * 1000).toISOString())
                                            : "—"}
                                    </div>
                                </div>
                            </div>
                            <div style={styles.fcsFinancialColumn}>
                                <div style={styles.fcsFinancialMetric}>
                                    <div style={styles.fcsMetricLabel}>LAST PAYMENT RECORDED</div>
                                    <div style={styles.fcsMetricValue}>
                                        {inv.payments && inv.payments.length > 0
                                            ? formatAmount(inv.payments[inv.payments.length - 1].amount, inv.payments[inv.payments.length - 1].currency)
                                            : "—"}
                                    </div>
                                    {inv.payments && inv.payments.length > 0 && (
                                        <div style={styles.fcsMetricNote}>
                                            {formatDate(inv.payments[inv.payments.length - 1].paidAt, true)}
                                        </div>
                                    )}
                                </div>
                                <div style={styles.fcsFinancialMetric}>
                                    <div style={styles.fcsMetricLabel}>DAYS OUTSTANDING</div>
                                    <div style={styles.fcsMetricValue}>
                                        {daysUntilMaturity !== null ? Math.abs(daysUntilMaturity) : "—"}
                                    </div>
                                </div>
                                <div style={styles.fcsFinancialMetric}>
                                    <div style={styles.fcsMetricLabel}>GRACE PERIOD STATUS</div>
                                    <div style={styles.fcsMetricValue}>
                                        {creditLineInfo.graceEndsAt !== "0"
                                            ? `Active until ${formatDate(new Date(parseInt(creditLineInfo.graceEndsAt) * 1000).toISOString())}`
                                            : "—"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Layer */}
                        <div style={styles.fcsActionLayer}>
                            <div style={styles.fcsActionButtons}>
                                <button
                                    style={(loading || !address) ? styles.fcsActionPrimaryDisabled : styles.fcsActionPrimary}
                                    onClick={() => setShowPaymentModal(true)}
                                    disabled={loading || !address}
                                >
                                    Record Payment
                                </button>
                                {process.env.NEXT_PUBLIC_X402_ENABLED === 'true' && (
                                    <X402PaymentButton
                                        invoiceId={id}
                                        invoiceStatus={inv.status}
                                        onPaymentConfirmed={() => {
                                            mutateInvoice();
                                            mutateTruth();
                                        }}
                                    />
                                )}
                                {inv.isFinanced && creditLineInfo && creditLineInfo.usedCredit > 0 && (
                                    <button
                                        style={(loading || !address) ? styles.fcsActionPrimaryDisabled : styles.fcsActionPrimary}
                                        onClick={openRepayModal}
                                        disabled={loading || !address}
                                    >
                                        Repay Credit
                                    </button>
                                )}
                                {userRole?.isAdmin && (
                                    <button
                                        style={{
                                            ...((loading || !address || creditLineInfo.graceEndsAt === "0" || creditLineInfo.isInDefault)
                                                ? styles.fcsActionSecondaryDisabled
                                                : {
                                                    ...styles.fcsActionSecondary,
                                                    ...(creditLineInfo.graceEndsAt !== "0" && creditLineInfo.graceEndsAt && parseInt(creditLineInfo.graceEndsAt) * 1000 <= Date.now() && !creditLineInfo.isInDefault
                                                        ? styles.fcsActionWarning
                                                        : {}),
                                                }),
                                        }}
                                        onClick={() => setShowDefaultModal(true)}
                                        disabled={loading || !address || creditLineInfo.graceEndsAt === "0" || creditLineInfo.isInDefault}
                                    >
                                        Declare Default
                                    </button>
                                )}
                                {creditLineInfo && creditLineInfo.recourseMode === 0 && creditLineInfo.isInDefault && recourseObligation && (
                                    <button
                                        style={(loading || !address) ? styles.fcsActionPrimaryDisabled : styles.fcsActionPrimary}
                                        onClick={() => setShowRecourseModal(true)}
                                        disabled={loading || !address}
                                    >
                                        Pay Recourse
                                    </button>
                                )}
                            </div>
                            {creditLineInfo.graceEndsAt !== "0" && creditLineInfo.graceEndsAt && parseInt(creditLineInfo.graceEndsAt) * 1000 <= Date.now() && !creditLineInfo.isInDefault && (
                                <div style={styles.fcsWarningLine}>
                                    Default declaration available. Grace period has ended.
                                </div>
                            )}
                            <div style={styles.fcsComplianceNote}>
                                Actions are logged and require on-chain confirmation.
                            </div>
                        </div>
                    </div>
                )}

                {/* Audit Trail */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
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

            {/* Finance Modal */}
            {showFinanceModal && inv && (
                <div style={styles.modalOverlay} onClick={() => !loading && setShowFinanceModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px", color: "#1a1a1a" }}>Approve Financing</h2>
                            <p style={{ fontSize: "13px", color: "#666", margin: 0 }}>
                                Invoice: <strong>{inv.externalId}</strong>
                            </p>
                        </div>
                        <div style={{ marginBottom: "24px", padding: "20px", background: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: "4px" }}>
                            <div style={{ marginBottom: "12px" }}>
                                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Available Credit</div>
                                <div style={{ fontSize: "28px", fontWeight: 700, color: "#1a1a1a" }}>
                                    {formatAmount((Number(availableCredit) / 100).toString(), inv.currency || "TRY")}
                                </div>
                            </div>
                            {poolAvailableLiquidity > 0n && (
                                <div style={{ fontSize: "11px", color: "#999", marginTop: "8px" }}>
                                    Pool Liquidity: {formatAmount((Number(poolAvailableLiquidity) / 100).toString(), inv.currency || "TRY")}
                                </div>
                            )}
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Quick Select</label>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                {[10, 25, 50, 75, 100].map((percent) => {
                                    const amount = (Number(availableCredit) / 100) * (percent / 100);
                                    const isSelected = selectedFinancePercentage === percent;
                                    return (
                                        <button
                                            key={percent}
                                            onClick={() => {
                                                setSelectedFinancePercentage(percent);
                                                setFinanceAmount(amount.toFixed(2));
                                            }}
                                            style={{
                                                flex: "1 1 auto",
                                                minWidth: "60px",
                                                padding: "10px",
                                                fontSize: "13px",
                                                fontWeight: isSelected ? 600 : 500,
                                                border: `1px solid ${isSelected ? "#2563eb" : "#e0e0e0"}`,
                                                borderRadius: "4px",
                                                background: isSelected ? "#2563eb" : "#ffffff",
                                                color: isSelected ? "#ffffff" : "#1a1a1a",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {percent}%
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Or Enter Custom Amount</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={Number(availableCredit) / 100}
                                value={financeAmount}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setFinanceAmount(value);
                                    if (selectedFinancePercentage !== null) {
                                        const expectedAmount = (Number(availableCredit) / 100) * (selectedFinancePercentage / 100);
                                        if (Math.abs(parseFloat(value || "0") - expectedAmount) > 0.01) {
                                            setSelectedFinancePercentage(null);
                                        }
                                    }
                                    const numValue = parseFloat(value);
                                    if (!isNaN(numValue) && numValue > Number(availableCredit) / 100) {
                                        setFinanceAmount((Number(availableCredit) / 100).toString());
                                    }
                                }}
                                style={styles.formInput}
                                placeholder="0.00"
                            />
                            {financeAmount && parseFloat(financeAmount) > 0 && (
                                <div style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}>
                                    Remaining Available: {formatAmount(((Number(availableCredit) / 100) - parseFloat(financeAmount)).toFixed(2), inv.currency || "TRY")}
                                </div>
                            )}
                        </div>

                        <div style={styles.modalActions}>
                            <button
                                style={styles.buttonSecondary}
                                onClick={() => {
                                    setShowFinanceModal(false);
                                    setFinanceAmount("");
                                    setSelectedFinancePercentage(null);
                                }}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                style={{
                                    ...styles.buttonPrimary,
                                    ...((!financeAmount || parseFloat(financeAmount) <= 0 || parseFloat(financeAmount) > Number(availableCredit) / 100) ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                                }}
                                onClick={handleFinance}
                                disabled={loading || !financeAmount || parseFloat(financeAmount) <= 0 || parseFloat(financeAmount) > Number(availableCredit) / 100}
                            >
                                {loading ? "Processing..." : "Confirm Financing"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Repay Credit Modal */}
            {showRepayModal && inv && (
                <div style={styles.modalOverlay} onClick={() => !loading && setShowRepayModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px", color: "#1a1a1a" }}>Repay Credit</h2>
                            <p style={{ fontSize: "13px", color: "#666", margin: 0 }}>
                                Invoice: <strong>{inv.externalId}</strong>
                            </p>
                        </div>
                        <div style={{ marginBottom: "24px", padding: "20px", background: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: "4px" }}>
                            <div style={{ marginBottom: "12px" }}>
                                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Outstanding Debt</div>
                                <div style={{ fontSize: "28px", fontWeight: 700, color: "#1a1a1a" }}>
                                    {formatAmount((Number(currentDebt) / 100).toString(), inv.currency || "TRY")}
                                </div>
                            </div>
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Quick Select</label>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                {[10, 25, 50, 75, 100].map((percent) => {
                                    const amount = (Number(currentDebt) / 100) * (percent / 100);
                                    const isSelected = selectedPercentage === percent;
                                    return (
                                        <button
                                            key={percent}
                                            onClick={() => {
                                                setSelectedPercentage(percent);
                                                setRepayAmount(amount.toFixed(2));
                                            }}
                                            style={{
                                                flex: "1 1 auto",
                                                minWidth: "60px",
                                                padding: "10px",
                                                fontSize: "13px",
                                                fontWeight: isSelected ? 600 : 500,
                                                border: `1px solid ${isSelected ? "#2563eb" : "#e0e0e0"}`,
                                                borderRadius: "4px",
                                                background: isSelected ? "#2563eb" : "#ffffff",
                                                color: isSelected ? "#ffffff" : "#1a1a1a",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {percent}%
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Or Enter Custom Amount</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={Number(currentDebt) / 100}
                                value={repayAmount}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setRepayAmount(value);
                                    if (selectedPercentage !== null) {
                                        const expectedAmount = (Number(currentDebt) / 100) * (selectedPercentage / 100);
                                        if (Math.abs(parseFloat(value || "0") - expectedAmount) > 0.01) {
                                            setSelectedPercentage(null);
                                        }
                                    }
                                    const numValue = parseFloat(value);
                                    if (!isNaN(numValue) && numValue > Number(currentDebt) / 100) {
                                        setRepayAmount((Number(currentDebt) / 100).toString());
                                    }
                                }}
                                style={styles.formInput}
                                placeholder="0.00"
                            />
                            {repayAmount && parseFloat(repayAmount) > 0 && (
                                <div style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}>
                                    Remaining: {formatAmount(((Number(currentDebt) / 100) - parseFloat(repayAmount)).toFixed(2), inv.currency || "TRY")}
                                </div>
                            )}
                        </div>

                        <div style={styles.modalActions}>
                            <button
                                style={styles.buttonSecondary}
                                onClick={() => {
                                    setShowRepayModal(false);
                                    setRepayAmount("");
                                    setSelectedPercentage(null);
                                }}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                style={{
                                    ...styles.buttonPrimary,
                                    ...((!repayAmount || parseFloat(repayAmount) <= 0 || parseFloat(repayAmount) > Number(currentDebt) / 100) ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                                }}
                                onClick={executeRepayment}
                                disabled={loading || !repayAmount || parseFloat(repayAmount) <= 0 || parseFloat(repayAmount) > Number(currentDebt) / 100}
                            >
                                {loading ? "Processing..." : "Confirm Repayment"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </>
    );
}
