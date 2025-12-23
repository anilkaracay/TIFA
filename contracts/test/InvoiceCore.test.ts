import { expect } from "chai";
import { ethers } from "hardhat";
import { InvoiceRegistry, InvoiceToken } from "../typechain-types";

describe("InvoiceCore", function () {
    let invoiceToken: InvoiceToken;
    let registry: InvoiceRegistry;
    let deployer: any;
    let user: any;
    let agent: any;

    // Roles
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const TOKEN_CONTRACT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TOKEN_CONTRACT_ROLE"));
    const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));

    const INVOICE_ID = ethers.keccak256(ethers.toUtf8Bytes("INV-001"));

    before(async () => {
        [deployer, user, agent] = await ethers.getSigners();
    });

    it("Should deploy InvoiceToken and InvoiceRegistry", async function () {
        const InvoiceTokenFactory = await ethers.getContractFactory("InvoiceToken");
        invoiceToken = (await InvoiceTokenFactory.deploy("TifaInvoice", "TIFA")) as InvoiceToken;
        await invoiceToken.waitForDeployment();

        const RegistryFactory = await ethers.getContractFactory("InvoiceRegistry");
        registry = (await RegistryFactory.deploy(await invoiceToken.getAddress())) as InvoiceRegistry;
        await registry.waitForDeployment();

        expect(await invoiceToken.getAddress()).to.be.properAddress;
        expect(await registry.getAddress()).to.be.properAddress;
    });

    it("Should setup roles correctly", async function () {
        // Registry needs TOKEN_CONTRACT_ROLE to be called by authorized registrars? 
        // Wait, the requirement says "Admin can grant AGENT_ROLE and TOKEN_CONTRACT_ROLE".
        // "Function registerInvoice... Only TOKEN_CONTRACT_ROLE or ADMIN_ROLE"
        // So if the deployer is the one registering for now, they have ADMIN_ROLE.
        // If we want a separate entity to register, we grant TOKEN_CONTRACT_ROLE.

        // Let's grant current deployer the TOKEN_CONTRACT_ROLE just to test permissions explicitly
        await registry.grantRole(TOKEN_CONTRACT_ROLE, deployer.address);
        // Grant AGENT_ROLE to 'agent' for payment recording
        await registry.grantRole(AGENT_ROLE, agent.address);
    });

    it("Should mint an invoice via InvoiceToken", async function () {
        const data = {
            invoiceId: INVOICE_ID,
            issuer: user.address,
            debtor: ethers.Wallet.createRandom().address,
            amount: ethers.parseEther("100"),
            dueDate: Math.floor(Date.now() / 1000) + 3600 * 24 * 30, // 30 days
            currency: ethers.ZeroAddress // Placeholder for ETH/Native
        };

        // Must call from issuer address (user), not deployer
        await invoiceToken.connect(user).mintInvoice(data, "ipfs://metadata");

        expect(await invoiceToken.ownerOfInvoice(INVOICE_ID)).to.equal(user.address);
        expect(await invoiceToken.statusOf(INVOICE_ID)).to.equal(1); // ISSUED
    });

    it("Should register the invoice in Registry", async function () {
        const tokenId = await invoiceToken.tokenOfInvoice(INVOICE_ID);
        const data = await invoiceToken.getInvoiceDataById(INVOICE_ID);

        await registry.connect(deployer).registerInvoice(
            INVOICE_ID,
            tokenId,
            data.data.issuer,
            data.data.debtor
        );

        expect(await registry.isRegistered(INVOICE_ID)).to.be.true;
        expect(await registry.getStatus(INVOICE_ID)).to.equal(1); // ISSUED
    });

    it("Should record payment via Registry", async function () {
        const amount = ethers.parseEther("10");

        await registry.connect(agent).recordPayment(INVOICE_ID, amount);

        expect(await registry.getCumulativePaid(INVOICE_ID)).to.equal(amount);
    });

    it("Should return correct summary", async function () {
        const summary = await registry.getInvoiceSummary(INVOICE_ID);

        expect(summary.status).to.equal(1); // ISSUED
        expect(summary.cumulativePaid).to.equal(ethers.parseEther("10"));
        expect(summary.isFinanced).to.be.false;
    });
});
