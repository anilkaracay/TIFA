
import fs from 'fs';
import path from 'path';

const FRONTEND_DEPLOYMENTS_PATH = path.resolve(__dirname, '../../frontend/lib/deployments.json');
const MANTLE_DEPLOYMENTS_DIR = path.resolve(__dirname, '../deployments/mantleSepolia');

async function main() {
    console.log("Updating frontend deployments...");

    // 1. Read existing frontend deployments
    let frontendDeployments: any = {};
    if (fs.existsSync(FRONTEND_DEPLOYMENTS_PATH)) {
        frontendDeployments = JSON.parse(fs.readFileSync(FRONTEND_DEPLOYMENTS_PATH, 'utf8'));
    }

    // 2. Initialize mantleSepolia entry
    frontendDeployments['mantleSepolia'] = {};

    // 3. Read contract artifacts from deployments/mantleSepolia
    if (!fs.existsSync(MANTLE_DEPLOYMENTS_DIR)) {
        console.error(`Directory not found: ${MANTLE_DEPLOYMENTS_DIR}`);
        console.error("Make sure you have run 'npx hardhat deploy --network mantleSepolia'");
        process.exit(1);
    }

    const files = fs.readdirSync(MANTLE_DEPLOYMENTS_DIR);

    for (const file of files) {
        if (!file.endsWith('.json') || file === '.chainId') continue;

        const contractName = path.basename(file, '.json');
        const filePath = path.join(MANTLE_DEPLOYMENTS_DIR, file);
        const artifact = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (artifact.address && artifact.abi) {
            console.log(`Adding ${contractName} to mantleSepolia config...`);
            frontendDeployments['mantleSepolia'][contractName] = {
                address: artifact.address,
                abi: artifact.abi
            };
        }
    }

    // 4. Write back to frontend/lib/deployments.json
    fs.writeFileSync(FRONTEND_DEPLOYMENTS_PATH, JSON.stringify(frontendDeployments, null, 2));
    console.log(`✅ Updated ${FRONTEND_DEPLOYMENTS_PATH}`);
}

main();
