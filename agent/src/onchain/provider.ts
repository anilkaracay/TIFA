import { ethers } from "ethers";
import deployments from "./deployments.json";
import { env } from "../env";

// Initialize provider from env RPC URL
// Add explicit network configuration to avoid detection issues
export const provider = new ethers.providers.JsonRpcProvider({
    url: env.BASE_SEPOLIA_RPC,
    timeout: 30000,
});

// Initialize wallet with private key
export const signer = env.PRIVATE_KEY
    ? new ethers.Wallet(env.PRIVATE_KEY, provider)
    : ethers.Wallet.createRandom().connect(provider);

if (!env.PRIVATE_KEY) {
    console.warn("⚠️  WARNING: No PRIVATE_KEY found. Using generated wallet:", signer.address);
}

// Helper to load contract instances
// Helper to load contract instances
export function loadContract(name: keyof typeof deployments.baseSepolia) {
    const deployment = deployments.baseSepolia[name];
    if (!deployment) {
        throw new Error(`Contract ${name} not found in deployments`);
    }
    return new ethers.Contract(deployment.address, deployment.abi, signer);
}
