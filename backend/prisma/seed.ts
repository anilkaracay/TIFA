
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Start seeding ...')

    // 1. Create Companies
    const techCorp = await prisma.company.upsert({
        where: { externalId: 'COMP-001' },
        update: {},
        create: {
            externalId: 'COMP-001',
            name: 'Tech Corp (Buyer)',
        },
    })

    const supplierInc = await prisma.company.upsert({
        where: { externalId: 'SUPP-001' },
        update: {},
        create: {
            externalId: 'SUPP-001',
            name: 'Supplier Inc (Seller)',
        },
    })

    // 2. Create Invoices
    // Invoice 1: Financed
    await prisma.invoice.create({
        data: {
            externalId: 'INV-2024-001',
            companyId: supplierInc.id,
            debtorId: techCorp.id,
            currency: 'USD',
            amount: '5000000', // $50,000.00
            dueDate: new Date(new Date().setDate(new Date().getDate() + 30)), // Due in 30 days
            status: 'FINANCED',
            isFinanced: true,
            invoiceIdOnChain: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            tokenId: '1',
            tokenAddress: '0xMockInvoiceTokenAddress',
            cumulativePaid: '0',
        },
    })

    // Invoice 2: Tokenized / Available for Finance
    await prisma.invoice.create({
        data: {
            externalId: 'INV-2024-002',
            companyId: supplierInc.id,
            debtorId: techCorp.id,
            currency: 'USD',
            amount: '1250000', // $12,500.00
            dueDate: new Date(new Date().setDate(new Date().getDate() + 45)),
            status: 'TOKENIZED',
            isFinanced: false,
            invoiceIdOnChain: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            tokenId: '2',
            tokenAddress: '0xMockInvoiceTokenAddress',
            cumulativePaid: '0',
        },
    })

    // Invoice 3: Draft
    await prisma.invoice.create({
        data: {
            externalId: 'INV-2024-003',
            companyId: supplierInc.id,
            debtorId: techCorp.id,
            currency: 'EUR',
            amount: '750000', // €7,500.00
            dueDate: new Date(new Date().setDate(new Date().getDate() + 15)),
            status: 'DRAFT',
            isFinanced: false,
            cumulativePaid: '0',
        },
    })

    // 3. Payment Authorization
    await prisma.paymentAuthorization.create({
        data: {
            companyId: techCorp.id,
            mode: 'AGENT_AUTHORIZED',
            maxAmountPerInvoice: '1000000', // $10,000
            dailyLimit: '5000000', // $50,000
            monthlyLimit: '100000000', // $1,000,000
            allowedCurrencies: JSON.stringify(['USD', 'USDC']),
            allowedChains: JSON.stringify(['Mantle Sepolia', 'Sepolia']),
            allowedInvoiceStatuses: JSON.stringify(['FINANCED', 'TOKENIZED']),
            active: true,
        },
    })

    console.log('Seeding finished.')
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
