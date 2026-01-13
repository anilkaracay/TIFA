
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CURRENCIES = ['USD', 'EUR', 'TRY', 'USDC'];
const STATUSES = ['DRAFT', 'ISSUED', 'TOKENIZED', 'FINANCED', 'PARTIALLY_PAID', 'PAID', 'DEFAULTED'];

function getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDate(start: Date, end: Date) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function main() {
    console.log('Start seeding ...')

    // 1. Create Companies
    const companies = [];
    const companyData = [
        { id: 'COMP-001', name: 'Tech Corp (Buyer)' },
        { id: 'SUPP-001', name: 'GK Tech Solutions (Seller)' },
        { id: 'SUPP-002', name: 'Global Logistics Ltd' },
        { id: 'SUPP-003', name: 'Quantum Components' },
        { id: 'SUPP-004', name: 'FastTrack Shipping' },
        { id: 'BUYER-002', name: 'Retail Giant Inc' },
        { id: 'BUYER-003', name: 'Metro Manufacturing' }
    ];

    for (const data of companyData) {
        const company = await prisma.company.upsert({
            where: { externalId: data.id },
            update: {},
            create: {
                externalId: data.id,
                name: data.name,
            },
        });
        companies.push(company);
    }

    const suppliers = companies.filter(c => c.externalId?.startsWith('SUPP'));
    const buyers = companies.filter(c => c.externalId?.startsWith('COMP') || c.externalId?.startsWith('BUYER'));

    // 2. Clear existing invoices to avoid duplicates on re-seed if needed (optional, but safer for clean slate)
    // await prisma.invoice.deleteMany({}); 

    // 3. Generate 50+ Invoices
    console.log('Generating 50+ invoices...');

    for (let i = 1; i <= 55; i++) {
        const supplier = suppliers[getRandomInt(0, suppliers.length - 1)];
        const buyer = buyers[getRandomInt(0, buyers.length - 1)];
        const status = STATUSES[getRandomInt(0, STATUSES.length - 1)];
        const currency = CURRENCIES[getRandomInt(0, CURRENCIES.length - 1)];

        // Logic for dates based on status
        const now = new Date();
        const pastDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const futureDate = new Date(now.getFullYear(), now.getMonth() + 3, 1);

        let dueDate = getRandomDate(pastDate, futureDate);
        let amount = getRandomInt(1000, 500000).toString(); // Base amount

        // Adjust for realism
        if (status === 'DEFAULTED') {
            dueDate = getRandomDate(pastDate, now); // Must be in past
        } else if (status === 'DRAFT' || status === 'ISSUED') {
            dueDate = getRandomDate(now, futureDate); // Usually in future
        }

        const isFinanced = (status === 'FINANCED' || RP status === 'PARTIALLY_PAID' || status === 'DEFAULTED');
        const invoiceIdOnChain = isFinanced || status === 'TOKENIZED' ? `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}` : null;

        await prisma.invoice.create({
            data: {
                externalId: `INV-2026-${i.toString().padStart(3, '0')}`,
                companyId: supplier.id,
                debtorId: buyer.id,
                currency: currency,
                amount: amount,
                dueDate: dueDate,
                status: status,
                isFinanced: isFinanced,
                invoiceIdOnChain: invoiceIdOnChain,
                tokenId: (isFinanced || status === 'TOKENIZED') ? i.toString() : null,
                tokenAddress: (isFinanced || status === 'TOKENIZED') ? '0xMockInvoiceTokenAddress' : null,
                cumulativePaid: status === 'PAID' ? amount : (status === 'PARTIALLY_PAID' ? (parseInt(amount) / 2).toString() : '0'),
            },
        });
    }

    // 4. Payment Authorization
    const buyerCompany = companies.find(c => c.externalId === 'COMP-001');
    if (buyerCompany) {
        await prisma.paymentAuthorization.create({
            data: {
                companyId: buyerCompany.id,
                mode: 'AGENT_AUTHORIZED',
                maxAmountPerInvoice: '1000000',
                dailyLimit: '5000000',
                monthlyLimit: '100000000',
                allowedCurrencies: JSON.stringify(['USD', 'USDC']),
                allowedChains: JSON.stringify(['Mantle Sepolia', 'Sepolia']),
                allowedInvoiceStatuses: JSON.stringify(['FINANCED', 'TOKENIZED']),
                active: true,
            },
        });
    }

    console.log('Seeding finished with 50+ invoices.')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
