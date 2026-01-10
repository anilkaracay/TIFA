import fs from "fs";
import path from "path";

// Target paths in backend and agent packages
const BACKEND_TARGET = path.join(__dirname, "../../backend/src/onchain/deployments.json");
const AGENT_TARGET = path.join(__dirname, "../../agent/src/onchain/deployments.json");
const FRONTEND_TARGET = path.join(__dirname, "../../frontend/lib/deployments.json");

async function main() {
    const networks = ["baseSepolia", "mantleSepolia"];
    const exported: Record<string, any> = {};

    // Structure: { [networkName]: { [ContractName]: { address, abi } } }

    for (const network of networks) {
        const networkDeploymentsDir = path.join(__dirname, `../deployments/${network}`);
        if (!fs.existsSync(networkDeploymentsDir)) {
            console.warn(`⚠️  No deployments found for ${network} at ${networkDeploymentsDir}`);
            continue;
        }

        exported[network] = {};
        const files = fs.readdirSync(networkDeploymentsDir).filter(f => f.endsWith(".json"));

        for (const file of files) {
            const name = file.replace(".json", "");
            try {
                const content = JSON.parse(fs.readFileSync(path.join(networkDeploymentsDir, file), "utf8"));
                exported[network][name] = {
                    address: content.address,
                    abi: content.abi,
                };
            } catch (e) {
                console.error(`Error reading ${file}:`, e);
            }
        }
    }

    console.log(`Exporting deployments for networks: ${Object.keys(exported).join(", ")}`);

    // Ensure directories exist
    [BACKEND_TARGET, AGENT_TARGET, FRONTEND_TARGET].forEach(target => {
        const dir = path.dirname(target);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(target, JSON.stringify(exported, null, 2));
        console.log(`✅ Exported to ${target}`);
    });
}

main().catch(console.error);
