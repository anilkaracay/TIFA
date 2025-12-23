import { ethers, deployments } from "hardhat";

async function main() {
    const poolDeployment = await deployments.get("FinancingPool");
    const FinancingPool = await ethers.getContractAt("FinancingPool", poolDeployment.address);
    const TestToken = await ethers.getContractAt("TestToken", await FinancingPool.liquidityToken());

    console.log("--- Debugging Pool ---");
    console.log("Pool Address:", FinancingPool.target);
    console.log("Liquidity Token:", TestToken.target);

    const ltv = await FinancingPool.defaultLtvBps();
    console.log("Default LTV:", ltv.toString()); // Should be 6500

    const balance = await TestToken.balanceOf(FinancingPool.target);
    console.log("Pool Token Balance:", balance.toString());

    // Check decimals
    const decimals = await TestToken.decimals();
    console.log("Token Decimals:", decimals.toString());

    // Try to simulate a draw condition
    // We can't easily guess an invoice ID without logs, but if LTV is 0 that would explain it.
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
