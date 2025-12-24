import { env } from "./env";
import { fetchActiveInvoices } from "./subgraphClient";
import { computeRiskScore, determineAction } from "./logic";
import { updateInvoiceStatus, requestFinancing } from "./backendClient";
import { onchainUpdateStatus, onchainFinanceDraw } from "./onchain/actions";
import { signer } from "./onchain/provider";
import { logAgentDecision } from "./backendLogger";
import { canFinance, isPoolProtected, getPoolState } from "./poolGuard";

console.log("TIFA Finance Agent started 🤖");
console.log(`Polling every ${env.POLL_INTERVAL_MS}ms...`);
console.log(`Subgraph: ${env.SUBGRAPH_URL}`);
console.log(`Backend: ${env.BACKEND_URL}`);
console.log(`Wallet: ${signer.address}`);

async function tick() {
    try {
        const invoices = await fetchActiveInvoices();

        if (invoices.length === 0) {
            // console.log("No active invoices found."); 
            return;
        }

        console.log(`[Agent] Analyzed ${invoices.length} active invoices.`);

        // Check pool state once per tick
        const poolState = await getPoolState();
        const poolProtected = await isPoolProtected();
        
        // SAFETY CHECK: If pool is paused, skip all actions
        if (poolState.paused) {
            console.log(`[Agent] ⛔ Pool is PAUSED. Skipping all actions.`);
            return;
        }
        
        if (poolProtected) {
            console.log(`[Agent] ⚠️  Pool Protection Active: Utilization ${poolState.utilizationPercent.toFixed(2)}% (threshold: 75%)`);
        }

        for (const inv of invoices) {
            const risk = computeRiskScore(inv);
            
            // Check if we can finance this invoice (liquidity + safety checks)
            const invoiceAmount = BigInt(inv.amount);
            const financeCheck = await canFinance(invoiceAmount, inv.issuer);
            
            // If finance is blocked due to safety guardrails, log structured message
            if (!financeCheck.canFinance && financeCheck.reason) {
                const reason = financeCheck.reason;
                if (reason === "POOL_PAUSED" || reason.includes("UTILIZATION_LIMIT") || 
                    reason.includes("MAX_SINGLE_LOAN") || reason.includes("ISSUER_EXPOSURE")) {
                    console.log(`[Agent] 🛡️  Safety Guardrail: Invoice ${inv.externalId} blocked. Reason: ${reason}`);
                    // Log to backend for observability
                    await logAgentDecision({
                        invoiceExternalId: inv.externalId,
                        invoiceOnChainId: inv.invoiceIdOnChain,
                        actionType: "SAFETY_BLOCKED",
                        message: `Safety guardrail triggered: ${reason}`,
                    });
                    continue; // Skip this invoice, don't attempt action
                }
            }
            
            const { nextStatus, shouldFinance, financeBlocked, financeBlockReason } = determineAction(inv, financeCheck);

            if (nextStatus || shouldFinance || financeBlocked) {
                const actions = [];
                if (nextStatus) actions.push(`Set Status ${nextStatus}`);
                if (shouldFinance) actions.push('REQ FINANCE');
                if (financeBlocked) actions.push(`BLOCKED: ${financeBlockReason}`);
                console.log(`[Agent] Invoice ${inv.externalId}: Risk=${risk}/100 -> ${actions.join(', ')}`);
            } else {
                console.log(`[Agent] Invoice ${inv.externalId}: Risk=${risk}/100 -> No Action (Status: ${inv.status}, Financed: ${inv.isFinanced})`);
            }

            if (nextStatus) {
                // 1. Update On-Chain Registry
                let txHash = undefined;
                if (inv.invoiceIdOnChain) {
                    try {
                        const receipt = await onchainUpdateStatus(inv.invoiceIdOnChain, nextStatus);
                        txHash = receipt.transactionHash;
                        console.log(`[Agent] On-chain status updated for ${inv.externalId}`);
                    } catch (e: any) {
                        console.error(`[Agent] On-chain update failed: ${e.message}`);
                    }
                }

                // 2. Log Decision to Backend
                await logAgentDecision({
                    invoiceId: inv.id,
                    invoiceExternalId: inv.externalId,
                    invoiceOnChainId: inv.invoiceIdOnChain,
                    actionType: "STATUS_UPDATE",
                    previousStatus: inv.status,
                    nextStatus,
                    riskScore: risk,
                    txHash,
                    message: `Agent updated status to ${nextStatus}`,
                });

                // 3. Update Backend DB (Legacy/Sync)
                await updateInvoiceStatus(inv.id, nextStatus);
            }

            if (financeBlocked) {
                // Log blocked financing decision
                await logAgentDecision({
                    invoiceId: inv.id,
                    invoiceExternalId: inv.externalId,
                    invoiceOnChainId: inv.invoiceIdOnChain,
                    actionType: "FINANCE_BLOCKED",
                    previousStatus: inv.status,
                    riskScore: risk,
                    message: `Finance blocked: ${financeBlockReason}. Pool utilization: ${poolState.utilizationPercent.toFixed(2)}%`,
                });
            }

            if (shouldFinance && !financeBlocked) {
                // 1. Trigger On-Chain Draw (if agent is authorized/logic permits)
                let txHash = undefined;
                if (inv.invoiceIdOnChain) {
                    try {
                        // Calculate amount based on invoice (60% LTV)
                        const invoiceAmount = BigInt(inv.amount);
                        const amount = (invoiceAmount * BigInt(6000)) / BigInt(10000); // 60% LTV
                        
                        // Final liquidity check before drawing
                        const finalCheck = await canFinance(amount);
                        if (!finalCheck.canFinance) {
                            console.log(`[Agent] ⚠️  Final check failed for ${inv.externalId}: ${finalCheck.reason}`);
                            await logAgentDecision({
                                invoiceId: inv.id,
                                invoiceExternalId: inv.externalId,
                                invoiceOnChainId: inv.invoiceIdOnChain,
                                actionType: "FINANCE_BLOCKED",
                                previousStatus: inv.status,
                                riskScore: risk,
                                message: `Final liquidity check failed: ${finalCheck.reason}`,
                            });
                            continue; // Skip this invoice
                        }
                        
                        const receipt = await onchainFinanceDraw(inv.invoiceIdOnChain, amount.toString(), signer.address);
                        txHash = receipt.transactionHash;
                        console.log(`[Agent] ✅ On-chain finance draw triggered for ${inv.externalId}`);
                    } catch (e: any) {
                        console.error(`[Agent] ❌ On-chain draw failed: ${e.message}`);
                        await logAgentDecision({
                            invoiceId: inv.id,
                            invoiceExternalId: inv.externalId,
                            invoiceOnChainId: inv.invoiceIdOnChain,
                            actionType: "FINANCE_FAILED",
                            previousStatus: inv.status,
                            riskScore: risk,
                            message: `On-chain draw failed: ${e.message}`,
                        });
                    }
                }

                // 2. Log Decision
                await logAgentDecision({
                    invoiceId: inv.id,
                    invoiceExternalId: inv.externalId,
                    invoiceOnChainId: inv.invoiceIdOnChain,
                    actionType: "FINANCE",
                    previousStatus: inv.status,
                    nextStatus: "FINANCED",
                    riskScore: risk,
                    txHash,
                    message: `Agent requested financing. Pool utilization: ${poolState.utilizationPercent.toFixed(2)}%`,
                });

                // 3. Notify Backend
                await requestFinancing(inv.id);
            }
        }
    } catch (err) {
        console.error("[Agent Error] Tick failed:", err);
    }
}

// Initial run
tick();

// Schedule
setInterval(tick, env.POLL_INTERVAL_MS);
