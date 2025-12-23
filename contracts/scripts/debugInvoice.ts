import { ethers, deployments } from "hardhat";
import axios from "axios"; // Need to install axios or use fetch? Backend running on 4000.

async function main() {
    console.log("Debugging Invoice State...");

    // 1. Get Contracts
    const poolDeployment = await deployments.get("FinancingPool");
    const FinancingPool = await ethers.getContractAt("FinancingPool", poolDeployment.address);
    // const InvoiceToken = await ethers.getContractAt("InvoiceToken", (await deployments.get("InvoiceToken")).address);

    // 2. Fetch Latest Invoice from Backend (assuming local backend is accessible)
    // Or just look at the logs? The user provided image shows "new" invoice.
    // Let's list all positions for know usage.

    // We can't iterate mapping. We need ID.
    // Hardcoding specific ID from screenshot if possible? 
    // Screenshot ID: cmjeakft101al80x94zmxt25d => This is DB ID.
    // On-chain ID is stringToHex of this?

    const dbId = "cmjeakft101al80x94zmxt25d"; // From screenshot
    const invoiceId = ethers.encodeBytes32String(dbId); // Using encodeBytes32String logic? 
    // Wait, frontend used `stringToHex(inv.id, { size: 32 })`.
    // Viem stringToHex vs Ethers encodeBytes32String.
    // If it's simple text fitting in 32 bytes, they should be similar but padding might differ.
    // Viem pads right usually for bytes32? Or hex string?

    // Let's try to replicate Frontend logic:
    // Frontend: `stringToHex("cmjeakft101al80x94zmxt25d", { size: 32 })`
    // "cmjeakft101al80x94zmxt25d" is 25 chars.
    // Hex: 636d6a65616b6674313031616c38307839347a6d7874323564
    // Padded to 32 bytes (64 hex chars) -> right padded with zeros.

    // List all CollateralLocked events to find what's actually there
    console.log("Scanning CollateralLocked events...");
    const filter = FinancingPool.filters.CollateralLocked();
    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000); // Last 10k blocks is likely enough for a "new" invoice
    console.log(`Scanning from block ${fromBlock} to ${currentBlock}...`);
    const events = await FinancingPool.queryFilter(filter, fromBlock, 'latest');

    if (events.length === 0) {
        console.log("No CollateralLocked events found on this contract.");
    } else {
        console.log(`Found ${events.length} locked positions.`);
        for (const ev of events) {
            const args = (ev as any).args;
            const id = args.invoiceId;
            const company = args.company;
            const tokenId = args.tokenId.toString();
            console.log(`- InvoiceID: ${id}`);
            console.log(`  TokenID: ${tokenId}, Company: ${company}`);

            // Check position for this ID
            const pos = await FinancingPool.getPosition(id);
            console.log(`  -> Exists: ${pos.exists}, UsedCredit: ${pos.usedCredit}`);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
