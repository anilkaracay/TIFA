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
        () => fetcher(selectedCompanyId!)
    );

    // 3. Fetch Cashflow for Selected Company
    const { data: cashflow } = useSWR<CashflowResponse>(
        selectedCompanyId ? ["cashflow", selectedCompanyId] : null,
        () => cashflowFetcher(selectedCompanyId!)
    );

    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [newInv, setNewInv] = useState({
        externalId: "INV-" + Math.floor(Math.random() * 10000),
        amount: "50000",
        currency: "TRY",
        dueDate: "2025-12-31",
        companyId: "satici_a",
        debtorId: "alici_b"
    });

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

            setMessage(`Transaction sent: ${txHash}`);
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

                console.log("Locking Params:", {
                    invoiceId: inv.invoiceIdOnChain,
                    tokenId: BigInt(inv.tokenId!),
                    from: address,
                    to: pool.address
                });

                try {
                    const tx = await writeContractAsync({
                        address: pool.address as `0x${string}`,
                        abi: pool.abi,
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
                } catch (e: any) {
                    // Check if maybe we are already not owner? (Race condition)
                    console.error("Lock failed:", e);
                    const fresh = await publicClient.readContract({
                        address: token.address as `0x${string}`,
                        abi: token.abi,
                        functionName: "ownerOf",
                        args: [BigInt(inv.tokenId!)]
                    }) as string;
                    if (fresh === pool.address) {
                        console.log("Actually, pool is already owner. Proceeding.");
                        owner = fresh;
                    } else {
                        throw e;
                    }
                }

                // Poll for state update (indexer latency)
                setMessage("Verifying ownership change (this may take 30s)...");
                let retries = 15; // 30 seconds
                while (retries > 0 && owner !== pool.address) {
                    await new Promise(r => setTimeout(r, 2000));
                    const freshOwner = await publicClient.readContract({
                        address: token.address as `0x${string}`,
                        abi: token.abi,
                        functionName: "ownerOf",
                        args: [BigInt(inv.tokenId!)]
                    }) as string;

                    console.log(`Polling owner: ${freshOwner} (Want: ${pool.address})`);
                    if (freshOwner === pool.address) {
                        owner = freshOwner;
                        break;
                    }
                    retries--;
                }

                if (owner !== pool.address) {
                    setMessage("⚠️ Network Latency: Transaction confirmed but ownership update is slow. Please wait 1 minute then click 'Finance' again.");
                    return;
                }
            }

            // 3. Draw Credit
            // We assume if we passed step 2 (or were already there), we can draw.
            if (owner === pool.address) {
                setMessage("Step 3/3: Drawing Credit... (Please confirm in Wallet)");
                // Contract LTV is 65%. We request 60% to be safe.
                const requestedAmount = BigInt(Math.floor(parseFloat(inv.amount || "0") * 100 * 0.6));

                try {
                    const tx = await writeContractAsync({
                        address: pool.address as `0x${string}`,
                        abi: pool.abi,
                        functionName: "drawCredit",
                        args: [inv.invoiceIdOnChain, requestedAmount, address]
                    });

                    setMessage(`Credit Draw Sent. Waiting for confirmation...`);
                    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

                    if (receipt.status !== "success") {
                        setMessage("Error: Draw Credit transaction reverted on-chain.");
                        return;
                    }

                    setMessage(`Success! Funds sent to wallet. Tx: ${tx}`);
                    await mutate();
                } catch (e: any) {
                    console.error("Draw Credit failed:", e);
                    setMessage(`Error drawing credit: ${e.shortMessage || e.message}`);
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
                const paid = Number(inv.cumulativePaid || "0");
                const total = Number(inv.amount || "0");
                const paidPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                return (
                    <span style={{ fontSize: "12px" }}>
                        {paidPct}%{" "}
                        <span style={{ color: "var(--text-muted)" }}>
                            ({inv.cumulativePaid}/{inv.amount})
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
                </div>
            ),
        },
    ];

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
