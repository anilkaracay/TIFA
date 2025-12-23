import { ethers, deployments } from "hardhat";

async function main() {
    const txHash = "0x993f5c793b3e3f693f15b50b52e9c8721b3e22e06d4a8943c61dcb5f9350ae67";
    console.log(`Analyzing Tx: ${txHash}`);

    const provider = ethers.provider;
    const tx = await provider.getTransaction(txHash);

    if (!tx) {
        console.error("Tx not found");
        return;
    }

    console.log(`To: ${tx.to}`);
    console.log(`From: ${tx.from}`);
    console.log(`Value: ${tx.value}`);
    console.log(`Data: ${tx.data}`);

    const poolDep = await deployments.get("FinancingPool");
    const tokenDep = await deployments.get("InvoiceToken");

    console.log(`\n--- Comparison ---`);
    console.log(`Pool Address:  ${poolDep.address}`);
    console.log(`Token Address: ${tokenDep.address}`);

    if (tx.to?.toLowerCase() === tokenDep.address.toLowerCase()) {
        console.error("\n[!] CRITICAL: Transaction was sent to the TOKEN Contract (Direct Transfer), not the Pool!");
        console.error("The user is calling 'transferFrom' or 'safeTransferFrom' instead of 'lockCollateral'.");

        // Try decoding as Transfer
        const InvoiceToken = await ethers.getContractAt("InvoiceToken", tokenDep.address);
        try {
            const decoded = InvoiceToken.interface.parseTransaction({ data: tx.data });
            console.log(`Decoded Function: ${decoded?.name}`);
            console.log(`Args:`, decoded?.args);
        } catch (e) {
            console.log("Could not decode as Token call.");
        }

    } else if (tx.to?.toLowerCase() === poolDep.address.toLowerCase()) {
        console.log("\n[OK] Transaction was sent to the POOL Contract.");
        console.log("Analyzing Input Data for 'lockCollateral' signature...");

        const FinancingPool = await ethers.getContractAt("FinancingPool", poolDep.address);
        try {
            const decoded = FinancingPool.interface.parseTransaction({ data: tx.data });
            console.log(`Decoded Function: ${decoded?.name}`);
            console.log(`Args:`, decoded?.args);
        } catch (e) {
            console.error("\n[!] CRITICAL: Could not decode input data using Pool ABI!");
            console.error("Selector: " + tx.data.substring(0, 10));
            // lockCollateral selector
            const selector = ethers.id("lockCollateral(bytes32,uint256,address)").substring(0, 10);
            console.log(`Expected 'lockCollateral' Selector: ${selector}`);
        }
    } else {
        console.error("\n[!] CRITICAL: Transaction sent to unknown address!");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
