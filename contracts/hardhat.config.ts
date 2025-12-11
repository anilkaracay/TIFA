import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
    },
    networks: {
        hardhat: {
            chainId: 31337,
        },
        baseSepolia: {
            url: BASE_SEPOLIA_RPC,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
            chainId: 84532,
        },
    },
    paths: {
        deploy: "deploy",
        deployments: "deployments",
    },
};

export default config;
