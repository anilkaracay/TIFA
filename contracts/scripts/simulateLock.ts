
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    const deploymentsPath = path.join(__dirname, "../../frontend/lib/deployments.json");
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
    const poolAddress = deployments.FinancingPool.address;
    const poolAbi = deployments.FinancingPool.abi;

    if (!process.env.BASE_SEPOLIA_RPC) {
        throw new Error("Missing RPC URL");
    }

    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);
    const pool = new ethers.Contract(poolAddress, poolAbi, provider);

    const userAddress = "0xb7b92a8c39911439add86b88460bAD97D2afbcc9";
    const tokenId = 3;
    const invoiceIdString = "cmj1fvqxn000112u0rus5vimd"; // From screenshot "INV-5319" row

    // Convert string to bytes32 hex (right padded)

    // Wait, encodeBytes32String strictly requires <=31 bytes in v6?
    // Let's use hexlify or just pad manually.
    const utf8Bytes = ethers.toUtf8Bytes(invoiceIdString);
    const invoiceIdHex = ethers.hexlify(utf8Bytes);

    // Custom right padding
    let padded = invoiceIdHex;
    while (padded.length < 66) { // 0x + 64 chars
        padded += "00";
    }

    console.log("Invoice ID Hex:", padded);

    // Prepare transaction data
    const txData = pool.interface.encodeFunctionData("lockCollateral", [
        padded,
        tokenId,
        userAddress
    ]);

    console.log("Simulating call...");
    try {
        const result = await provider.call({
            to: poolAddress,
            from: userAddress,
            data: txData,
            gasLimit: 500000
        });
        console.log("Success! Result:", result);
    } catch (error: any) {
        console.error("Revert caught!");
        if (error.data) {
            try {
                const decoded = pool.interface.parseError(error.data);
                console.log("Decoded Error:", decoded);
            } catch (e) {
                console.log("Raw Error Data:", error.data);
                console.log("Could not decode error using ABI.");
                // Try decoding STRING
                try {
                    const reason = ethers.toUtf8String("0x" + error.data.slice(138));
                    console.log("Reason String:", reason);
                } catch (e2) { }
            }
        } else {
            console.error(error);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
