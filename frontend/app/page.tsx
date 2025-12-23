"use client";

import React, { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import Deployments from "../lib/deployments.json";
import { stringToHex } from "viem";

import { fetchInvoicesForCompany, createInvoice, Invoice } from "../lib/backendClient";
import { fetchCompanies, fetchCashflow, Company, CashflowResponse } from "../lib/companyClient";
import { formatAmount, formatDate, statusColor } from "../lib/format";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { CashflowChart } from "../components/CashflowChart";

const fetcher = (companyId: string) => fetchInvoicesForCompany(companyId);
const companiesFetcher = () => fetchCompanies();
const cashflowFetcher = (companyId: string) => fetchCashflow(companyId);

export default function HomePage() {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    // 1. Fetch Companies
    const { data: companies, error: companyError } = useSWR<Company[]>("companies", companiesFetcher);

    // State for selected company
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

    // Effect to set default company
    if (companies && companies.length > 0 && !selectedCompanyId) {
        setSelectedCompanyId(companies[0].id);
    }

    // 2. Fetch Invoices for Selected Company
    const { data, error, isLoading, mutate } = useSWR<Invoice[]>(
        selectedCompanyId ? ["invoices", selectedCompanyId] : null,
        () => fetcher(selectedCompanyId!),
        {
            refreshInterval: 5000, // Poll every 5 seconds for real-time updates
            revalidateOnFocus: true,
            revalidateOnReconnect: true
        }
    );

    // 3. Fetch Cashflow for Selected Company
    const { data: cashflow } = useSWR<CashflowResponse>(
        selectedCompanyId ? ["cashflow", selectedCompanyId] : null,
        () => cashflowFetcher(selectedCompanyId!)
    );

    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [message, setMessage] = useState<React.ReactNode | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [newInv, setNewInv] = useState({
        externalId: "INV-" + Math.floor(Math.random() * 10000),
        amount: "50000",
        currency: "TRY",
        dueDate: "2025-12-31",
        companyId: "satici_a",
        debtorId: "alici_b"
    });
    const [showRepayModal, setShowRepayModal] = useState(false);
    const [repayAmount, setRepayAmount] = useState("");
    const [currentDebt, setCurrentDebt] = useState<bigint>(0n);
    const [maxCreditLine, setMaxCreditLine] = useState<bigint>(0n);
    const [ltvBps, setLtvBps] = useState<bigint>(0n);
    const [selectedInvoiceForRepay, setSelectedInvoiceForRepay] = useState<Invoice | null>(null);
    const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null);

    async function handleCreate() {
        if (!selectedCompanyId) return;
        try {
            setMessage(null);
            await createInvoice({ ...newInv, companyId: selectedCompanyId });
            setMessage("Invoice created successfully!");
            setShowCreate(false);
            setNewInv({ ...newInv, externalId: "INV-" + Math.floor(Math.random() * 10000) });
            await mutate();
        } catch (e: any) {
            setMessage("Creation failed: " + e.message);
        }
    }

    async function handleTokenize(inv: Invoice) {
        if (!address) {
            alert("Please connect your wallet first");
            return;
        }
        try {
            setActionLoadingId(inv.id);
            setMessage(null);

            const invoiceToken = Deployments.InvoiceToken;
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
                address: invoiceToken.address as `0x${string}`,
                abi: invoiceToken.abi,
                functionName: "mintInvoice",
                args: [coreData, "http://meta.uri"]
            });

            setMessage(`Transaction sent: ${txHash}. Waiting for confirmation...`);
            
            // Wait for transaction receipt
            const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
            
            if (receipt.status !== "success") {
                setMessage("Error: Tokenization transaction reverted.");
                return;
            }
            
            // Optimistic update: Update local state immediately
            if (data) {
                const updatedData = data.map(item => 
                    item.id === inv.id 
                        ? { ...item, status: 'TOKENIZED' as const }
                        : item
                );
                mutate(updatedData, { revalidate: false });
            }
            
            setMessage("✅ Tokenization successful! Invoice is now tokenized.");
            
            // Wait a bit for backend listener to process the event, then refresh
            setTimeout(async () => {
                await mutate();
            }, 2000);
        } catch (e: any) {
            console.error(e);
            setMessage(e?.message ?? "Tokenization failed");
        } finally {
            setActionLoadingId(null);
        }
    }

    async function handleFinance(inv: Invoice) {
        if (!address || !publicClient) {
            alert("Please connect your wallet first");
            return;
        }
        try {
            setActionLoadingId(inv.id);
            setMessage(null);

            const pool = Deployments.FinancingPool;
            const token = Deployments.InvoiceToken;

            // 1. Check Approval
            console.log("Checking approval...");
            console.log("Pool Address (Frontend):", pool.address);
            let isApproved = await publicClient.readContract({
                address: token.address as `0x${string}`,
                abi: token.abi,
                functionName: "isApprovedForAll",
                args: [address, pool.address]
            }) as boolean;
            console.log("isApproved:", isApproved);

            if (!isApproved) {
                setMessage("Step 1/3: Approving... (Please confirm in Wallet)");
                const tx = await writeContractAsync({
                    address: token.address as `0x${string}`,
                    abi: token.abi,
                    functionName: "setApprovalForAll",
                    args: [pool.address, true]
                });
                setMessage(`Approval Sent. Waiting for confirmation...`);
                await publicClient.waitForTransactionReceipt({ hash: tx });
                console.log("Approval confirmed.");
            }

            // 2. Check Ownership
            let owner: string;
            try {
                owner = await publicClient.readContract({
                    address: token.address as `0x${string}`,
                    abi: token.abi,
                    functionName: "ownerOf",
                    args: [BigInt(inv.tokenId!)]
                }) as string;
                console.log("Token Owner:", owner);
            } catch (err: any) {
                console.error("Owner check failed:", err);
                if (err.message && err.message.includes("NonexistentToken")) {
                    setMessage("Error: Token not found on-chain. Please create a new invoice.");
                    return;
                }
                setMessage("Retry needed: Could not read ownership. Click Finance again.");
                return;
            }

            if (owner === address) {
                setMessage("Step 2/3: Locking Collateral... (Please confirm in Wallet)");

                if (!inv.invoiceIdOnChain) {
                    setMessage("Error: Missing on-chain Invoice ID. Please refresh the page.");
                    return;
                }

                // Use pool address from deployments
                const poolAddress = pool.address as `0x${string}`;
                console.log("Using Pool Address:", poolAddress);

                console.log("Locking Params:", {
                    invoiceId: inv.invoiceIdOnChain,
                    tokenId: BigInt(inv.tokenId!),
                    from: address,
                    to: poolAddress
                });

                try {
                    // HARDCODED ABI to ensure we are calling the correct function
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

                    setMessage(`Lock Sent. Waiting for confirmation...`);
                    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

                    if (receipt.status !== "success") {
                        setMessage("Error: Lock transaction reverted.");
                        return;
                    }
                    console.log("Lock confirmed.");

                    // Force ownership update
                    owner = poolAddress;
                } catch (e: any) {
                    // Check if maybe we are already not owner? (Race condition)
                    console.error("Lock failed:", e);
                    const fresh = await publicClient.readContract({
                        address: token.address as `0x${string}`,
                        abi: token.abi,
                        functionName: "ownerOf",
                        args: [BigInt(inv.tokenId!)]
                    }) as string;
                    if (fresh === poolAddress) {
                        console.log("Actually, pool is already owner. Proceeding.");
                        owner = fresh;
                    } else {
                        throw e;
                    }
                }
            }

            // 3. Draw Credit
            // We assume if we passed step 2 (or were already there), we can draw.
            const poolAddress = pool.address as `0x${string}`;

            if (owner === poolAddress || owner === pool.address) {
                console.log("Step 3/3: Drawing Credit...");

                // CRITICAL: Check if position actually exists on chain
                // If the user manually transferred the NFT or a previous lock failed silently,
                // the Pool might own the NFT but have no credit line recorded.
                const pos = await publicClient.readContract({
                    address: poolAddress,
                    abi: pool.abi,
                    functionName: "getPosition",
                    args: [inv.invoiceIdOnChain as `0x${string}`]
                }) as any;

                // Store position data for later use
                const maxCreditLine = pos.maxCreditLine as bigint;
                const currentUsedCredit = pos.usedCredit as bigint;

                if (!pos.exists) {
                    // RECOVERY: NFT is in Pool but position doesn't exist
                    // Automatically recover by creating the position
                    console.log("Position not found. Attempting recovery...");
                    setMessage("Step 2.5/3: Recovering position... (Please confirm in Wallet)");

                    if (!inv.invoiceIdOnChain || !inv.tokenId) {
                        setMessage("Error: Missing on-chain Invoice ID or Token ID. Please refresh the page.");
                        return;
                    }

                    try {
                        // Recovery ABI
                        const POOL_ABI_RECOVER = [
                            {
                                "inputs": [
                                    { "internalType": "bytes32", "name": "invoiceId", "type": "bytes32" },
                                    { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
                                    { "internalType": "address", "name": "company", "type": "address" }
                                ],
                                "name": "recoverLockCollateral",
                                "outputs": [],
                                "stateMutability": "nonpayable",
                                "type": "function"
                            }
                        ];

                        const txRecover = await writeContractAsync({
                            address: poolAddress,
                            abi: POOL_ABI_RECOVER,
                            functionName: "recoverLockCollateral",
                            args: [inv.invoiceIdOnChain as `0x${string}`, BigInt(inv.tokenId!), address]
                        });

                        setMessage(`Recovery Sent. Waiting for confirmation...`);
                        const receiptRecover = await publicClient.waitForTransactionReceipt({ hash: txRecover });

                        if (receiptRecover.status !== "success") {
                            setMessage("Error: Recovery transaction reverted. Please contact support.");
                            return;
                        }

                        console.log("Recovery successful. Position created.");
                        // Continue to draw credit below
                    } catch (e: any) {
                        console.error("Recovery failed:", e);
                    setMessage(
                        <div style={{ color: "#f87171" }}>
                                <strong>Recovery Failed:</strong><br />
                                {e.shortMessage || e.message}<br /><br />
                                <strong>Possible Solutions:</strong><br />
                                1. Ensure you are the company that owns this invoice<br />
                                2. Verify the NFT is actually in the Pool<br />
                                3. Contact support if the issue persists
                        </div>
                    );
                    return;
                    }
                }

                // Calculate available credit: maxCreditLine - currentUsedCredit
                // Use the full available credit (max credit line) to draw maximum possible amount
                const availableCredit = maxCreditLine - currentUsedCredit;
                
                if (availableCredit <= 0n) {
                    setMessage("No available credit. Maximum credit line already used.");
                    return;
                }
                
                // Draw the full available credit (this is the max credit line based on LTV)
                const requestedAmount = availableCredit;
                
                console.log("Credit Calculation:", {
                    invoiceAmount: inv.amount,
                    maxCreditLine: (Number(maxCreditLine) / 100).toString(),
                    currentUsedCredit: (Number(currentUsedCredit) / 100).toString(),
                    availableCredit: (Number(availableCredit) / 100).toString(),
                    requestedAmount: (Number(requestedAmount) / 100).toString()
                });

                console.log("Draw Params:", {
                    invoiceId: inv.invoiceIdOnChain,
                    amount: requestedAmount.toString(),
                    to: address
                });

                try {
                    // HARDCODED ABI for drawCredit
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
                        args: [inv.invoiceIdOnChain, requestedAmount, address]
                    });

                    setMessage(`Credit Draw Sent. Waiting for confirmation...`);
                    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

                    if (receipt.status !== "success") {
                        setMessage(
                            <div style={{ color: "#f87171" }}>
                                <strong>Error: Draw Credit transaction reverted on-chain.</strong><br />
                                <br />
                                <strong>Possible reasons:</strong><br />
                                1. Insufficient liquidity in the Pool<br />
                                2. Credit limit exceeded<br />
                                3. Position not found or invalid state<br />
                                <br />
                                Please check the transaction details or contact support.
                            </div>
                        );
                        return;
                    }

                    // Optimistic update: Update local state immediately
                    if (data) {
                        const updatedData = data.map(item => 
                            item.id === inv.id 
                                ? { ...item, status: 'FINANCED' as const, isFinanced: true }
                                : item
                        );
                        mutate(updatedData, { revalidate: false });
                    }

                    // Rich Success Message
                    setMessage(
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <h3 style={{ fontSize: "18px", fontWeight: "bold", color: "#10b981" }}>🎉 Credit Drawn Successfully!</h3>
                            <div style={{ fontSize: "14px", color: "var(--text)", lineHeight: "1.6" }}>
                                <p><strong>💸 Financed Amount:</strong> {formatAmount((Number(requestedAmount) / 100).toString(), inv.currency || "TRY")}</p>
                                <p><strong>📊 LTV Rate:</strong> 60% (Safe Limit)</p>
                                <p><strong>👛 Destination Wallet:</strong> <span style={{ fontFamily: "monospace" }}>{address}</span></p>
                                <p>
                                    <strong>🔗 Transaction:</strong>{" "}
                                    <a href={`https://sepolia.basescan.org/tx/${tx}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>
                                        View on BaseScan
                                    </a>
                                </p>
                            </div>
                        </div>
                    );
                    
                    // Wait a bit for backend listener to process the event, then refresh
                    setTimeout(async () => {
                    await mutate();
                    }, 2000);
                } catch (e: any) {
                    console.error("Draw Credit failed:", e);
                    const errorMessage = e.shortMessage || e.message || "Unknown error";
                    let userMessage = `Error drawing credit: ${errorMessage}`;
                    
                    // Check for specific error types
                    if (errorMessage.includes("insufficient liquidity")) {
                        userMessage = (
                            <div style={{ color: "#f87171" }}>
                                <strong>Insufficient Liquidity Error:</strong><br />
                                The Pool does not have enough funds to fulfill this financing request.<br />
                                <br />
                                Please contact support to fund the Pool or try again later.
                            </div>
                        );
                    } else if (errorMessage.includes("credit limit exceeded")) {
                        userMessage = (
                            <div style={{ color: "#f87171" }}>
                                <strong>Credit Limit Exceeded:</strong><br />
                                The requested amount exceeds the available credit line for this invoice.<br />
                                <br />
                                Please request a smaller amount.
                            </div>
                        );
                    } else if (errorMessage.includes("not found") || errorMessage.includes("not company")) {
                        userMessage = (
                            <div style={{ color: "#f87171" }}>
                                <strong>Position Error:</strong><br />
                                {errorMessage}<br />
                                <br />
                                Please ensure the invoice is properly tokenized and locked.
                            </div>
                        );
                    } else {
                        userMessage = (
                            <div style={{ color: "#f87171" }}>
                                <strong>Error drawing credit:</strong><br />
                                {errorMessage}
                            </div>
                        );
                    }
                    
                    setMessage(userMessage);
                }
                return;
            }

            setMessage("Error: Token owner mismatch. Expected Pool (" + pool.address + ") but got (" + owner + ").");

        } catch (e: any) {
            console.error(e);
            setMessage(e?.message ?? "Financing failed");
        } finally {
            setActionLoadingId(null);
        }
    }

    const columns = [
        {
            key: "externalId",
            title: "Invoice",
            render: (inv: Invoice) => (
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <Link href={`/invoices/${inv.id}`} style={{ fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                        {inv.externalId}
                    </Link>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{inv.id}</span>
                </div>
            ),
        },
        {
            key: "amount",
            title: "Amount",
            render: (inv: Invoice) => formatAmount(inv.amount, inv.currency || "TRY"),
        },
        {
            key: "dueDate",
            title: "Due Date",
            render: (inv: Invoice) => formatDate(inv.dueDate),
        },
        {
            key: "status",
            title: "Status",
            render: (inv: Invoice) => (
                <Badge color={statusColor(inv.status)}>{inv.status}</Badge>
            ),
        },
        {
            key: "isFinanced",
            title: "Financed",
            render: (inv: Invoice) => (
                inv.isFinanced ? <span style={{ color: "var(--accent)" }}>Yes</span> : <span style={{ color: "var(--text-muted)" }}>No</span>
            )
        },
        {
            key: "paid",
            title: "Paid",
            render: (inv: Invoice) => {
                // Calculate paid percentage based on total debt drawn (not remaining debt)
                // Note: usedCredit = remaining debt, cumulativePaid = paid amount
                // Total debt drawn = cumulativePaid + usedCredit
                let paidAmount: number;
                let totalDebtAmount: number;
                
                if (inv.isFinanced && inv.usedCredit !== undefined) {
                    // For financed invoices: calculate based on total debt drawn
                    // usedCredit = remaining debt (kalan borç)
                    // cumulativePaid = paid amount (ödenen miktar)
                    // Total debt = paid + remaining = cumulativePaid + usedCredit
                    const paidCents = Number(inv.cumulativePaid || "0");
                    const remainingDebtCents = Number(inv.usedCredit || "0");
                    const totalDebtCents = paidCents + remainingDebtCents;
                    
                    paidAmount = paidCents / 100; // Convert cents to TRY
                    totalDebtAmount = totalDebtCents / 100; // Convert cents to TRY
                } else {
                    // For non-financed invoices: use invoice amount
                    const paidCents = Number(inv.cumulativePaid || "0");
                    const invoiceAmount = Number(inv.amount || "0");
                    paidAmount = paidCents / 100; // Convert cents to TRY
                    totalDebtAmount = invoiceAmount; // Already in TRY
                }
                
                const paidPct = totalDebtAmount > 0 ? Math.min(100, Math.round((paidAmount / totalDebtAmount) * 100)) : 0;
                
                return (
                    <span style={{ fontSize: "12px" }}>
                        {paidPct}%{" "}
                        <span style={{ color: "var(--text-muted)" }}>
                            ({formatAmount(paidAmount.toFixed(2), inv.currency || "TRY")}/{formatAmount(totalDebtAmount.toFixed(2), inv.currency || "TRY")})
                        </span>
                    </span>
                )
            }
        },
        {
            key: "actions",
            title: "Actions",
            render: (inv: Invoice) => (
                <div style={{ display: "flex", gap: "8px" }}>
                    <Button
                        variant="secondary"
                        disabled={
                            actionLoadingId === inv.id || inv.status !== "ISSUED"
                        }
                        onClick={() => handleTokenize(inv)}
                    >
                        Tokenize
                    </Button>
                    <Button
                        variant="primary"
                        disabled={
                            actionLoadingId === inv.id ||
                            inv.status !== "TOKENIZED" ||
                            inv.isFinanced
                        }
                        onClick={() => handleFinance(inv)}
                    >
                        Finance
                    </Button>
                    <Button
                        variant="warning"
                        disabled={
                            actionLoadingId === inv.id || !inv.isFinanced
                        }
                        onClick={() => openRepayModal(inv)}
                    >
                        Repay
                    </Button>
                </div>
            ),
        },
    ];

    async function openRepayModal(inv: Invoice) {
        if (!address || !publicClient) {
            alert("Please connect your wallet first");
            return;
        }
        try {
            const pool = Deployments.FinancingPool;
            if (!inv.invoiceIdOnChain) {
                setMessage("Error: Missing on-chain Invoice ID.");
                return;
            }

            // Fetch current debt and position info
            console.log("Reading position for debt...", inv.invoiceIdOnChain);
            const position = await publicClient.readContract({
                address: pool.address as `0x${string}`,
                abi: pool.abi,
                functionName: "getPosition",
                args: [inv.invoiceIdOnChain]
            }) as any;

            const debt = position.usedCredit; // bigint - stored in cents (2 decimals)
            const maxCredit = position.maxCreditLine; // bigint - max available credit
            const ltv = position.ltvBps; // bigint - LTV in basis points (e.g., 6500 = 65%)
            
            console.log("Current Debt:", debt);
            console.log("Max Credit Line:", maxCredit);
            console.log("LTV:", ltv);

            if (debt === 0n) {
                setMessage("Invoice has no outstanding debt!");
                return;
            }

            setCurrentDebt(debt);
            setMaxCreditLine(maxCredit);
            setLtvBps(ltv);
            setSelectedInvoiceForRepay(inv);
            setRepayAmount("");
            setSelectedPercentage(null);
            setShowRepayModal(true);
            setMessage(null);

        } catch (e: any) {
            console.error(e);
            setMessage("Error fetching debt: " + e.message);
        }
    }

    async function executeRepayment() {
        if (!selectedInvoiceForRepay || !repayAmount) return;

        try {
            const pool = Deployments.FinancingPool;
            const token = Deployments.TestToken;

            // Convert input "50" -> 5000 (cents/wei)
            // Assuming input is "TRY" units (2 decimals)
            let amountToRepay = BigInt(Math.floor(parseFloat(repayAmount) * 100));

            // CRITICAL: Cap repayment to current debt (cannot repay more than owed)
            if (amountToRepay > currentDebt) {
                amountToRepay = currentDebt;
                setRepayAmount((Number(currentDebt) / 100).toString());
                setSelectedPercentage(100); // Auto-select 100% when capped
                return; // Don't proceed, let user see the capped amount
            }

            if (amountToRepay <= 0n) {
                return; // Invalid amount, don't proceed
            }

            // Close modal and proceed with repayment
            setShowRepayModal(false);
            setMessage(null);
            setActionLoadingId(selectedInvoiceForRepay.id);

            // 1. Check Allowance
            console.log("Checking allowance...");
            const allowance = await publicClient!.readContract({
                address: token.address as `0x${string}`,
                abi: token.abi,
                functionName: "allowance",
                args: [address, pool.address]
            }) as bigint;

            if (allowance < amountToRepay) {
                setMessage("Step 1/2: Approving Payment Token... (Please confirm)");
                const tx = await writeContractAsync({
                    address: token.address as `0x${string}`,
                    abi: token.abi,
                    functionName: "approve",
                    args: [pool.address, amountToRepay]
                });
                setMessage(`Approval Sent. Waiting for confirmation...`);
                await publicClient!.waitForTransactionReceipt({ hash: tx });
                console.log("Approval confirmed.");
            }

            // 2. Repay
            setMessage("Step 2/2: Repaying Credit... (Please confirm)");
            const tx = await writeContractAsync({
                address: pool.address as `0x${string}`,
                abi: pool.abi,
                functionName: "repayCredit",
                args: [selectedInvoiceForRepay.invoiceIdOnChain, amountToRepay]
            });

            setMessage(`Repayment Sent. Waiting for confirmation...`);
            const receipt = await publicClient!.waitForTransactionReceipt({ hash: tx });

            if (receipt.status === "success") {
                // Optimistic update: Update local state immediately
                if (data && selectedInvoiceForRepay) {
                    const paidAmount = BigInt(Math.floor(parseFloat(repayAmount) * 100));
                    const currentPaid = BigInt(selectedInvoiceForRepay.cumulativePaid || "0");
                    const newPaid = currentPaid + paidAmount;
                    const invoiceAmount = BigInt(Math.floor(parseFloat(selectedInvoiceForRepay.amount || "0") * 100));
                    
                    const updatedData = data.map(item => {
                        if (item.id === selectedInvoiceForRepay.id) {
                            const newStatus = newPaid >= invoiceAmount ? 'PAID' as const : 
                                             newPaid > 0n ? 'PARTIALLY_PAID' as const : 
                                             item.status;
                            return { 
                                ...item, 
                                cumulativePaid: newPaid.toString(),
                                status: newStatus
                            };
                        }
                        return item;
                    });
                    mutate(updatedData, { revalidate: false });
                }
                
                setMessage(
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <h3 style={{ fontSize: "18px", fontWeight: "bold", color: "#10b981" }}>💸 Repayment Successful!</h3>
                        <p>Paid: {formatAmount(repayAmount, "TRY")}</p>
                        <p>
                            <a href={`https://sepolia.basescan.org/tx/${tx}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>
                                View on BaseScan
                            </a>
                        </p>
                        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            Note: Collateral (NFT) is still locked in the pool until released by Admin.
                        </p>
                    </div>
                );
                
                // Wait a bit for backend listener to process the event, then refresh
                setTimeout(async () => {
                await mutate();
                }, 2000);
            } else {
                setMessage("Error: Repayment transaction reverted.");
            }

        } catch (e: any) {
            console.error(e);
            setMessage(e?.message ?? "Repayment failed");
        } finally {
            setActionLoadingId(null);
        }
    }

    return (
        <div>
            <header style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1 style={{ fontSize: "28px", fontWeight: 700 }}>Companies & Invoices</h1>
                    <p style={{ color: "var(--text-muted)", marginTop: "4px" }}>
                        Manage your invoice portfolio, tokenize assets, and request financing.
                    </p>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <Button
                        variant="secondary"
                        onClick={async () => {
                            // Clear SWR cache and refresh
                            await mutate();
                            // Force page reload to clear all caches
                            window.location.reload();
                        }}
                        style={{ fontSize: "12px", padding: "6px 12px" }}
                    >
                        🔄 Clear Cache & Refresh
                    </Button>
                    {companies && (
                        <select
                            style={{
                                padding: "8px",
                                borderRadius: "var(--radius)",
                                background: "var(--bg-card)",
                                color: "var(--text)",
                                border: "1px solid var(--border)"
                            }}
                            value={selectedCompanyId || ""}
                            onChange={(e) => setSelectedCompanyId(e.target.value)}
                        >
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
                        </select>
                    )}
                    <Button onClick={() => setShowCreate(!showCreate)}>
                        {showCreate ? "Cancel" : "+ New Invoice"}
                    </Button>
                </div>
            </header>

            {companyError && (
                <div style={{ padding: "12px", marginBottom: "16px", background: "#f87171", color: "#fff", borderRadius: "8px" }}>
                    Error loading companies: {companyError.message}. Is Backend running at port 4000?
                </div>
            )}

            {/* Cashflow Chart */}
            <div style={{ marginBottom: "24px" }}>
                {cashflow && (
                    <Card>
                        <h3 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: 600 }}>Cashflow Forecast (90 Days)</h3>
                        <div style={{ height: "250px" }}>
                            <CashflowChart data={cashflow} />
                        </div>
                    </Card>
                )}
            </div>

            {showCreate && (
                <Card style={{ marginBottom: "24px", border: "1px solid var(--accent)" }}>
                    <h3 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: 600 }}>Create New Invoice</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>Invoice No</label>
                            <input
                                style={{
                                    padding: "8px", background: "var(--bg-panel)", border: "1px solid var(--border)",
                                    color: "var(--text)", borderRadius: "4px"
                                }}
                                value={newInv.externalId}
                                onChange={e => setNewInv({ ...newInv, externalId: e.target.value })}
                            />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>Amount</label>
                            <input
                                style={{
                                    padding: "8px", background: "var(--bg-panel)", border: "1px solid var(--border)",
                                    color: "var(--text)", borderRadius: "4px"
                                }}
                                value={newInv.amount}
                                onChange={e => setNewInv({ ...newInv, amount: e.target.value })}
                            />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>Due Date</label>
                            <input
                                type="date"
                                style={{
                                    padding: "8px", background: "var(--bg-panel)", border: "1px solid var(--border)",
                                    color: "var(--text)", borderRadius: "4px"
                                }}
                                value={newInv.dueDate}
                                onChange={e => setNewInv({ ...newInv, dueDate: e.target.value })}
                            />
                        </div>
                    </div>
                    <Button onClick={handleCreate}>Create Invoice</Button>
                </Card>
            )}

            {/* Modern Repayment Modal */}
            {showRepayModal && selectedInvoiceForRepay && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
                    animation: "fadeIn 0.2s ease-in"
                }}>
                    <Card style={{
                        width: "90%", maxWidth: "500px",
                        border: "1px solid var(--border)",
                        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3), 0 10px 10px -5px rgba(0,0,0,0.2)",
                        animation: "slideUp 0.3s ease-out"
                    }}>
                        {/* Header */}
                        <div style={{ marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
                            <h3 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                                💸 Repay Credit
                            </h3>
                            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                                Invoice: <strong style={{ color: "var(--text)" }}>{selectedInvoiceForRepay.externalId}</strong>
                            </p>
                        </div>

                        {/* Current Debt Display */}
                        <div style={{
                            marginBottom: "24px",
                            padding: "24px",
                            background: "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)",
                            border: "2px solid rgba(239, 68, 68, 0.3)",
                            borderRadius: "12px"
                        }}>
                            <div style={{ textAlign: "center", marginBottom: "16px" }}>
                                <p style={{ color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                                    Outstanding Debt
                                </p>
                                <p style={{ fontSize: "36px", fontWeight: 700, color: "#ef4444", margin: 0, lineHeight: 1.2 }}>
                                    {formatAmount((Number(currentDebt) / 100).toString(), selectedInvoiceForRepay.currency || "TRY")}
                                </p>
                            </div>
                            <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                paddingTop: "16px",
                                borderTop: "1px solid rgba(239, 68, 68, 0.2)",
                                fontSize: "12px",
                                color: "var(--text-muted)"
                            }}>
                                <div>
                                    <span style={{ display: "block", marginBottom: "4px" }}>Max Credit Line:</span>
                                    <span style={{ color: "var(--text)", fontWeight: 600 }}>
                                        {formatAmount((Number(maxCreditLine) / 100).toString(), selectedInvoiceForRepay.currency || "TRY")}
                                    </span>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <span style={{ display: "block", marginBottom: "4px" }}>LTV Rate:</span>
                                    <span style={{ color: "var(--text)", fontWeight: 600 }}>
                                        {Number(ltvBps) / 100}%
                                    </span>
                                </div>
                            </div>
                            <div style={{
                                marginTop: "12px",
                                padding: "10px",
                                background: "rgba(59, 130, 246, 0.1)",
                                border: "1px solid rgba(59, 130, 246, 0.3)",
                                borderRadius: "8px",
                                fontSize: "11px",
                                color: "var(--text-muted)",
                                lineHeight: "1.5"
                            }}>
                                <strong style={{ color: "var(--text)", display: "block", marginBottom: "4px" }}>💡 How This Works:</strong>
                                <div style={{ marginTop: "4px" }}>
                                    • <strong>Outstanding Debt</strong> = Amount you actually borrowed (₺{formatAmount((Number(currentDebt) / 100).toString(), selectedInvoiceForRepay.currency || "TRY")})<br />
                                    • <strong>Max Credit Line</strong> = Invoice Amount × LTV Rate = {formatAmount(selectedInvoiceForRepay.amount, selectedInvoiceForRepay.currency || "TRY")} × {Number(ltvBps) / 100}%<br />
                                    • You can repay up to the outstanding debt amount shown above
                                </div>
                            </div>
                        </div>

                        {/* Percentage Quick Select */}
                        <div style={{ marginBottom: "24px" }}>
                            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", marginBottom: "12px", display: "block" }}>
                                Quick Select
                            </label>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(5, 1fr)",
                                gap: "8px"
                            }}>
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
                                                padding: "12px 8px",
                                                background: isSelected
                                                    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                                                    : "var(--bg-panel)",
                                                border: `2px solid ${isSelected ? "#667eea" : "var(--border)"}`,
                                                borderRadius: "8px",
                                                color: isSelected ? "white" : "var(--text)",
                                                fontSize: "14px",
                                                fontWeight: isSelected ? 700 : 500,
                                                cursor: "pointer",
                                                transition: "all 0.2s ease",
                                                transform: isSelected ? "scale(1.05)" : "scale(1)",
                                                boxShadow: isSelected ? "0 4px 12px rgba(102, 126, 234, 0.4)" : "none"
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = "var(--bg-hover)";
                                                    e.currentTarget.style.borderColor = "#667eea";
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = "var(--bg-panel)";
                                                    e.currentTarget.style.borderColor = "var(--border)";
                                                }
                                            }}
                                        >
                                            {percent}%
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Manual Amount Input - Modern Design */}
                        <div style={{ marginBottom: "24px" }}>
                            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", marginBottom: "12px", display: "block" }}>
                                Or Enter Custom Amount
                            </label>
                            <div style={{
                                position: "relative",
                                background: "linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)",
                                border: "2px solid rgba(102, 126, 234, 0.2)",
                                borderRadius: "12px",
                                padding: "2px",
                                transition: "all 0.3s ease"
                            }}>
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    background: "var(--bg-panel)",
                                    borderRadius: "10px",
                                    padding: "0 4px"
                                }}>
                            <input
                                autoFocus
                                type="number"
                                        step="0.01"
                                        min="0"
                                        max={Number(currentDebt) / 100}
                                style={{
                                            flex: 1,
                                            padding: "16px 12px",
                                            background: "transparent",
                                            border: "none",
                                            outline: "none",
                                            color: "var(--text)",
                                            fontSize: "18px",
                                            fontWeight: 600,
                                            fontFamily: "ui-monospace, monospace"
                                }}
                                value={repayAmount}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setRepayAmount(value);
                                            // Clear percentage selection if manually edited
                                            if (selectedPercentage !== null) {
                                                const expectedAmount = (Number(currentDebt) / 100) * (selectedPercentage / 100);
                                                if (Math.abs(parseFloat(value || "0") - expectedAmount) > 0.01) {
                                                    setSelectedPercentage(null);
                                                }
                                            }
                                            // Cap to max debt
                                            const numValue = parseFloat(value);
                                            if (!isNaN(numValue) && numValue > Number(currentDebt) / 100) {
                                                setRepayAmount((Number(currentDebt) / 100).toString());
                                            }
                                        }}
                                        placeholder="0.00"
                                    />
                                    <div style={{
                                        padding: "8px 16px",
                                        background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
                                        borderRadius: "8px",
                                        marginLeft: "8px"
                                    }}>
                                        <span style={{
                                            color: "var(--text)",
                                            fontSize: "14px",
                                            fontWeight: 700,
                                            letterSpacing: "0.5px"
                                        }}>
                                            {selectedInvoiceForRepay.currency || "TRY"}
                                        </span>
                            </div>
                                </div>
                            </div>
                            {repayAmount && parseFloat(repayAmount) > 0 && (
                                <div style={{
                                    marginTop: "12px",
                                    padding: "12px",
                                    background: parseFloat(repayAmount) > Number(currentDebt) / 100
                                        ? "rgba(239, 68, 68, 0.1)"
                                        : "rgba(34, 197, 94, 0.1)",
                                    border: `1px solid ${parseFloat(repayAmount) > Number(currentDebt) / 100 ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
                                    borderRadius: "8px",
                                    fontSize: "13px"
                                }}>
                                    {parseFloat(repayAmount) > Number(currentDebt) / 100 ? (
                                        <span style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span>⚠️</span>
                                            <span>Amount exceeds debt. Will be capped to <strong>{formatAmount((Number(currentDebt) / 100).toString(), selectedInvoiceForRepay.currency || "TRY")}</strong></span>
                                        </span>
                                    ) : (
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ color: "var(--text-muted)" }}>
                                                Remaining debt:
                                            </span>
                                            <span style={{ color: "#22c55e", fontWeight: 700, fontSize: "15px" }}>
                                                {formatAmount(((Number(currentDebt) / 100) - parseFloat(repayAmount)).toFixed(2), selectedInvoiceForRepay.currency || "TRY")}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "32px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setShowRepayModal(false);
                                    setRepayAmount("");
                                    setSelectedPercentage(null);
                                }}
                                style={{ minWidth: "100px" }}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={executeRepayment}
                                disabled={!repayAmount || parseFloat(repayAmount) <= 0 || parseFloat(repayAmount) > Number(currentDebt) / 100}
                                style={{
                                    minWidth: "140px",
                                    background: parseFloat(repayAmount) > 0 && parseFloat(repayAmount) <= Number(currentDebt) / 100
                                        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                                        : undefined,
                                    opacity: (!repayAmount || parseFloat(repayAmount) <= 0 || parseFloat(repayAmount) > Number(currentDebt) / 100) ? 0.5 : 1
                                }}
                            >
                                💳 Confirm Payment
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {message && (
                <div
                    style={{
                        marginBottom: "16px",
                        padding: "12px 16px",
                        borderRadius: "var(--radius)",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        color: "var(--accent)",
                        fontSize: "14px",
                    }}
                >
                    {message}
                </div>
            )}

            {isLoading && <p>Loading invoices...</p>}
            {error && <p style={{ color: "#f87171" }}>Failed to load invoices.</p>}

            {data && data.length === 0 && (
                <Card>
                    <p style={{ textAlign: "center", color: "var(--text-muted)" }}>No invoices yet.</p>
                </Card>
            )}

            {data && data.length > 0 && (
                <Card style={{ padding: 0, overflow: "hidden" }}>
                    <Table columns={columns} data={data} />
                </Card>
            )}
        </div>
    );
}
