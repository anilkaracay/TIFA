import { ethers } from "ethers";
import deployments from "./deployments.json";
import { env } from "../env";

// Initialize provider from env RPC URL
export const provider = new ethers.providers.JsonRpcProvider(env.BASE_SEPOLIA_RPC);

// Initialize wallet with private key
export const signer = new ethers.Wallet(env.PRIVATE_KEY, provider);

// Helper to load contract instances
export function loadContract(name: keyof typeof deployments) {
    // @ts-ignore
    const { address, abi } = deployments[name];
    return new ethers.Contract(address, abi, signer);
}
