
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Fixing Payment Authorization...");

    const auths = await prisma.paymentAuthorization.findMany();

    for (const auth of auths) {
        if (!auth.allowedInvoiceStatuses) continue;

        let statuses: string[] = [];
        try {
            statuses = JSON.parse(auth.allowedInvoiceStatuses);
        } catch (e) {
            console.error("Failed to parse statuses", e);
            continue;
        }

        console.log(`Auth ${auth.id} statuses: ${statuses.join(', ')}`);

        // Remove ISSUED and TOKENIZED
        const newStatuses = statuses.filter(s => s !== 'ISSUED' && s !== 'TOKENIZED');

        if (newStatuses.length !== statuses.length) {
            console.log(`Updating to: ${newStatuses.join(', ')}`);
            await prisma.paymentAuthorization.update({
                where: { id: auth.id },
                data: { allowedInvoiceStatuses: JSON.stringify(newStatuses) }
            });
            console.log("Updated.");
        } else {
            console.log("No changes needed.");
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
