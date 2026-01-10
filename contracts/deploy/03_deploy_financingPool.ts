import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy, get } = deployments;
    const { deployer } = await getNamedAccounts();

    const invoiceToken = await get("InvoiceToken");
    const invoiceRegistry = await get("InvoiceRegistry");
    const testToken = await get("TestToken");
    const lpShareToken = await get("LPShareToken");

    // 15% APR in WAD (0.15e18)
    const borrowAprWad = ethers.parseEther("0.15");
    // 10% protocol fee (1000 basis points)
    const protocolFeeBps = 1000;

    const financingPool = await deploy("FinancingPool", {
        from: deployer,
        args: [
            invoiceToken.address,
            invoiceRegistry.address,
            testToken.address,
            lpShareToken.address,
            6000, // 60% LTV
            8000, // 80% max utilization
            borrowAprWad.toString(), // 15% APR
            protocolFeeBps // 10% protocol fee
        ],
        log: true,
    });

    console.log(`FinancingPool deployed at: ${financingPool.address}`);

    // Grant pool roles to FinancingPool
    const lpTokenContract = await hre.ethers.getContractAt("LPShareToken", lpShareToken.address);
    await lpTokenContract.grantPoolRoles(financingPool.address);
    console.log(`LPShareToken roles granted to FinancingPool`);
};

export default func;
func.tags = ["FinancingPool"];
func.dependencies = ["InvoiceToken", "InvoiceRegistry", "TestToken", "LPShareToken"];
