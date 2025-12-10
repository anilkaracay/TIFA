import { env } from "./env";
import { fetchActiveInvoices } from "./subgraphClient";
import { computeRiskScore, determineAction } from "./logic";
import { updateInvoiceStatus, requestFinancing } from "./backendClient";

console.log("TIFA Finance Agent started 🤖");
console.log(`Polling every ${env.POLL_INTERVAL_MS}ms...`);
console.log(`Subgraph: ${env.SUBGRAPH_URL}`);
console.log(`Backend: ${env.BACKEND_URL}`);

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
                await updateInvoiceStatus(inv.id, nextStatus);
            }

            if (shouldFinance) {
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
