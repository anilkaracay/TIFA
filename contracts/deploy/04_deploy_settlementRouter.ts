import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, get } = deployments;
    const { deployer } = await getNamedAccounts();

    const invoiceRegistry = await get("InvoiceRegistry");

    const settlementRouter = await deploy("SettlementRouter", {
        from: deployer,
        args: [invoiceRegistry.address],
        log: true,
    });

    console.log(`SettlementRouter deployed at: ${settlementRouter.address}`);
};

export default func;
func.tags = ["SettlementRouter"];
func.dependencies = ["InvoiceRegistry"];
