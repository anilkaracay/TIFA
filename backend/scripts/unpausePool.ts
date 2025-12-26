import { loadContract } from "../src/onchain/provider";

async function unpausePool() {
    try {
        console.log("Checking pool status...");
        const FinancingPool = loadContract("FinancingPool");
        
        // Check if paused (OpenZeppelin Pausable uses a public paused variable)
        let paused = false;
        try {
            paused = await FinancingPool.paused();
            console.log(`Pool paused status: ${paused}`);
        } catch (e: any) {
            console.warn("Could not check paused status:", e.message);
            // Try alternative method
            try {
                paused = await FinancingPool.paused();
            } catch (e2: any) {
                console.warn("Alternative check also failed:", e2.message);
            }
        }

        if (!paused) {
            console.log("✅ Pool is already unpaused!");
            return;
        }

        console.log("Unpausing pool...");
        const tx = await FinancingPool.unpause();
        console.log(`Transaction sent: ${tx.hash}`);
        
        console.log("Waiting for confirmation...");
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log("✅ Pool unpaused successfully!");
            console.log(`Transaction hash: ${tx.hash}`);
        } else {
            console.error("❌ Transaction failed");
        }
    } catch (error: any) {
        console.error("❌ Error unpausing pool:", error.message);
        if (error.reason) {
            console.error("Reason:", error.reason);
        }
        process.exit(1);
    }
}

unpausePool();


