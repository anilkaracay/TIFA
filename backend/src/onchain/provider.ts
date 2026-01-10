import { ethers } from "ethers";
import { env } from "../env";
import deployments from "./deployments.json"; // Now structured as { networkName: { Contract: ... } }
import { NETWORKS, getNetworkByChainId, DEFAULT_NETWORK, NetworkConfig } from "@tifa/config";

const providers: Record<number, ethers.providers.JsonRpcProvider> = {};
const signers: Record<number, ethers.Wallet> = {};

export function getProvider(chainId?: number): ethers.providers.JsonRpcProvider {
    const id = chainId || NETWORKS[DEFAULT_NETWORK].chainId;
    if (!providers[id]) {
        const network = getNetworkByChainId(id);
        if (!network) throw new Error(`Unsupported chainId: ${id}`);
        providers[id] = new ethers.providers.JsonRpcProvider(network.rpcUrl);
    }
    return providers[id];
}

export function getSigner(chainId?: number): ethers.Wallet {
    const id = chainId || NETWORKS[DEFAULT_NETWORK].chainId;
    if (!signers[id]) {
        const provider = getProvider(id);
        signers[id] = env.PRIVATE_KEY
            ? new ethers.Wallet(env.PRIVATE_KEY, provider)
            : ethers.Wallet.createRandom().connect(provider);

        if (!env.PRIVATE_KEY) {
            console.warn(`⚠️  WARNING: No PRIVATE_KEY found for chain ${id}. Using generated wallet.`);
        }
    }
    return signers[id];
}

// Helper to load contract instances
export function loadContract(name: string, chainId?: number) {
    const id = chainId || NETWORKS[DEFAULT_NETWORK].chainId;
    const network = getNetworkByChainId(id);
    if (!network) throw new Error(`Unsupported chainId: ${id}`);

    // Map chainId to deployment key (e.g. base_testnet -> baseSepolia)
    // We need a mapping or consistent naming.
    // In config we used 'base_testnet'. In hardhat export we used 'baseSepolia'.
    // We should probably align them or map them.
    // For now, let's assume specific mapping logic or just string matching if possible.
    // But hardhat config used: baseSepolia: { chainId: ... }
    // The export script used keys "baseSepolia", "mantleSepolia".
    // The config.NETWORKS keys are "base_testnet", "mantle_testnet".

    // Let's create a map or try to deduce.
    let deploymentKey = "";
    if (id === 84532) deploymentKey = "baseSepolia";
    else if (id === 5003) deploymentKey = "mantleSepolia";
    else throw new Error(`Unknown deployment key for chainId ${id}`);

    const networkDeployments = (deployments as any)[deploymentKey];
    if (!networkDeployments) {
        throw new Error(`No deployments found for network ${deploymentKey} (chain ${id})`);
    }

    const deployment = networkDeployments[name];
    if (!deployment) {
        throw new Error(`Contract ${String(name)} not found in deployments.json for ${deploymentKey}`);
    }
    return new ethers.Contract(deployment.address, deployment.abi, getSigner(id));
}
