import { ethers, deployments } from "hardhat";

async function main() {
    console.log("Starting Transaction Audit for Financing Pool...");

    const poolDep = await deployments.get("FinancingPool");
    const tokenDep = await deployments.get("InvoiceToken");

    const FinancingPool = await ethers.getContractAt("FinancingPool", poolDep.address);
    // Use Provider to get logs directly for Transfers
    const provider = ethers.provider;

    // 1. Find all NFT Transfers to the Pool
    // Event: Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
    // Topic0: keccak256("Transfer(address,address,uint256)")
    // Topic2: to (pool address)

    const transferFilter = {
        address: tokenDep.address,
        topics: [
            ethers.id("Transfer(address,address,uint256)"),
            null, // from (any)
            ethers.zeroPadValue(poolDep.address, 32)  // to (Pool)
        ],
        fromBlock: 0 // Search all history (or recent)
    };

    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000); // Last 5h
    transferFilter.fromBlock = fromBlock;

    console.log(`Scanning for Transfers to ${poolDep.address} since block ${fromBlock}...`);

    const logs = await provider.getLogs(transferFilter);
    console.log(`Found ${logs.length} transfers.`);

    // Interface for decoding inputs
    const poolInterface = FinancingPool.interface;

    for (const log of logs) {
        const txHash = log.transactionHash;
        const tokenId = BigInt(log.topics[3]);

        console.log(`\n-----------------------------------------------------------`);
        console.log(`Tx: ${txHash}`);
        console.log(`Token ID Transferred: ${tokenId}`);

        // Get Transaction Input Data
        const tx = await provider.getTransaction(txHash);
        if (!tx) {
            console.log("Could not fetch tx.");
            continue;
        }

        // Check if it was a lockCollateral call
        try {
            const decoded = poolInterface.parseTransaction({ data: tx.data });
            if (decoded && decoded.name === "lockCollateral") {
                const [invoiceId, idTokenId, company] = decoded.args;
                console.log(`Called Function: lockCollateral`);
                console.log(`Arg: invoiceId (Bytes32): ${invoiceId}`);
                console.log(`Arg: tokenId: ${idTokenId}`);

                // Decode bytes32 to string if possible
                try {
                    console.log(`Arg: invoiceId (String): ${ethers.decodeBytes32String(invoiceId)}`);
                } catch (e) {
                    console.log(`Arg: invoiceId (String): (Not valid UTF8 string)`);
                }

                // Verify match
                if (tokenId !== idTokenId) {
                    console.warn("WARNING: Token ID mismatch between Transfer and Call Args! (Batch?)");
                }

                // Check if Position exists for THIS ID
                const pos = await FinancingPool.getPosition(invoiceId);
                console.log(`Current Position for this ID: Exists=${pos.exists}`);
            } else {
                console.log(`Called Function: ${decoded ? decoded.name : 'Unknown/Raw Transfer'}`);
            }
        } catch (e) {
            console.log("Could not decode transaction data (might be manual transfer?)");
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
