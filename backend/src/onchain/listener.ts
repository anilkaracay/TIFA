
import { ethers } from "ethers";
import { provider, loadContract } from "./provider";
import { prisma } from "../db";
import { emitInvoiceEvent, emitPoolEvent } from "../websocket/server";

export function startEventListeners() {
    console.log("Starting on-chain event listeners...");

    const InvoiceToken = loadContract("InvoiceToken");

    // Listen for InvoiceMinted
    InvoiceToken.on("InvoiceMinted", async (invoiceId, tokenId, issuer, debtor, amount, dueDate, currency, event) => {
        console.log(`[Event] InvoiceMinted: ${invoiceId} (Token: ${tokenId})`);

        try {
            // Convert bytes32 invoiceId back to string (remove trailing zeros)
            const cleanInvoiceId = ethers.utils.parseBytes32String(invoiceId);
            console.log(`Matching DB Invoice: ${cleanInvoiceId}`);

            // Find invoice by externalId (which we used as the source for bytes32)
            // Or we should have stored the bytes32 in db? 
            // In createInvoice we stored 'externalId'. The frontend did stringToHex(inv.id).
            // Wait, frontend used `inv.id` for stringToHex. `inv.id` is UUID usually?
            // Let's check frontend/app/page.tsx: stringToHex(inv.id, { size: 32 })
            // So on-chain invoiceId IS the hex of internal DB UUID.

            // So we need to find the invoice where id matches.
            // But we can't reverse the hash easily if it was keccak, but stringToHex is just hex encoding.
            // viem stringToHex fits it in 32 bytes.

            // However, `ethers.utils.parseBytes32String` reverts `ethers.utils.formatBytes32String`.
            // Frontend used `stringToHex`. If it fits in 32 bytes, it's basically utf8->hex.
            // ethers parseBytes32String decodes that.

            // The UUID `cmj1...` is 25 chars. Fits in 32 bytes (32 chars).

            // So `cleanInvoiceId` should be the UUID.

            const updated = await prisma.invoice.update({
                where: { id: cleanInvoiceId },
                data: {
                    status: 'TOKENIZED',
                    tokenId: tokenId.toString(),
                    invoiceIdOnChain: invoiceId,
                    tokenAddress: InvoiceToken.address
                }
            });
            console.log(`DB updated for ${cleanInvoiceId}`);
            
            // Emit WebSocket event
            emitInvoiceEvent(cleanInvoiceId, {
                type: 'invoice.tokenized',
                payload: {
                    invoiceId: cleanInvoiceId,
                    externalId: updated.externalId,
                    tokenId: tokenId.toString(),
                    invoiceIdOnChain: invoiceId,
                    txHash: event.transactionHash,
                },
            });
        } catch (e) {
            console.error("Error handling InvoiceMinted:", e);
        }
    });

    // Listen for Financing events if needed later (CollateralLocked, CreditDrawn)
    const FinancingPool = loadContract("FinancingPool");

    FinancingPool.on("CollateralLocked", async (invoiceId, tokenId, company, creditLine, ltvBps, event) => {
        console.log(`[Event] CollateralLocked: ${invoiceId}`);
        // Update internal state if tracking "Locked" but not yet financed?
    });

    FinancingPool.on("CreditDrawn", async (invoiceId, amount, to, event) => {
        console.log(`[Event] CreditDrawn: ${invoiceId}`);
        try {
            const cleanInvoiceId = ethers.utils.parseBytes32String(invoiceId);
            
            // Read position to get usedCredit and maxCreditLine
            const position = await FinancingPool.getPosition(invoiceId);
            
            let usedCredit = amount.toString();
            let maxCreditLine = amount.toString();
            
            if (position.exists) {
                usedCredit = position.usedCredit.toString();
                maxCreditLine = position.maxCreditLine.toString();
            }
            
            const updated = await prisma.invoice.update({
                where: { id: cleanInvoiceId },
                data: {
                    status: 'FINANCED',
                    isFinanced: true,
                    usedCredit: usedCredit,
                    maxCreditLine: maxCreditLine,
                }
            });
            console.log(`DB updated (FINANCED) for ${cleanInvoiceId}`);
            
            // Emit WebSocket events
            emitInvoiceEvent(cleanInvoiceId, {
                type: 'invoice.financed',
                payload: {
                    invoiceId: cleanInvoiceId,
                    externalId: updated.externalId,
                    approvedAmount: amount.toString(),
                    txHash: event.transactionHash,
                },
            });
            emitPoolEvent({
                type: 'pool.utilization_changed',
                payload: {},
            });
        } catch (e) {
            console.error("Error handling CreditDrawn:", e);
        }
    });

    FinancingPool.on("CreditRepaid", async (invoiceId, amount, remainingDebt, event) => {
        console.log(`[Event] CreditRepaid: ${invoiceId}, Amt: ${amount}, Remaining: ${remainingDebt}`);
        try {
            const cleanInvoiceId = ethers.utils.parseBytes32String(invoiceId);

            // Fetch current invoice to get cumulativePaid
            const inv = await prisma.invoice.findUnique({ where: { id: cleanInvoiceId } });
            if (!inv) return;

            // Read position to get current usedCredit
            const position = await FinancingPool.getPosition(invoiceId);
            const currentUsedCredit = position.exists ? position.usedCredit.toString() : remainingDebt.toString();

            // Treat repayment as "payment towards invoice"
            const currentPaid = BigInt(inv.cumulativePaid || "0");
            const newPaid = currentPaid + BigInt(amount.toString());

            const newStatus = BigInt(remainingDebt.toString()) === 0n ? 'PAID' : 'PARTIALLY_PAID';

            const updated = await prisma.invoice.update({
                where: { id: cleanInvoiceId },
                data: {
                    status: newStatus,
                    cumulativePaid: newPaid.toString(),
                    usedCredit: currentUsedCredit,
                    // If fully repaid, we might consider isFinanced = false? 
                    // Or keep it true but status PAID? Let's keep isFinanced true as history.
                }
            });
            console.log(`DB updated (${newStatus}) for ${cleanInvoiceId}. Paid: ${newPaid}, Remaining: ${remainingDebt}`);
            
            // Emit WebSocket events
            emitInvoiceEvent(cleanInvoiceId, {
                type: 'invoice.repaid',
                payload: {
                    invoiceId: cleanInvoiceId,
                    externalId: updated.externalId,
                    repaidAmount: amount.toString(),
                    remainingDebt: currentUsedCredit,
                    totalDebt: currentUsedCredit,
                    status: newStatus,
                    txHash: event.transactionHash,
                },
            });
            emitPoolEvent({
                type: 'pool.utilization_changed',
                payload: {},
            });
        } catch (e) {
            console.error("Error handling CreditRepaid:", e);
        }
    });

    console.log("Listeners attached.");
}
