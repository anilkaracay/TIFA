
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    const deploymentsPath = path.join(__dirname, "../../frontend/lib/deployments.json");
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

    const tokenAddress = deployments.TestToken.address;
    const poolAddress = deployments.FinancingPool.address;

    console.log("Token:", tokenAddress);
    console.log("Pool:", poolAddress);

    if (!process.env.BASE_SEPOLIA_RPC) throw new Error("Missing RPC URL");
    if (!process.env.PRIVATE_KEY) throw new Error("Missing Private Key");

    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const tokenAbi = ["function mint(address to, uint256 amount) external"];
    const token = new ethers.Contract(tokenAddress, tokenAbi, wallet);

    const amount = ethers.parseEther("1000000"); // 1M Tokens

    console.log("Minting...");
    const tx = await token.mint(poolAddress, amount);
    console.log("Tx sent:", tx.hash);
    await tx.wait();
    console.log("Funded Pool with 1,000,000 TEST");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
