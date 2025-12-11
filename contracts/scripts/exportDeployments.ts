import fs from "fs";
import path from "path";

const DEPLOYMENTS_DIR = path.join(__dirname, "../deployments/baseSepolia");

// Target paths in backend and agent packages
const BACKEND_TARGET = path.join(__dirname, "../../backend/src/onchain/deployments.json");
const AGENT_TARGET = path.join(__dirname, "../../agent/src/onchain/deployments.json");
const FRONTEND_TARGET = path.join(__dirname, "../../frontend/lib/deployments.json");

async function main() {
    if (!fs.existsSync(DEPLOYMENTS_DIR)) {
        console.error(`Deployments not found at ${DEPLOYMENTS_DIR}. Did you run 'npm run deploy:base'?`);
        process.exit(1);
    }

    const exported: Record<string, any> = {};
    const files = fs.readdirSync(DEPLOYMENTS_DIR).filter(f => f.endsWith(".json"));

    for (const file of files) {
        const name = file.replace(".json", "");
        const content = JSON.parse(fs.readFileSync(path.join(DEPLOYMENTS_DIR, file), "utf8"));

        exported[name] = {
            address: content.address,
            abi: content.abi,
        };
    }

    console.log(`Exporting ${Object.keys(exported).length} contracts...`);

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
