
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    const deploymentsPath = path.join(__dirname, "../../frontend/lib/deployments.json");
    if (!fs.existsSync(deploymentsPath)) {
        console.error("Deployments file not found");
        return;
    }

    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
    const poolAddress = deployments.FinancingPool.address;
    const tokenAddress = deployments.InvoiceToken.address;

    console.log("Deployed FinancingPool:", poolAddress);
    console.log("Deployed InvoiceToken: ", tokenAddress);

    if (!process.env.BASE_SEPOLIA_RPC) {
        throw new Error("Missing RPC URL");
    }

    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);

    const poolAbi = [
        "function invoiceToken() view returns (address)"
    ];

    const pool = new ethers.Contract(poolAddress, poolAbi, provider);
    const onChainToken = await pool.invoiceToken();

    console.log("FinancingPool.invoiceToken() ->", onChainToken);

    if (onChainToken.toLowerCase() === tokenAddress.toLowerCase()) {
        console.log("✅ Addresses MATCH");
    } else {
        console.error("❌ Addresses MISMATCH! Pool is using old token.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
