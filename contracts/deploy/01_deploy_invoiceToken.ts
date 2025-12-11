import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // 1. Deploy InvoiceToken
    const invoiceToken = await deploy("InvoiceToken", {
        from: deployer,
        args: ["TIFA Invoice Token", "TIFA"],
        log: true,
    });

    console.log(`InvoiceToken deployed at: ${invoiceToken.address}`);
};

export default func;
func.tags = ["InvoiceToken"];
