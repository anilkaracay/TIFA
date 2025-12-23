import { ethers, deployments } from "hardhat";

async function main() {
    console.log("Starting End-to-End Financing Flow Test...");
    const [deployer] = await ethers.getSigners();
    console.log("Actor:", deployer.address);

    // 1. Setup Contracts
    const poolDep = await deployments.get("FinancingPool");
    const tokenDep = await deployments.get("InvoiceToken");
    const testTokenDep = await deployments.get("TestToken");

    const FinancingPool = await ethers.getContractAt("FinancingPool", poolDep.address);
    const InvoiceToken = await ethers.getContractAt("InvoiceToken", tokenDep.address);
    const TestToken = await ethers.getContractAt("TestToken", testTokenDep.address);

    // 2. Mint Invoice
    console.log("Minting Invoice...");
    const invoiceId = "TEST-" + Math.floor(Math.random() * 100000);
    // bytes32 id
    const invoiceIdBytes = ethers.encodeBytes32String(invoiceId);

    // Check if already exists (unlikely)

    const coreData = {
        invoiceId: invoiceIdBytes, // The ID in registry
        issuer: deployer.address,
        debtor: deployer.address, // self
        currency: ethers.ZeroAddress,
        amount: ethers.parseUnits("100", 18), // 100 Units
        dueDate: Math.floor(Date.now() / 1000) + 86400 // Tomorrow
    };

    const txMint = await InvoiceToken.mintInvoice(coreData, "http://meta");
    await txMint.wait();
    console.log(`Invoice Minted. ID: ${invoiceId}`);

    // Get Token ID.
    // We need to find the token ID. Filter events?
    // InvoiceRegistered(bytes32 indexed invoiceId, uint256 indexed tokenId, ...)
    // Ethers v6 often makes filters property access simpler or just use *
    // Use full signature to avoid ambiguity
    const filter = await InvoiceToken.filters["InvoiceRegistered(bytes32,uint256,address,address)"](invoiceIdBytes);
    const events = await InvoiceToken.queryFilter(filter);

    if (events.length === 0) {
        console.error("Event not found!");
        return;
    }
    const tokenId = (events[0] as any).args.tokenId;
    console.log(`Token ID: ${tokenId}`);

    // 3. Approve Pool
    console.log("Approving Pool...");
    await (await InvoiceToken.setApprovalForAll(FinancingPool.target, true)).wait();

    // 4. Lock Collateral
    console.log("Locking Collateral...");
    try {
        const txLock = await FinancingPool.lockCollateral(invoiceIdBytes, tokenId, deployer.address);
        await txLock.wait();
        console.log("Collateral Locked!");
    } catch (e: any) {
        console.error("Lock Finished with Error:", e.message);
        return;
    }

    // Check Position
    const pos = await FinancingPool.getPosition(invoiceIdBytes);
    console.log("Position Exists:", pos.exists);
    console.log("Max Credit Line:", pos.maxCreditLine.toString());

    // 5. Draw Credit
    console.log("Drawing Credit...");
    // Request 50 units (50% LTV, safely under 65%)
    const drawAmount = ethers.parseUnits("50", 18);
    try {
        const txDraw = await FinancingPool.drawCredit(invoiceIdBytes, drawAmount, deployer.address);
        await txDraw.wait();
        console.log("Credit Drawn Successfully!");
    } catch (e: any) {
        console.error("Draw Failed:", e.message);
        // Look for reason
        if (e.data) { // ethers v6 reason?
            // decode?
        }
        return;
    }

    // 6. Check Balance
    const balance = await TestToken.balanceOf(deployer.address);
    console.log("Deployer Balance (TestToken):", balance.toString());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
