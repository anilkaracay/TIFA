import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const lpShareToken = await deploy("LPShareToken", {
        from: deployer,
        args: [],
        log: true,
    });

    console.log(`LPShareToken deployed at: ${lpShareToken.address}`);
};

export default func;
func.tags = ["LPShareToken"];

