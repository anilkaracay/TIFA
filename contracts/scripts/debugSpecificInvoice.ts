import { ethers, deployments } from "hardhat";

async function main() {
    console.log("Starting Diagnostic for Invoice 0x636d...");

    // 1. Setup
    const poolDep = await deployments.get("FinancingPool");
    const tokenDep = await deployments.get("InvoiceToken");
    const testTokenDep = await deployments.get("TestToken");

    const FinancingPool = await ethers.getContractAt("FinancingPool", poolDep.address);
    const InvoiceToken = await ethers.getContractAt("InvoiceToken", tokenDep.address);
    const TestToken = await ethers.getContractAt("TestToken", testTokenDep.address);
    // INV-new-6 ID from screenshot
    const invoiceIdStr = "cmjfap6vl1fd280x9oqc0hl5o";
    // If that fails, we can scan by token ID 21.65616b6674313031616c383078947a6d787432356400000000000000";
    const invoiceId = ethers.encodeBytes32String(invoiceIdStr);
    console.log(`Checking Invoice ID: ${invoiceId} ("${invoiceIdStr}")`);

    // 2. Check Pool Liquidity
    const poolBalance = await TestToken.balanceOf(poolDep.address);
    console.log(`Pool Liquidity: ${ethers.formatUnits(poolBalance, 18)} TEST`);

    // 3. Check Position
    try {
        const pos = await FinancingPool.getPosition(invoiceId);
        console.log("\n--- Position State ---");
        console.log(`Exists: ${pos.exists}`);
        console.log(`Liquidated: ${pos.liquidated}`);
        console.log(`Company: ${pos.company}`);
        console.log(`MaxCreditLine: ${pos.maxCreditLine} (Raw)`);
        console.log(`UsedCredit: ${pos.usedCredit} (Raw)`);
        console.log(`LTV Bps: ${pos.ltvBps}`);

        // 4. Check Token Ownership
        let tokenId = pos.tokenId;
        if (tokenId === 0n) {
            console.log("Position empty, querying InvoiceToken for ID...");
            try {
                // Note: This mapping might be internal or private depending on implementation.
                // Let's try getting it via event logs or getter if available?
                // Actually, assuming a public getter or mapping exists.
                // The contract has `getInvoiceDataById`?
                const data = await InvoiceToken.getInvoiceDataById(invoiceId);
                // data tuple: (core, uri, tokenId, state)
                // returns (core, status, uri, tokenId)
                // returns (core, status, uri, tokenId)
                tokenId = data[3]; // 4th return value

                if (tokenId === 0n) {
                    console.log("Lookup failed. Trying manual guess: Token 22");
                    tokenId = 22n;
                }
            } catch (e) {
                console.log("Could not find Token ID from contract.");
            }
        }

        if (tokenId > 0n) {
            try {
                const owner = await InvoiceToken.ownerOf(tokenId);
                console.log(`Token ID: ${tokenId}`);
                console.log(`Current Owner: ${owner}`);

                if (owner.toLowerCase() === poolDep.address.toLowerCase()) {
                    console.log("WARN: Pool owns the NFT!");
                } else {
                    console.log("OK: User (or other) owns the NFT.");
                }
            } catch (e) {
                console.log("Token ID does not exist (not minted yet?).");
            }
        } else {
            console.log("Token ID not found.");
        }

    } catch (e: any) {
        console.error("Error fetching position:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
