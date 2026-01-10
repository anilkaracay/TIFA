import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import { NETWORKS } from "@tifa/config";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

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
            url: NETWORKS.base_testnet.rpcUrl,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`] : [],
            chainId: NETWORKS.base_testnet.chainId,
        },
        mantleSepolia: {
            url: NETWORKS.mantle_testnet.rpcUrl,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`] : [],
            chainId: NETWORKS.mantle_testnet.chainId,
            // Mantle uses ETH/MNT as gas, verify if specialized gasPrice is needed
        },
    },
    paths: {
        deploy: "deploy",
        deployments: "deployments",
    },
};

export default config;
