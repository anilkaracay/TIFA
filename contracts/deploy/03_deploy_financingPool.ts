import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, get } = deployments;
    const { deployer } = await getNamedAccounts();

    const invoiceToken = await get("InvoiceToken");
    const invoiceRegistry = await get("InvoiceRegistry");
    const testToken = await get("TestToken");

    const financingPool = await deploy("FinancingPool", {
        from: deployer,
        args: [
            invoiceToken.address,
            invoiceRegistry.address,
            testToken.address,
            6500 // 65% LTV
        ],
        log: true,
    });

    console.log(`FinancingPool deployed at: ${financingPool.address}`);
};

export default func;
func.tags = ["FinancingPool"];
func.dependencies = ["InvoiceToken", "InvoiceRegistry", "TestToken"];
