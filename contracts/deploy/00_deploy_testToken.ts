import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // Deploy a mock Stablecoin for testing
    const testToken = await deploy("TestToken", {
        from: deployer,
        args: [],
        log: true,
    });

    console.log(`TestToken deployed at: ${testToken.address}`);
};

export default func;
func.tags = ["TestToken"];
