
import { ethers } from "ethers";
import { loadContract } from "./provider";
import { prisma } from "../db";
import { emitInvoiceEvent, emitPoolEvent } from "../websocket/server";
import { NETWORKS } from "@tifa/config";

async function startChainListeners(chainId: number, networkName: string) {
    console.log(`Starting listeners for ${networkName} (Chain ${chainId})...`);

    try {
        const InvoiceToken = loadContract("InvoiceToken", chainId);

        // Listen for InvoiceMinted
        InvoiceToken.on("InvoiceMinted", async (invoiceId, tokenId, issuer, debtor, amount, dueDate, currency, event) => {
            console.log(`[${networkName}] InvoiceMinted: ${invoiceId} (Token: ${tokenId})`);

            try {
                // Convert bytes32 invoiceId back to string (remove trailing zeros)
                const cleanInvoiceId = ethers.utils.parseBytes32String(invoiceId);
                console.log(`Matching DB Invoice: ${cleanInvoiceId}`);

                const updated = await prisma.invoice.update({
                    where: { id: cleanInvoiceId },
                    data: {
                        status: 'TOKENIZED',
                        tokenId: tokenId.toString(),
                        invoiceIdOnChain: invoiceId,
                        tokenAddress: InvoiceToken.address
                        // TODO: Add networkKey here when DB supports it
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
                        network: networkName
                    },
                });
            } catch (e) {
                console.error(`[${networkName}] Error handling InvoiceMinted:`, e);
            }
        });

        // Listen for Financing events if needed later (CollateralLocked, CreditDrawn)
        const FinancingPool = loadContract("FinancingPool", chainId);

        FinancingPool.on("CollateralLocked", async (invoiceId, tokenId, company, creditLine, ltvBps, event) => {
            console.log(`[${networkName}] CollateralLocked: ${invoiceId}`);
        });

        FinancingPool.on("CreditDrawn", async (invoiceId, amount, to, event) => {
            console.log(`[${networkName}] CreditDrawn: ${invoiceId}`);
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
                        network: networkName
                    },
                });
                emitPoolEvent({
                    type: 'pool.utilization_changed',
                    payload: { network: networkName },
                });
            } catch (e) {
                console.error(`[${networkName}] Error handling CreditDrawn:`, e);
            }
        });

        FinancingPool.on("CreditRepaid", async (invoiceId, amount, remainingDebt, event) => {
            console.log(`[${networkName}] CreditRepaid: ${invoiceId}`);
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
                    }
                });
                console.log(`DB updated (${newStatus}) for ${cleanInvoiceId}`);

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
                        network: networkName
                    },
                });
                emitPoolEvent({
                    type: 'pool.utilization_changed',
                    payload: { network: networkName },
                });
            } catch (e) {
                console.error(`[${networkName}] Error handling CreditRepaid:`, e);
            }
        });

        console.log(`Listeners attached for ${networkName}.`);
    } catch (e: any) {
        console.warn(`Failed to start listeners for ${networkName}: ${e.message}`);
    }
}

export function startEventListeners() {
    // Iterate over all defined networks
    Object.values(NETWORKS).forEach(network => {
        startChainListeners(network.chainId, network.name);
    });
}
