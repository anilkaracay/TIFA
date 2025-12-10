import dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('TIFA Agent starting...');

    // Simulate worker loop
    setInterval(() => {
        console.log('Agent heartbeat...');
    }, 5000);
}

main().catch(console.error);
