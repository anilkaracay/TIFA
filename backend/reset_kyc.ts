import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const wallet = '0xb7b92a8c39911439add86b88460baD97D2afbcc9';
    console.log(`Resetting KYC for wallet: ${wallet}`);

    // Find profile by wallet (LP type)
    const profile = await prisma.kycProfile.findFirst({
        where: {
            wallet: {
                equals: wallet,
                mode: 'insensitive' // Ignore case
            }
        }
    });

    if (profile) {
        console.log(`Found LP profile ${profile.id} (Status: ${profile.status}), deleting...`);
        await prisma.kycProfile.delete({
            where: { id: profile.id }
        });
        console.log('Deleted successfully.');
    } else {
        console.log('No LP profile found for this wallet.');
    }

    // Checking if there is any Company linked profile just in case (Issuer type often uses companyId but might have metadata)
    // This is harder to find without knowing companyId. 
    // But we can check if any company is owned by this wallet? Schema doesn't strictly link wallet to company owner.
    // However, usually for hackathons, the mapping is simple.

    // Let's also check if there are any other profiles where companyId might be relevant
    // But given useKyc defaults to LP, the above should be enough for the UI.
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
