import { loadContract } from "./provider";

const STATUS_MAP: Record<string, number> = {
    NONE: 0,
    ISSUED: 1,
    TOKENIZED: 2,
    FINANCED: 3,
    PARTIALLY_PAID: 4,
    PAID: 5,
    DEFAULTED: 6
};

// Update invoice status on Registry
export async function onchainUpdateStatus(invoiceIdOnChain: string, newStatus: string) {
    console.log(`[OnChain] Updating status key=${invoiceIdOnChain} -> ${newStatus}`);
    const statusEnum = STATUS_MAP[newStatus];
    if (statusEnum === undefined) {
        throw new Error(`Invalid status: ${newStatus}`);
    }
    const Registry = loadContract("InvoiceRegistry");
    const tx = await Registry.setStatus(invoiceIdOnChain, statusEnum);
    console.log(`[OnChain] Status TX sent: ${tx.hash}`);
    return await tx.wait();
}

// Draw credit from Financing Pool
export async function onchainFinanceDraw(invoiceIdOnChain: string, amount: string, to: string) {
    console.log(`[OnChain] Drawing credit key=${invoiceIdOnChain} amt=${amount} to=${to}`);
    const Pool = loadContract("FinancingPool");
    const tx = await Pool.drawCredit(invoiceIdOnChain, amount, to);
    console.log(`[OnChain] Draw TX sent: ${tx.hash}`);
    return await tx.wait();
}

// Liquidate collateral in Financing Pool
export async function onchainLiquidate(invoiceIdOnChain: string) {
    console.log(`[OnChain] Liquidating key=${invoiceIdOnChain}`);
    const Pool = loadContract("FinancingPool");
    const tx = await Pool.liquidateCollateral(invoiceIdOnChain);
    console.log(`[OnChain] Liquidate TX sent: ${tx.hash}`);
    return await tx.wait();
}
