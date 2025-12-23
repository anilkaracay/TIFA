import { ethers, deployments } from "hardhat";

async function main() {
    console.log("Funding Financing Pool...");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const poolDeployment = await deployments.get("FinancingPool");
    const tokenDeployment = await deployments.get("TestToken");

    const FinancingPool = await ethers.getContractAt("FinancingPool", poolDeployment.address);
    const TestToken = await ethers.getContractAt("TestToken", tokenDeployment.address);

    console.log("Pool Address:", FinancingPool.target);
    console.log("Token Address:", TestToken.target);

    // Amount: 1,000,000 Tokens (assuming 18 decimals? Or whatever TestToken uses. Let's use parseEther to be safe or just a huge number)
    // If TestToken is OpenZeppelin ERC20PresetMinterPauser, we can mint.
    // Or if deployer has supply, we transfer.

    // Let's check deployer balance first.
    const bal = await TestToken.balanceOf(deployer.address);
    console.log("Deployer Balance:", bal.toString());

    const amount = ethers.parseUnits("100000000", 18); // 100M tokens

    // Try minting to pool directly if we have role, otherwise transfer.
    try {
        console.log("Minting to pool...");
        // Assuming TestToken has mint function
        await (await TestToken.mint(FinancingPool.target, amount)).wait();
        console.log("Minted 1M tokens to Pool.");
    } catch (e) {
        console.log("Mint failed (maybe not minter?), trying transfer...");
        // If mint fails, maybe deployer has initial supply?
        if (bal >= amount) {
            await (await TestToken.transfer(FinancingPool.target, amount)).wait();
            console.log("Transferred 1M tokens to Pool.");
        } else {
            // Mint to deployer then transfer?
            await (await TestToken.mint(deployer.address, amount)).wait();
            await (await TestToken.transfer(FinancingPool.target, amount)).wait();
            console.log("Minted to Self then Transferred to Pool.");
        }
    }

    const poolBal = await TestToken.balanceOf(FinancingPool.target);
    console.log("New Pool Balance:", poolBal.toString());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
