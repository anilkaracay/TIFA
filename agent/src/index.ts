import { env } from "./env";
import { fetchActiveInvoices } from "./subgraphClient";
import { computeRiskScore, determineAction } from "./logic";
import { updateInvoiceStatus, requestFinancing } from "./backendClient";
import { onchainUpdateStatus, onchainFinanceDraw } from "./onchain/actions";
import { signer } from "./onchain/provider";
import { logAgentDecision } from "./backendLogger";

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

        for (const inv of invoices) {
            const risk = computeRiskScore(inv);
            const { nextStatus, shouldFinance } = determineAction(inv);

            if (nextStatus || shouldFinance) {
                console.log(`[Agent] Invoice ${inv.externalId}: Risk=${risk}/100 -> Action: ${nextStatus ? `Set Status ${nextStatus}` : ''} ${shouldFinance ? 'REQ FINANCE' : ''}`);
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

            if (shouldFinance) {
                // 1. Trigger On-Chain Draw (if agent is authorized/logic permits)
                let txHash = undefined;
                if (inv.invoiceIdOnChain) {
                    try {
                        // Example amount: 0.01 ETH for demo
                        const amount = "10000000000000000";
                        const receipt = await onchainFinanceDraw(inv.invoiceIdOnChain, amount, signer.address);
                        txHash = receipt.transactionHash;
                        console.log(`[Agent] On-chain finance draw triggered for ${inv.externalId}`);
                    } catch (e: any) {
                        console.error(`[Agent] On-chain drawe failed: ${e.message}`);
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
                    message: `Agent requested financing`,
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
