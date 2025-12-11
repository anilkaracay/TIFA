import { ethers } from "ethers";
import { env } from "../env";
import deployments from "./deployments.json";

// Initialize provider from env RPC URL
export const provider = new ethers.providers.JsonRpcProvider(env.BASE_SEPOLIA_RPC);

// Initialize wallet with private key
// WARNING: In production, consider more secure key management (AWS KMS, etc.)
export const signer = env.PRIVATE_KEY
    ? new ethers.Wallet(env.PRIVATE_KEY, provider)
    : ethers.Wallet.createRandom().connect(provider);

if (!env.PRIVATE_KEY) {
    console.warn("⚠️  WARNING: No PRIVATE_KEY found. Using generated wallet:", signer.address);
}

// Helper to load contract instances
export function loadContract(name: keyof typeof deployments) {
    const deployment = deployments[name as keyof typeof deployments];
    if (!deployment) {
        throw new Error(`Contract ${String(name)} not found in deployments.json`);
    }
    return new ethers.Contract(deployment.address, deployment.abi, signer);
}
