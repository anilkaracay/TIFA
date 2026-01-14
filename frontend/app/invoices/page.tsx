"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useAccount, useWriteContract, usePublicClient, useChainId } from "wagmi";
import Navbar from "../../components/Navbar";
import Deployments from "../../lib/deployments.json";
import { stringToHex } from "viem";
import { fetchInvoices, Invoice, fetchPoolLimits, PoolLimits, fetchPoolOverview, PoolOverview, createInvoice, requestFinancing } from "../../lib/backendClient";
import { fetchCompanies, Company } from "../../lib/companyClient";
import { formatAmount, formatDate } from "../../lib/format";
import { RoleGate } from "../../components/auth/RoleGate";
import { Role } from "../../lib/roles";
import { useWebSocket } from "../../lib/websocketClient";
import { useTransactionManager } from "../../lib/transactionManager";
import { useToast } from "../../components/Toast";
import { Select } from "../../components/ui/Select";
import { NumberInput } from "../../components/ui/NumberInput";
import { useKyc } from "../../hooks/useKyc";

// Premium light fintech styling
const styles = {
    page: {
        minHeight: "100vh",
        background: "#f8f9fa",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
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
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "32px",
    },
    headerLeft: {
        flex: 1,
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
        background: "rgba(255, 255, 255, 0.98)",
        border: "1px solid rgba(0, 0, 0, 0.06)",
        borderRadius: "8px",
        color: "#0f172a",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        letterSpacing: "-0.01em",
    },
    buttonPrimary: {
        padding: "10px 20px",
        fontSize: "14px",
        fontWeight: 600,
        background: "linear-gradient(135deg, #2563eb 0%, #6366f1 100%)",
        border: "none",
        borderRadius: "8px",
        color: "#ffffff",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        boxShadow: "0 1px 3px rgba(37, 99, 235, 0.2), 0 1px 2px rgba(37, 99, 235, 0.1)",
        letterSpacing: "-0.01em",
    },
    filtersBar: {
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        padding: "16px 20px",
        marginBottom: "24px",
        display: "flex",
        gap: "16px",
        alignItems: "center",
        flexWrap: "wrap",
    },
    searchInput: {
        flex: "1 1 300px",
        minWidth: "250px",
        padding: "10px 16px",
        fontSize: "14px",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        background: "#ffffff",
        color: "#1a1a1a",
    },

    clearFilters: {
        fontSize: "13px",
        color: "#666",
        textDecoration: "none",
        cursor: "pointer",
        padding: "8px 0",
    },
    tableContainer: {
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        overflow: "hidden",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
    },
    tableHeader: {
        background: "#f8f9fa",
        borderBottom: "1px solid #e0e0e0",
    },
    tableHeaderCell: {
        padding: "16px 20px",
        textAlign: "left",
        fontSize: "12px",
        fontWeight: 600,
        color: "#666",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
    },
    tableRow: {
        borderBottom: "1px solid #f0f0f0",
        transition: "0.15s",
    },
    tableRowHover: {
        background: "#fafafa",
    },
    tableCell: {
        padding: "16px 20px",
        fontSize: "14px",
        color: "#1a1a1a",
    },
    invoiceId: {
        fontWeight: 600,
        color: "#2563eb",
        textDecoration: "none",
        cursor: "pointer",
    },
    invoiceDate: {
        fontSize: "12px",
        color: "#666",
        marginTop: "4px",
    },
    counterparty: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    counterpartyAvatar: {
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        background: "#e0e0e0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        fontWeight: 600,
        color: "#666",
    },
    counterpartyInfo: {
        display: "flex",
        flexDirection: "column",
    },
    counterpartyName: {
        fontSize: "14px",
        fontWeight: 500,
        color: "#1a1a1a",
    },
    counterpartyMeta: {
        fontSize: "12px",
        color: "#666",
    },
    faceValue: {
        textAlign: "right",
        fontWeight: 600,
        color: "#1a1a1a",
    },
    riskType: {
        fontSize: "13px",
        color: "#666",
    },
    statusBadge: {
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: 500,
    },
    statusIssued: {
        background: "#e0f2fe",
        color: "#0369a1",
    },
    statusTokenized: {
        background: "#f3e8ff",
        color: "#7c3aed",
    },
    statusFinanced: {
        background: "#dcfce7",
        color: "#16a34a",
    },
    statusRepaid: {
        background: "#f0fdf4",
        color: "#15803d",
    },
    statusDefaulted: {
        background: "#fee2e2",
        color: "#dc2626",
    },
    statusDraft: {
        background: "#f5f5f5",
        color: "#666",
    },
    actions: {
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
    },
    actionButton: {
        padding: "6px 12px",
        fontSize: "12px",
        fontWeight: 500,
        border: "1px solid rgba(0, 0, 0, 0.06)",
        borderRadius: "8px",
        background: "rgba(255, 255, 255, 0.98)",
        color: "#0f172a",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        letterSpacing: "-0.01em",
    },
    actionButtonPrimary: {
        background: "linear-gradient(135deg, #2563eb 0%, #6366f1 100%)",
        color: "#ffffff",
        border: "none",
        boxShadow: "0 1px 3px rgba(37, 99, 235, 0.2), 0 1px 2px rgba(37, 99, 235, 0.1)",
    },
    actionButtonDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
    },
    actionLink: {
        fontSize: "13px",
        color: "#2563eb",
        textDecoration: "none",
        cursor: "pointer",
    },
    pagination: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "24px",
        padding: "16px 20px",
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
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
    modalOverlay: {
        position: "fixed" as "fixed",
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
        padding: "32px",
        maxWidth: "500px",
        width: "90%",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    },
    modalHeader: {
        marginBottom: "24px",
        borderBottom: "1px solid #e0e0e0",
        paddingBottom: "16px",
    },
    modalTitle: {
        fontSize: "24px",
        fontWeight: 700,
        color: "#1a1a1a",
        marginBottom: "8px",
    },
    modalSubtitle: {
        fontSize: "14px",
        color: "#666",
    },
    modalBody: {
        marginBottom: "24px",
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
        padding: "10px 16px",
        boxSizing: "border-box" as const,
        fontSize: "14px",
        lineHeight: "20px",
        fontWeight: 500,
        border: "1px solid rgba(0, 0, 0, 0.06)",
        borderRadius: "8px",
        background: "rgba(255, 255, 255, 0.98)",
        color: "#0f172a",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        letterSpacing: "-0.01em",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    modalFooter: {
        display: "flex",
        gap: "12px",
        justifyContent: "flex-end",
        paddingTop: "20px",
        borderTop: "1px solid #e0e0e0",
    },
    message: {
        padding: "12px 16px",
        borderRadius: "4px",
        marginBottom: "16px",
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

// Skeleton Component
const Skeleton = ({ width, height, style }: { width?: string; height?: string; style?: React.CSSProperties }) => (
    <div style={{
        width: width || "100%",
        height: height || "20px",
        background: "#f0f0f0",
        borderRadius: "4px",
        animation: "pulse 1.5s infinite ease-in-out",
        ...style
    }} />
);

export default function InvoicesPage() {
    return (
        <div style={styles.page}>
            <style jsx global>{`
                @keyframes pulse {
                    0% { background-position: 100% 50%; }
                    100% { background-position: 0 50%; }
                }
            `}</style>
            <ActualInvoicesPageContent />
        </div>
    );
}

function ActualInvoicesPageContent() {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const chainId = useChainId();
    // Map chainId to deployment key (baseSepolia or mantleSepolia)
    const deploymentKey = chainId === 5003 ? "mantleSepolia" : "baseSepolia";

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [riskFilter, setRiskFilter] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [message, setMessage] = useState<React.ReactNode | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showRepayModal, setShowRepayModal] = useState(false);
    const [showFinanceModal, setShowFinanceModal] = useState(false); // [NEW] Finance Modal State

    // KYC Check
    const { isApproved } = useKyc();

    const [selectedInvoiceForRepay, setSelectedInvoiceForRepay] = useState<Invoice | null>(null);
    const [selectedInvoiceForFinance, setSelectedInvoiceForFinance] = useState<Invoice | null>(null); // [NEW] Finance Action State
    const [repayAmount, setRepayAmount] = useState("");
    const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null);
    const [currentDebt, setCurrentDebt] = useState<bigint>(0n);

    // [NEW] Finance Modal specific state
    const [financeAmount, setFinanceAmount] = useState("");
    const [selectedFinancePercentage, setSelectedFinancePercentage] = useState<number | null>(null);
    const [availableCredit, setAvailableCredit] = useState<bigint>(0n);
    const [poolAvailableLiquidity, setPoolAvailableLiquidity] = useState<bigint>(0n);

    const [newInv, setNewInv] = useState({
        externalId: "INV-" + Math.floor(Math.random() * 10000),
        amount: "50000",
        currency: "MNT",
        dueDate: new Date().toISOString().split("T")[0],
        companyId: "",
        debtorId: "COMP-DEBTOR-1",
    });

    const itemsPerPage = 10;

    // WebSocket connection for real-time updates
    const { subscribe: subscribeWS } = useWebSocket('global');
    const { trackTransaction } = useTransactionManager();
    const { showToast } = useToast();

    // Fetch all invoices
    const { data: invoices, isLoading, error: invoicesError, mutate } = useSWR<Invoice[]>(
        "all-invoices",
        () => fetchInvoices(),
        {
            refreshInterval: 10000, // Reduced polling, WebSocket will handle updates
            keepPreviousData: true,
            onError: (error) => {
                console.error('[Invoices] Failed to fetch invoices:', error);
            },
            onSuccess: (data) => {
                console.log('[Invoices] Invoices loaded successfully:', data.length);
            }
        }
    );

    // Fetch companies for counterparty info
    const { data: companies, error: companiesError } = useSWR<Company[]>(
        "companies",
        () => fetchCompanies(),
        {
            refreshInterval: 30000, // Refresh every 30 seconds
            keepPreviousData: true,
            onError: (error) => {
                console.error('[Invoices] Failed to fetch companies:', error);
            },
            onSuccess: (data) => {
                console.log('[Invoices] Companies loaded successfully:', data.length);
            }
        }
    );

    // Separate issuer and debtor companies
    const issuerCompanies = useMemo(() => {
        if (!companies || companies.length === 0) return [];
        // Filter by ID prefix or externalId prefix
        const filtered = companies.filter(c =>
            c.id.startsWith('COMP-ISSUER-') ||
            c.externalId?.startsWith('ISSUER-') ||
            c.id.includes('ISSUER')
        );
        // If no specific issuer companies found, return all companies as fallback
        return filtered.length > 0 ? filtered : companies;
    }, [companies]);

    const debtorCompanies = useMemo(() => {
        if (!companies || companies.length === 0) return [];
        // Filter by ID prefix or externalId prefix
        const filtered = companies.filter(c =>
            c.id.startsWith('COMP-DEBTOR-') ||
            c.externalId?.startsWith('DEBTOR-') ||
            c.id.includes('DEBTOR')
        );
        // If no specific debtor companies found, return all companies as fallback
        return filtered.length > 0 ? filtered : companies;
    }, [companies]);

    // Debug: Log companies loading status
    React.useEffect(() => {
        if (companies) {
            console.log('[Invoices] Companies loaded:', companies.length);
            console.log('[Invoices] Issuer companies:', issuerCompanies.length);
            console.log('[Invoices] Debtor companies:', debtorCompanies.length);
        }
    }, [companies, issuerCompanies, debtorCompanies]);

    // Fetch pool limits for action availability
    const { data: poolLimits } = useSWR<PoolLimits>(
        "pool-limits",
        () => fetchPoolLimits(),
        { keepPreviousData: true }
    );

    // Fetch pool overview
    const { data: poolOverview, mutate: mutatePoolOverview } = useSWR<PoolOverview>(
        "pool-overview",
        () => fetchPoolOverview(),
        { keepPreviousData: true }
    );

    // Subscribe to WebSocket events
    React.useEffect(() => {
        const unsubscribeInvoiceCreated = subscribeWS('invoice.created', (event) => {
            mutate(); // Refresh invoice list
            showToast('success', `Invoice ${event.payload.externalId} created`);
        });

        const unsubscribeInvoiceStatusChanged = subscribeWS('invoice.status_changed', (event) => {
            mutate(); // Refresh invoice list
            showToast('info', `Invoice ${event.payload.externalId} status changed to ${event.payload.newStatus}`);
        });

        const unsubscribeInvoiceTokenized = subscribeWS('invoice.tokenized', (event) => {
            mutate();
            showToast('success', `Invoice ${event.payload.externalId} tokenized`);
        });

        const unsubscribeInvoiceFinanced = subscribeWS('invoice.financed', (event) => {
            mutate();
            mutatePoolOverview();
            showToast('success', `Invoice ${event.payload.externalId} financed`);
        });

        const unsubscribeInvoicePayment = subscribeWS('invoice.payment_recorded', (event) => {
            mutate();
            mutatePoolOverview();
            showToast('success', `Payment recorded for invoice ${event.payload.externalId}`);
        });

        const unsubscribePoolUtilization = subscribeWS('pool.utilization_changed', () => {
            mutatePoolOverview();
        });

        const unsubscribePoolLiquidity = subscribeWS('pool.liquidity_changed', () => {
            mutatePoolOverview();
        });

        return () => {
            unsubscribeInvoiceCreated();
            unsubscribeInvoiceStatusChanged();
            unsubscribeInvoiceTokenized();
            unsubscribeInvoiceFinanced();
            unsubscribeInvoicePayment();
            unsubscribePoolUtilization();
            unsubscribePoolLiquidity();
        };
    }, [subscribeWS, mutate, mutatePoolOverview, showToast]);

    // Create company lookup map
    const companyMap = useMemo(() => {
        if (!companies) return new Map<string, Company>();
        const map = new Map<string, Company>();
        companies.forEach(company => {
            map.set(company.id, company);
        });
        return map;
    }, [companies]);

    // Filter invoices
    const filteredInvoices = useMemo(() => {
        if (!invoices) return [];

        return invoices.filter(inv => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesId = inv.externalId.toLowerCase().includes(query);
                const matchesCompany = inv.companyId.toLowerCase().includes(query);
                const matchesDebtor = inv.debtorId.toLowerCase().includes(query);
                if (!matchesId && !matchesCompany && !matchesDebtor) return false;
            }

            // Status filter
            if (statusFilter !== "all" && inv.status !== statusFilter) {
                return false;
            }

            return true;
        });
    }, [invoices, searchQuery, statusFilter, riskFilter]);

    // Paginate
    const paginatedInvoices = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredInvoices.slice(start, start + itemsPerPage);
    }, [filteredInvoices, currentPage]);

    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);

    // Get unique statuses for filter
    const uniqueStatuses = useMemo(() => {
        if (!invoices) return [];
        const statusSet = new Set(invoices.map(inv => inv.status));
        return Array.from(statusSet).sort();
    }, [invoices]);

    // Get company name helper
    const getCompanyName = (companyId: string) => {
        const company = companyMap.get(companyId);
        return company?.name || companyId;
    };

    // Get company initials for avatar
    const getCompanyInitials = (companyId: string) => {
        const company = companyMap.get(companyId);
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

    // Helper function to check if finance is disabled and why
    function getFinanceDisabledReason(): string | null {
        if (poolLimits?.paused) {
            return "Pool is paused (emergency stop)";
        }
        if (poolLimits && poolLimits.utilization >= poolLimits.maxUtilization) {
            return `Utilization limit reached: ${poolLimits.utilizationPercent.toFixed(1)}% (max: ${poolLimits.maxUtilizationPercent.toFixed(1)}%)`;
        }
        if (poolOverview && parseFloat(poolOverview.availableLiquidityFormatted) <= 0) {
            return "Insufficient pool liquidity";
        }
        return null;
    }

    // Create Invoice Handler
    async function handleCreate() {
        if (!newInv.companyId) {
            setMessage("Please select a company");
            return;
        }
        if (!address) {
            setMessage("Please connect your wallet first");
            return;
        }
        try {
            setMessage(null);

            const invoiceData = {
                ...newInv,
                dueDate: new Date(newInv.dueDate).toISOString(),
                debtorId: newInv.debtorId || "COMP-DEBTOR-1",
            };

            await createInvoice(invoiceData, address);
            setMessage("Invoice created successfully!");
            setShowCreateModal(false);
            setNewInv({
                externalId: "INV-" + Math.floor(Math.random() * 10000),
                amount: "50000",
                currency: "MNT",
                dueDate: new Date().toISOString().split("T")[0],
                companyId: "",
                debtorId: "COMP-DEBTOR-1",
            });
            await mutate();
        } catch (e: any) {
            setMessage("Creation failed: " + e.message);
        }
    }

    // Tokenize Handler
    async function handleTokenize(inv: Invoice) {
        if (!address) {
            setMessage("Please connect your wallet first");
            return;
        }
        if (!isApproved) {
            showToast('error', 'Please complete KYC verification to perform this action');
            return;
        }
        try {
            setActionLoadingId(inv.id);
            setMessage(null);

            const invoiceToken = (Deployments as any)[deploymentKey]?.InvoiceToken;
            const dueDateUnix = new Date(inv.dueDate).getTime() / 1000;

            const coreData = {
                invoiceId: stringToHex(inv.id, { size: 32 }),
                issuer: address,
                debtor: "0x0000000000000000000000000000000000000001",
                currency: "0x0000000000000000000000000000000000000000",
                amount: BigInt(parseFloat(inv.amount || "0") * 100),
                dueDate: BigInt(dueDateUnix),
            };

            const txHash = await writeContractAsync({
                address: invoiceToken.address,
                abi: invoiceToken.abi,
                functionName: "mintInvoice",
                args: [coreData, "http://meta.uri"]
            });

            // Track transaction
            trackTransaction(txHash);
            showToast('info', `Tokenization transaction submitted: ${txHash.slice(0, 10)}...`);

            const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });

            if (receipt.status !== "success") {
                showToast('error', 'Tokenization transaction reverted');
                return;
            }

            // Optimistic update - WebSocket will also trigger refresh
            if (invoices) {
                const updatedData = invoices.map(item =>
                    item.id === inv.id
                        ? { ...item, status: 'TOKENIZED' as const }
                        : item
                );
                mutate(updatedData, { revalidate: false });
            }

            showToast('success', `Invoice ${inv.externalId} tokenized successfully`);
            await mutate();
        } catch (e: any) {
            console.error(e);
            let errorMessage = e?.message || "Tokenization failed";
            if (errorMessage.includes("User rejected") || errorMessage.includes("Action rejected")) {
                errorMessage = "Transaction rejected by user.";
            }
            setMessage(errorMessage);
        } finally {
            setActionLoadingId(null);
        }
    }

    // Open Finance Modal
    async function openFinanceModal(inv: Invoice) {
        if (!address || !publicClient) {
            setMessage("Please connect your wallet first");
            return;
        }
        if (!isApproved) {
            showToast('error', 'Please complete KYC verification to perform this action');
            return;
        }
        if (!inv.tokenId || !inv.invoiceIdOnChain) {
            setMessage("Error: Invoice must be tokenized first");
            return;
        }

        try {
            setActionLoadingId(inv.id);
            const pool = (Deployments as any)[deploymentKey]?.FinancingPool;
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
                // Position likely doesn't exist yet
            }

            let creditLine = 0n;
            let usedCredit = 0n;

            if (position && position.exists) {
                creditLine = position.maxCreditLine as bigint;
                usedCredit = position.usedCredit as bigint;
            } else {
                // If position doesn't exist yet, estimate 60% LTV
                const invoiceAmount = BigInt(Math.floor(parseFloat(inv.amount || "0") * 100));
                creditLine = (invoiceAmount * 60n) / 100n;
            }

            const available = creditLine - usedCredit;
            const maxAvailable = available > liquidity ? liquidity : available;
            setAvailableCredit(maxAvailable > 0n ? maxAvailable : 0n);

            setSelectedInvoiceForFinance(inv);
            setFinanceAmount("");
            setSelectedFinancePercentage(null);
            setShowFinanceModal(true);
            setMessage(null);

        } catch (e: any) {
            console.error(e);
            let errorMessage = e?.message || "Error fetching credit info";
            if (errorMessage.includes("User rejected")) {
                errorMessage = "Transaction rejected by user.";
            }
            setMessage(errorMessage);
        } finally {
            setActionLoadingId(null);
        }
    }

    // Execute Finance (from Modal)
    async function executeFinance() {
        if (!selectedInvoiceForFinance || !financeAmount || !publicClient || !address) return;

        const inv = selectedInvoiceForFinance;

        try {
            setShowFinanceModal(false);
            setActionLoadingId(inv.id);
            setMessage(null);

            // Convert amount to BigInt
            let amountToDraw = BigInt(Math.floor(parseFloat(financeAmount) * 100));

            if (amountToDraw > availableCredit) {
                setMessage(`Error: Amount exceeds available credit.`);
                return;
            }

            const pool = (Deployments as any)[deploymentKey]?.FinancingPool;
            const token = (Deployments as any)[deploymentKey]?.InvoiceToken;

            // Check approval
            let isApproved = await publicClient.readContract({
                address: token.address as `0x${string}`,
                abi: token.abi,
                functionName: "isApprovedForAll",
                args: [address, pool.address]
            }) as boolean;

            if (!isApproved) {
                setMessage("Step 1/3: Approving...");
                const tx = await writeContractAsync({
                    address: token.address as `0x${string}`,
                    abi: token.abi,
                    functionName: "setApprovalForAll",
                    args: [pool.address, true]
                });
                await publicClient.waitForTransactionReceipt({ hash: tx });
            }

            // Check ownership and lock
            const poolAddress = pool.address as `0x${string}`;
            let owner: string;
            try {
                owner = await publicClient.readContract({
                    address: token.address as `0x${string}`,
                    abi: token.abi,
                    functionName: "ownerOf",
                    args: [BigInt(inv.tokenId!)]
                }) as string;
            } catch (err: any) {
                setMessage("Error: Token not found on-chain. This might be a seeded invoice.");
                return;
            }

            if (owner.toLowerCase() === address.toLowerCase()) {
                setMessage("Step 2/3: Locking Collateral...");
                if (!inv.invoiceIdOnChain) {
                    setMessage("Error: Missing on-chain Invoice ID.");
                    return;
                }

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
                    args: [inv.invoiceIdOnChain as `0x${string}`, BigInt(inv.tokenId!), address]
                });

                await publicClient.waitForTransactionReceipt({ hash: tx });
                owner = poolAddress;
            }

            // Draw credit
            if (owner.toLowerCase() === poolAddress.toLowerCase()) {
                setMessage("Step 3/3: Drawing Credit...");

                // Re-verify position just be safe
                const position = await publicClient.readContract({
                    address: poolAddress,
                    abi: pool.abi,
                    functionName: "getPosition",
                    args: [inv.invoiceIdOnChain as `0x${string}`]
                }) as any;

                const maxCreditLine = position.maxCreditLine as bigint;
                const currentUsedCredit = position.usedCredit as bigint;
                const availableCreditAfterLock = maxCreditLine - currentUsedCredit;

                if (amountToDraw > availableCreditAfterLock) {
                    // Adjust if estimation was off
                    amountToDraw = availableCreditAfterLock;
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
                    args: [inv.invoiceIdOnChain, amountToDraw, address]
                });

                const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

                // Notify backend about financing
                setMessage("Step 4/4: Notifying backend...");
                try {
                    await requestFinancing(
                        inv.id,
                        address,
                        receipt.transactionHash,
                        amountToDraw.toString()
                    );
                    showToast('success', `Credit drawn successfully! Amount: ${formatAmount((Number(amountToDraw) / 100).toString(), inv.currency || "MNT")}`);
                } catch (backendError: any) {
                    console.error('[Finance] Backend notification failed:', backendError);
                    showToast('warning', 'Credit drawn on-chain, but backend sync failed. Please refresh.');
                }

                await mutate();
            }

        } catch (e: any) {
            console.error(e);
            let errorMessage = e?.message || "Financing failed";
            if (errorMessage.includes("User rejected") || errorMessage.includes("Action rejected")) {
                errorMessage = "Transaction rejected by user.";
            }
            setMessage(errorMessage);
        } finally {
            setActionLoadingId(null);
        }
    }

    // Open Repay Modal
    async function openRepayModal(inv: Invoice) {
        if (!address || !publicClient) {
            setMessage("Please connect your wallet first");
            return;
        }
        try {
            const pool = (Deployments as any)[deploymentKey]?.FinancingPool;
            if (!inv.invoiceIdOnChain) {
                setMessage("Error: Missing on-chain Invoice ID.");
                return;
            }

            const position = await publicClient.readContract({
                address: pool.address as `0x${string}`,
                abi: pool.abi,
                functionName: "getPosition",
                args: [inv.invoiceIdOnChain]
            }) as any;

            const debt = position.usedCredit as bigint;


            if (debt === 0n) {
                setMessage("Invoice has no outstanding debt!");
                return;
            }

            setCurrentDebt(debt);

            setSelectedInvoiceForRepay(inv);
            setRepayAmount("");
            setSelectedPercentage(null);
            setShowRepayModal(true);
            setMessage(null);
        } catch (e: any) {
            setMessage("Error fetching debt: " + e.message);
        }
    }

    // Execute Repayment
    async function executeRepayment() {
        if (!selectedInvoiceForRepay || !repayAmount || !publicClient) return;

        try {
            const pool = (Deployments as any)[deploymentKey]?.FinancingPool;
            const token = (Deployments as any)[deploymentKey]?.TestToken;

            let amountToRepay = BigInt(Math.floor(parseFloat(repayAmount) * 100));

            if (amountToRepay > currentDebt) {
                amountToRepay = currentDebt;
                setRepayAmount((Number(currentDebt) / 100).toString());
                setSelectedPercentage(100);
                return;
            }

            if (amountToRepay <= 0n) return;

            setShowRepayModal(false);
            setMessage(null);
            setActionLoadingId(selectedInvoiceForRepay.id);

            // Check allowance
            const allowance = await publicClient.readContract({
                address: token.address as `0x${string}`,
                abi: token.abi,
                functionName: "allowance",
                args: [address, pool.address]
            }) as bigint;

            if (allowance < amountToRepay) {
                setMessage("Step 1/2: Approving Payment Token...");
                const tx = await writeContractAsync({
                    address: token.address as `0x${string}`,
                    abi: token.abi,
                    functionName: "approve",
                    args: [pool.address, amountToRepay]
                });
                await publicClient.waitForTransactionReceipt({ hash: tx });
            }

            // Repay
            setMessage("Step 2/2: Repaying Credit...");
            const tx = await writeContractAsync({
                address: pool.address as `0x${string}`,
                abi: pool.abi,
                functionName: "repayCredit",
                args: [selectedInvoiceForRepay.invoiceIdOnChain, amountToRepay]
            });

            await publicClient.waitForTransactionReceipt({ hash: tx });

            setMessage(`Repayment successful! Amount: ${formatAmount(repayAmount, selectedInvoiceForRepay.currency || "MNT")}`);

            setTimeout(async () => {
                await mutate();
            }, 2000);
        } catch (e: any) {
            console.error(e);
            setMessage(e?.message ?? "Repayment failed");
        } finally {
            setActionLoadingId(null);
        }
    }

    // Export CSV handler
    const handleExportCSV = () => {
        if (!filteredInvoices.length) return;

        const headers = ["Invoice ID", "Counterparty", "Face Value", "Risk Type", "Status", "Due Date", "Created"];
        const rows = filteredInvoices.map(inv => [
            inv.externalId,
            getCompanyName(inv.companyId),
            inv.amount,
            "N/A",
            inv.status,
            inv.dueDate,
            inv.createdAt,
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `invoices-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    // Clear filters
    const handleClearFilters = () => {
        setSearchQuery("");
        setStatusFilter("all");
        setRiskFilter("all");
        setCurrentPage(1);
    };

    return (
        <div style={styles.page}>
            <Navbar />

            {/* Main Content */}
            <div style={styles.container}>
                {/* Message Display */}
                {message && (
                    <div style={{
                        ...styles.message,
                        ...(typeof message === "string" && (message.includes("successful") || message.includes("success")) ? styles.messageSuccess :
                            typeof message === "string" && message.includes("Error") ? styles.messageError :
                                styles.messageInfo)
                    }}>
                        {message}
                    </div>
                )}

                {/* Page Header */}
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        <h1 style={styles.pageTitle}>Invoices</h1>
                        <p style={styles.pageSubtitle}>
                            Manage, track, and allocate capital across all active invoices.
                        </p>
                    </div>
                    <div style={styles.headerActions}>
                        <button
                            style={styles.buttonSecondary}
                            onClick={handleExportCSV}
                            disabled={!filteredInvoices.length}
                        >
                            <span>Export CSV</span>
                        </button>
                        <button
                            style={styles.buttonPrimary}
                            onClick={() => {
                                if (issuerCompanies && issuerCompanies.length > 0) {
                                    setNewInv({
                                        ...newInv,
                                        companyId: issuerCompanies[0].id,
                                        debtorId: debtorCompanies && debtorCompanies.length > 0 ? debtorCompanies[0].id : "",
                                    });
                                } else if (companies && companies.length > 0) {
                                    setNewInv({ ...newInv, companyId: companies[0].id });
                                }
                                setShowCreateModal(true);
                            }}
                        >
                            <span>+</span>
                            <span>New Invoice</span>
                        </button>
                    </div>
                </div>

                {/* Search & Filters */}
                <div style={styles.filtersBar}>
                    <input
                        type="text"
                        placeholder="Search by Invoice ID or Counterparty..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        style={styles.searchInput}
                    />
                    <div style={{ minWidth: "200px" }}>
                        <Select
                            value={statusFilter}
                            onChange={(value) => {
                                setStatusFilter(value);
                                setCurrentPage(1);
                            }}
                            options={[
                                { value: "all", label: "Status: All" },
                                ...uniqueStatuses.map(status => ({ value: status, label: status }))
                            ]}
                            placeholder="Status: All"
                        />
                    </div>
                    <div style={{ minWidth: "200px" }}>
                        <Select
                            value={riskFilter}
                            onChange={(value) => {
                                setRiskFilter(value);
                                setCurrentPage(1);
                            }}
                            options={[
                                { value: "all", label: "Risk: All Types" },
                                { value: "recourse", label: "Recourse" },
                                { value: "non-recourse", label: "Non-recourse" }
                            ]}
                            placeholder="Risk: All Types"
                        />
                    </div>
                    {(searchQuery || statusFilter !== "all" || riskFilter !== "all") && (
                        <a
                            onClick={handleClearFilters}
                            style={styles.clearFilters}
                        >
                            Clear Filters
                        </a>
                    )}
                </div>

                {/* Invoice Table */}
                <div style={styles.tableContainer}>
                    <table style={styles.table}>
                        <thead style={styles.tableHeader}>
                            <tr>
                                <th style={styles.tableHeaderCell}>Invoice ID</th>
                                <th style={styles.tableHeaderCell}>Counterparty</th>
                                <th style={{ ...styles.tableHeaderCell, textAlign: "right" }}>Face Value</th>
                                <th style={styles.tableHeaderCell}>Risk Type</th>
                                <th style={styles.tableHeaderCell}>Status</th>
                                <th style={styles.tableHeaderCell}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, idx) => (
                                    <tr key={`skeleton-${idx}`} style={styles.tableRow}>
                                        <td style={styles.tableCell}><Skeleton width="120px" /></td>
                                        <td style={styles.tableCell}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <Skeleton width="32px" height="32px" style={{ borderRadius: "50%" }} />
                                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                    <Skeleton width="100px" height="14px" />
                                                    <Skeleton width="80px" height="12px" />
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ ...styles.tableCell, ...styles.faceValue }}><Skeleton width="80px" /></td>
                                        <td style={styles.tableCell}><Skeleton width="60px" /></td>
                                        <td style={styles.tableCell}><Skeleton width="70px" /></td>
                                        <td style={styles.tableCell}><Skeleton width="90px" /></td>
                                    </tr>
                                ))
                            ) : invoicesError ? (
                                <tr>
                                    <td colSpan={6} style={{ ...styles.tableCell, textAlign: "center", padding: "60px", color: "#dc2626" }}>
                                        Error loading invoices. Please refresh the page.
                                        <br />
                                        <small style={{ fontSize: "11px", color: "#666", marginTop: "8px", display: "block" }}>
                                            {invoicesError.message || "Check backend connection"}
                                        </small>
                                    </td>
                                </tr>
                            ) : paginatedInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ ...styles.tableCell, textAlign: "center", padding: "60px", color: "#666" }}>
                                        {filteredInvoices.length === 0 && invoices?.length === 0
                                            ? "No invoices found. Create your first invoice to get started."
                                            : "No invoices match your filters."}
                                    </td>
                                </tr>
                            ) : (
                                paginatedInvoices.map((inv) => {


                                    const canTokenize = inv.status === "ISSUED";
                                    const canFinance = inv.status === "TOKENIZED" && !inv.isFinanced && poolLimits && !poolLimits.paused;
                                    const canRepay = inv.isFinanced;
                                    const financeDisabledReason = getFinanceDisabledReason();

                                    return (
                                        <tr key={inv.id} style={styles.tableRow}>
                                            {/* Invoice ID */}
                                            <td style={styles.tableCell}>
                                                <Link href={`/invoices/${inv.id}`} style={styles.invoiceId}>
                                                    {inv.externalId}
                                                </Link>
                                                <div style={styles.invoiceDate}>
                                                    {formatDate(inv.createdAt)}
                                                </div>
                                            </td>

                                            {/* Counterparty */}
                                            <td style={styles.tableCell}>
                                                <div style={styles.counterparty}>
                                                    <div style={styles.counterpartyAvatar}>
                                                        {getCompanyInitials(inv.companyId)}
                                                    </div>
                                                    <div style={styles.counterpartyInfo}>
                                                        <div style={styles.counterpartyName}>
                                                            {getCompanyName(inv.companyId)}
                                                        </div>
                                                        <div style={styles.counterpartyMeta}>
                                                            {inv.companyId}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Face Value */}
                                            <td style={{ ...styles.tableCell, ...styles.faceValue }}>
                                                {formatAmount(inv.amount, inv.currency || "MNT")}
                                            </td>

                                            {/* Risk Type */}
                                            {/* Risk Type */}
                                            <td style={styles.tableCell}>
                                                {inv.riskScore !== undefined && inv.riskScore !== null ? (() => {
                                                    let label = "Low";
                                                    let color = "#15803d"; // Green
                                                    let bg = "#f0fdf4";

                                                    if (inv.riskScore > 70) {
                                                        label = "High";
                                                        color = "#dc2626"; // Red
                                                        bg = "#fee2e2";
                                                    } else if (inv.riskScore > 30) {
                                                        label = "Medium";
                                                        color = "#b45309"; // Orange
                                                        bg = "#ffedd5";
                                                    }

                                                    return (
                                                        <span style={{
                                                            ...styles.statusBadge,
                                                            background: bg,
                                                            color: color,
                                                            border: `1px solid ${color}30`
                                                        }}>
                                                            {label} ({inv.riskScore})
                                                        </span>
                                                    );
                                                })() : (
                                                    <span style={styles.riskType}>
                                                        N/A
                                                    </span>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td style={styles.tableCell}>
                                                {(() => {
                                                    let displayStatus = inv.status;
                                                    let customStyle = {};

                                                    // Calculate dynamic status for financed invoices
                                                    if (inv.isFinanced && inv.usedCredit && inv.maxCreditLine) {
                                                        const used = BigInt(inv.usedCredit);
                                                        const max = BigInt(inv.maxCreditLine);

                                                        if (used === 0n) {
                                                            displayStatus = "PAID";
                                                            customStyle = styles.statusRepaid; // Green
                                                        } else if (used < max && inv.cumulativePaid && BigInt(inv.cumulativePaid) > 0n) {
                                                            displayStatus = "PARTIALLY_PAID";
                                                            // Custom style for partially paid (can reuse tokenized or create new)
                                                            customStyle = {
                                                                background: "#eff6ff",
                                                                color: "#2563eb",
                                                                border: "1px solid #bfdbfe"
                                                            };
                                                        }
                                                    }

                                                    // Fallback to default styles if not overridden
                                                    if (Object.keys(customStyle).length === 0) {
                                                        if (displayStatus === "PAID") customStyle = styles.statusRepaid;
                                                        else if (displayStatus === "ISSUED") customStyle = styles.statusIssued;
                                                        else if (displayStatus === "TOKENIZED") customStyle = styles.statusTokenized;
                                                        else if (displayStatus === "FINANCED") customStyle = styles.statusFinanced;
                                                        else if (displayStatus === "DEFAULTED") customStyle = styles.statusDefaulted;
                                                        else customStyle = styles.statusDraft;
                                                    }

                                                    return (
                                                        <span style={{ ...styles.statusBadge, ...customStyle }}>
                                                            {displayStatus as string}
                                                        </span>
                                                    );
                                                })()}
                                            </td>

                                            {/* Actions */}
                                            <td style={styles.tableCell}>
                                                <div style={styles.actions}>
                                                    <Link href={`/invoices/${inv.id}`} style={styles.actionLink}>
                                                        View
                                                    </Link>
                                                    <RoleGate allowed={[Role.ISSUER, Role.ADMIN]} fallback={null}>
                                                        {canTokenize && (
                                                            <button
                                                                style={{
                                                                    ...styles.actionButton,
                                                                    ...(actionLoadingId === inv.id ? styles.actionButtonDisabled : {}),
                                                                }}
                                                                onClick={() => handleTokenize(inv)}
                                                                disabled={actionLoadingId === inv.id}
                                                            >
                                                                Tokenize
                                                            </button>
                                                        )}
                                                        {canFinance && (
                                                            <button
                                                                style={{
                                                                    ...styles.actionButton,
                                                                    ...styles.actionButtonPrimary,
                                                                    ...(actionLoadingId === inv.id || financeDisabledReason ? styles.actionButtonDisabled : {}),
                                                                }}
                                                                onClick={() => openFinanceModal(inv)}
                                                                disabled={actionLoadingId === inv.id || !!financeDisabledReason}
                                                                title={financeDisabledReason || undefined}
                                                            >
                                                                Finance
                                                            </button>
                                                        )}
                                                        {canRepay && (
                                                            <button
                                                                style={{
                                                                    ...styles.actionButton,
                                                                    ...(actionLoadingId === inv.id ? styles.actionButtonDisabled : {}),
                                                                }}
                                                                onClick={() => openRepayModal(inv)}
                                                                disabled={actionLoadingId === inv.id}
                                                            >
                                                                Repay
                                                            </button>
                                                        )}
                                                    </RoleGate>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filteredInvoices.length > 0 && (
                    <div style={styles.pagination}>
                        <div style={styles.paginationInfo}>
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredInvoices.length)} of {filteredInvoices.length} results
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

            {/* Create Invoice Modal */}
            {showCreateModal && (
                <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.modalTitle}>Create New Invoice</h2>
                            <p style={styles.modalSubtitle}>Add a new invoice to the system</p>
                        </div>
                        <div style={styles.modalBody}>
                            <div style={styles.formGroup}>
                                <label style={styles.formLabel}>Invoice ID</label>
                                <input
                                    type="text"
                                    value={newInv.externalId}
                                    onChange={(e) => setNewInv({ ...newInv, externalId: e.target.value })}
                                    style={styles.formInput}
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.formLabel}>Company (Issuer)</label>
                                <Select
                                    value={newInv.companyId}
                                    onChange={(value) => setNewInv({ ...newInv, companyId: value })}
                                    placeholder="Select issuer company..."
                                    options={
                                        companiesError
                                            ? [{ value: "", label: "Error loading companies. Please refresh.", disabled: true }]
                                            : companies && companies.length > 0
                                                ? companies.map(c => ({
                                                    value: c.id,
                                                    label: c.name || c.externalId || c.id,
                                                }))
                                                : [{ value: "", label: "Loading companies...", disabled: true }]
                                    }
                                    error={!!companiesError}
                                    disabled={companiesError || !companies || companies.length === 0}
                                />
                                {companiesError && (
                                    <div style={{ fontSize: "11px", color: "#dc2626", marginTop: "4px" }}>
                                        Failed to load companies. Check backend connection.
                                    </div>
                                )}
                                {!companiesError && companies && companies.length === 0 && (
                                    <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                                        No companies found. Create companies first.
                                    </div>
                                )}
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.formLabel}>Amount</label>
                                <NumberInput
                                    value={newInv.amount}
                                    onChange={(value) => setNewInv({ ...newInv, amount: value })}
                                    placeholder="0"
                                    min={0}
                                    step={100}
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.formLabel}>Currency</label>
                                <Select
                                    value={newInv.currency}
                                    onChange={(value) => setNewInv({ ...newInv, currency: value })}
                                    placeholder="Select currency..."
                                    options={[
                                        { value: "MNT", label: "MNT" },
                                        { value: "USD", label: "USD" },
                                        { value: "EUR", label: "EUR" },
                                    ]}
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.formLabel}>Due Date</label>
                                <input
                                    type="date"
                                    value={newInv.dueDate}
                                    onChange={(e) => setNewInv({ ...newInv, dueDate: e.target.value })}
                                    style={styles.formInput}
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.formLabel}>Debtor</label>
                                <Select
                                    value={newInv.debtorId}
                                    onChange={(value) => setNewInv({ ...newInv, debtorId: value })}
                                    placeholder="Select debtor company..."
                                    options={
                                        companiesError
                                            ? [{ value: "", label: "Error loading companies. Please refresh.", disabled: true }]
                                            : companies && companies.length > 0
                                                ? companies.map(c => ({
                                                    value: c.id,
                                                    label: c.name || c.externalId || c.id,
                                                }))
                                                : [{ value: "", label: "Loading companies...", disabled: true }]
                                    }
                                    error={!!companiesError}
                                    disabled={companiesError || !companies || companies.length === 0}
                                />
                                {companiesError && (
                                    <div style={{ fontSize: "11px", color: "#dc2626", marginTop: "4px" }}>
                                        Failed to load companies. Check backend connection.
                                    </div>
                                )}
                                {!companiesError && companies && companies.length === 0 && (
                                    <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                                        No companies found. Create companies first.
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={styles.modalFooter}>
                            <button
                                style={styles.buttonSecondary}
                                onClick={() => setShowCreateModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                style={styles.buttonPrimary}
                                onClick={handleCreate}
                            >
                                Create Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Repay Modal */}
            {showRepayModal && selectedInvoiceForRepay && (
                <div style={styles.modalOverlay} onClick={() => setShowRepayModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.modalTitle}>Repay Credit</h2>
                            <p style={styles.modalSubtitle}>
                                Invoice: <strong>{selectedInvoiceForRepay.externalId}</strong>
                            </p>
                        </div>
                        <div style={styles.modalBody}>
                            <div style={{
                                marginBottom: "24px",
                                padding: "20px",
                                background: "#f8f9fa",
                                border: "1px solid #e0e0e0",
                                borderRadius: "4px",
                            }}>
                                <div style={{ marginBottom: "12px" }}>
                                    <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Outstanding Debt</div>
                                    <div style={{ fontSize: "28px", fontWeight: 700, color: "#1a1a1a" }}>
                                        {formatAmount((Number(currentDebt) / 100).toString(), selectedInvoiceForRepay.currency || "MNT")}
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
                                        Remaining: {formatAmount(((Number(currentDebt) / 100) - parseFloat(repayAmount)).toFixed(2), selectedInvoiceForRepay.currency || "MNT")}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={styles.modalFooter}>
                            <button
                                style={styles.buttonSecondary}
                                onClick={() => {
                                    setShowRepayModal(false);
                                    setRepayAmount("");
                                    setSelectedPercentage(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                style={{
                                    ...styles.buttonPrimary,
                                    ...((!repayAmount || parseFloat(repayAmount) <= 0 || parseFloat(repayAmount) > Number(currentDebt) / 100) ? styles.actionButtonDisabled : {}),
                                }}
                                onClick={executeRepayment}
                                disabled={!repayAmount || parseFloat(repayAmount) <= 0 || parseFloat(repayAmount) > Number(currentDebt) / 100}
                            >
                                Confirm Payment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Finance Modal */}
            {showFinanceModal && selectedInvoiceForFinance && (
                <div style={styles.modalOverlay} onClick={() => !actionLoadingId && setShowFinanceModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px", color: "#1a1a1a" }}>Approve Financing</h2>
                            <p style={{ fontSize: "13px", color: "#666", margin: 0 }}>
                                Invoice: <strong>{selectedInvoiceForFinance.externalId}</strong>
                            </p>
                        </div>
                        <div style={{ marginBottom: "24px", padding: "20px", background: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: "4px" }}>
                            <div style={{ marginBottom: "12px" }}>
                                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Available Credit</div>
                                <div style={{ fontSize: "28px", fontWeight: 700, color: "#1a1a1a" }}>
                                    {formatAmount((Number(availableCredit) / 100).toString(), selectedInvoiceForFinance.currency || "MNT")}
                                </div>
                            </div>
                            {poolAvailableLiquidity > 0n && (
                                <div style={{ fontSize: "11px", color: "#999", marginTop: "8px" }}>
                                    Pool Liquidity: {formatAmount((Number(poolAvailableLiquidity) / 100).toString(), selectedInvoiceForFinance.currency || "MNT")}
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
                            <NumberInput
                                value={financeAmount}
                                onChange={(value) => {
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
                                placeholder="0.00"
                                step={0.01}
                                min={0}
                                max={Number(availableCredit) / 100}
                            />
                            {financeAmount && parseFloat(financeAmount) > 0 && (
                                <div style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}>
                                    Remaining Available: {formatAmount(((Number(availableCredit) / 100) - parseFloat(financeAmount)).toFixed(2), selectedInvoiceForFinance.currency || "MNT")}
                                </div>
                            )}
                        </div>

                        <div style={styles.modalFooter}>
                            <button
                                style={styles.buttonSecondary}
                                onClick={() => {
                                    setShowFinanceModal(false);
                                    setFinanceAmount("");
                                    setSelectedFinancePercentage(null);
                                }}
                                disabled={!!actionLoadingId}
                            >
                                Cancel
                            </button>
                            <button
                                style={{
                                    ...styles.buttonPrimary,
                                    ...((!financeAmount || parseFloat(financeAmount) <= 0 || parseFloat(financeAmount) > Number(availableCredit) / 100) ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                                }}
                                onClick={executeFinance}
                                disabled={!!actionLoadingId || !financeAmount || parseFloat(financeAmount) <= 0 || parseFloat(financeAmount) > Number(availableCredit) / 100}
                            >
                                {!!actionLoadingId ? "Processing..." : "Confirm Financing"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
