import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy, get } = deployments;
    const { deployer } = await getNamedAccounts();

    const invoiceToken = await get("InvoiceToken");

    const invoiceRegistry = await deploy("InvoiceRegistry", {
        from: deployer,
        args: [invoiceToken.address],
        log: true,
    });

    console.log(`InvoiceRegistry deployed at: ${invoiceRegistry.address}`);

    // Grant TOKEN_CONTRACT_ROLE to Registry on InvoiceToken if needed (usually handled by admin)
    // But here we rely on manual setup or admin calls if deployer has DEFAULT_ADMIN_ROLE
};

export default func;
func.tags = ["InvoiceRegistry"];
func.dependencies = ["InvoiceToken"];
