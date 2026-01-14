
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Resetting KYC status for all users...');

    const updateResult = await prisma.kycProfile.updateMany({
        data: {
            status: 'NOT_STARTED',
            submittedAt: null,
            reviewedAt: null,
        },
    });

    console.log(`Reset KYC status for ${updateResult.count} users.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
