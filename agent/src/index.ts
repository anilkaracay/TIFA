import { env } from "./env";
import { fetchActiveInvoices } from "./subgraphClient";
import { computeRiskScore, determineAction } from "./logic";
import { updateInvoiceStatus, requestFinancing } from "./backendClient";
import { onchainUpdateStatus, onchainFinanceDraw } from "./onchain/actions";
import { signer } from "./onchain/provider";

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
            }

            if (nextStatus) {
                // 1. Update On-Chain Registry
                if (inv.invoiceIdOnChain) {
                    try {
                        await onchainUpdateStatus(inv.invoiceIdOnChain, nextStatus);
                        console.log(`[Agent] On-chain status updated for ${inv.externalId}`);
                    } catch (e: any) {
                        console.error(`[Agent] On-chain update failed: ${e.message}`);
                    }
                }
                // 2. Update Backend DB
                await updateInvoiceStatus(inv.id, nextStatus);
            }

            if (shouldFinance) {
                // 1. Trigger On-Chain Draw (if agent is authorized/logic permits)
                if (inv.invoiceIdOnChain) {
                    try {
                        // Example amount: 0.01 ETH for demo
                        await onchainFinanceDraw(inv.invoiceIdOnChain, "10000000000000000", signer.address);
                        console.log(`[Agent] On-chain finance draw triggered for ${inv.externalId}`);
                    } catch (e: any) {
                        console.error(`[Agent] On-chain drawe failed: ${e.message}`);
                    }
                }

                // 2. Notify Backend
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
