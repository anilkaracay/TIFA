
import { ethers, getNamedAccounts, deployments } from "hardhat";

async function main() {
    const { deployer } = await getNamedAccounts();
    console.log(" Minting liquidity on Mantle Sepolia...");
    console.log(" Deployer:", deployer);

    // Get contracts
    const TestToken = await deployments.get("TestToken");
    const FinancingPool = await deployments.get("FinancingPool");

    const tokenContract = await ethers.getContractAt("TestToken", TestToken.address);

    // 1. Mint to Deployer (User)
    console.log("Minting 100,000 USDC to deployer...");
    const tx1 = await tokenContract.mint(deployer, ethers.parseUnits("100000", 6));
    await tx1.wait();
    console.log("✅ Minted to deployer");

    // 2. Mint to FinancingPool (Liquidity)
    // Note: In a real system, LPs deposit via `deposit()`, but for setup we can just transfer/mint if it's a test token,
    // OR we should properly deposit to update shares.
    // Let's do a proper deposit to ensure internal accounting (shares) are updated.

    // First mint to deployer (already done), then approve and deposit.
    const poolContract = await ethers.getContractAt("FinancingPool", FinancingPool.address);

    const depositAmount = ethers.parseUnits("50000", 6); // $50k

    console.log("Approving FinancingPool...");
    const txApprove = await tokenContract.approve(FinancingPool.address, depositAmount);
    await txApprove.wait();

    console.log("Depositing $50k Liquidity...");
    const txDeposit = await poolContract.deposit(depositAmount);
    await txDeposit.wait();
    console.log("✅ Deposited liquidity. Pool should now show funds.");

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
