import { expect } from "chai";
import { ethers } from "hardhat";
import { InvoiceRegistry, InvoiceToken, FinancingPool, SettlementRouter, TestToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Financing and Settlement", function () {
    let invoiceToken: InvoiceToken;
    let registry: InvoiceRegistry;
    let pool: FinancingPool;
    let router: SettlementRouter;
    let testToken: TestToken;

    let deployer: SignerWithAddress;
    let company: SignerWithAddress;
    let agent: SignerWithAddress;
    let payer: SignerWithAddress;
    let recipient1: SignerWithAddress;
    let recipient2: SignerWithAddress;

    const INVOICE_ID = ethers.keccak256(ethers.toUtf8Bytes("INV-RWA-001"));
    // 65% LTV
    const DEFAULT_LTV_BPS = 6500n;

    before(async () => {
        [deployer, company, agent, payer, recipient1, recipient2] = await ethers.getSigners();
    });

    it("Should deploy infrastructure", async function () {
        // 1. liquidity token
        const TokenFactory = await ethers.getContractFactory("TestToken");
        testToken = (await TokenFactory.deploy()) as TestToken;
        await testToken.waitForDeployment();

        // 2. Core
        const InvoiceTokenFactory = await ethers.getContractFactory("InvoiceToken");
        invoiceToken = (await InvoiceTokenFactory.deploy("TifaInvoice", "TIFA")) as InvoiceToken;
        await invoiceToken.waitForDeployment();

        const RegistryFactory = await ethers.getContractFactory("InvoiceRegistry");
        registry = (await RegistryFactory.deploy(await invoiceToken.getAddress())) as InvoiceRegistry;
        await registry.waitForDeployment();

        // 3. Financing Pool
        const PoolFactory = await ethers.getContractFactory("FinancingPool");
        pool = (await PoolFactory.deploy(
            await invoiceToken.getAddress(),
            await registry.getAddress(),
            await testToken.getAddress(),
            DEFAULT_LTV_BPS
        )) as FinancingPool;
        await pool.waitForDeployment();

        // 4. Settlement Router
        const RouterFactory = await ethers.getContractFactory("SettlementRouter");
        router = (await RouterFactory.deploy(await registry.getAddress())) as SettlementRouter;
        await router.waitForDeployment();

        // Setup roles
        // Grant OPERATOR_ROLE to agent on Pool and Router
        const OPERATOR_ROLE = await pool.OPERATOR_ROLE();
        await pool.grantRole(OPERATOR_ROLE, agent.address);
        await router.grantRole(OPERATOR_ROLE, agent.address);

        // Fund the pool with TestToken
        await testToken.mint(await pool.getAddress(), ethers.parseEther("1000000"));
    });

    describe("Financing Pool Flow", function () {
        it("Should mint and register an invoice", async function () {
            const data = {
                invoiceId: INVOICE_ID,
                issuer: company.address,
                debtor: payer.address,
                amount: ethers.parseEther("1000"), // $1000
                dueDate: Math.floor(Date.now() / 1000) + 86400 * 30,
                currency: await testToken.getAddress()
            };

            await invoiceToken.connect(deployer).mintInvoice(data, "ipfs://rwa-meta");

            const tokenId = await invoiceToken.tokenOfInvoice(INVOICE_ID);
            await registry.connect(deployer).registerInvoice(INVOICE_ID, tokenId, company.address, payer.address);

            expect(await invoiceToken.ownerOf(tokenId)).to.equal(company.address);
        });

        it("Should lock collateral in the pool", async function () {
            const tokenId = await invoiceToken.tokenOfInvoice(INVOICE_ID);

            // Company transfers NFT to pool
            await invoiceToken.connect(company).safeTransferFrom(company.address, await pool.getAddress(), tokenId);
            expect(await invoiceToken.ownerOf(tokenId)).to.equal(await pool.getAddress());

            // Operator locks collateral
            await pool.connect(agent).lockCollateral(INVOICE_ID, tokenId, company.address);

            const pos = await pool.getPosition(INVOICE_ID);
            expect(pos.exists).to.be.true;
            expect(pos.maxCreditLine).to.equal(ethers.parseEther("1000") * DEFAULT_LTV_BPS / 10000n);
        });

        it("Should draw credit", async function () {
            const amount = ethers.parseEther("500");
            // Company draws credit? No, Requirement says OPERATOR calls drawCredit.
            // "Only OPERATOR_ROLE or ADMIN_ROLE"

            const balanceBefore = await testToken.balanceOf(company.address);
            await pool.connect(agent).drawCredit(INVOICE_ID, amount, company.address);

            const balanceAfter = await testToken.balanceOf(company.address);
            expect(balanceAfter - balanceBefore).to.equal(amount);

            const pos = await pool.getPosition(INVOICE_ID);
            expect(pos.usedCredit).to.equal(amount);
        });

        it("Should repay credit", async function () {
            const amount = ethers.parseEther("500");

            // Company approves pool to take tokens back
            await testToken.connect(company).approve(await pool.getAddress(), amount);

            await pool.connect(company).repayCredit(INVOICE_ID, amount);

            const pos = await pool.getPosition(INVOICE_ID);
            expect(pos.usedCredit).to.equal(0);
        });

        it("Should release collateral", async function () {
            const tokenId = await invoiceToken.tokenOfInvoice(INVOICE_ID);

            await pool.connect(agent).releaseCollateral(INVOICE_ID);

            expect(await invoiceToken.ownerOf(tokenId)).to.equal(company.address);
            expect((await pool.getPosition(INVOICE_ID)).exists).to.be.false;
        });
    });

    describe("Settlement Router Flow", function () {
        const RULE_ID_INVOICE = ethers.keccak256(ethers.toUtf8Bytes("INV-SETTLE-001"));
        let ruleId: string;

        it("Should create a settlement rule", async function () {
            // Create another invoice for settlement test
            const data = {
                invoiceId: RULE_ID_INVOICE,
                issuer: company.address,
                debtor: payer.address,
                amount: ethers.parseEther("2000"),
                dueDate: Math.floor(Date.now() / 1000) + 86400 * 30,
                currency: await testToken.getAddress()
            };
            await invoiceToken.mintInvoice(data, "ipfs://settle");
            const tokenId = await invoiceToken.tokenOfInvoice(RULE_ID_INVOICE);
            await registry.registerInvoice(RULE_ID_INVOICE, tokenId, company.address, payer.address);

            // Rule: 70% to recipient1, 30% to recipient2
            const recipients = [recipient1.address, recipient2.address];
            const splits = [7000n, 3000n];

            const tx = await router.connect(agent).createRule(
                RULE_ID_INVOICE,
                payer.address,
                recipients,
                splits,
                await testToken.getAddress()
            );

            const rc = await tx.wait();
            // Find event
            // @ts-ignore
            const event = rc?.logs.find(log => {
                try { return router.interface.parseLog(log)?.name === "SettlementRuleCreated"; } catch (e) { return false }
            });
            // @ts-ignore
            const parsed = router.interface.parseLog(event!);
            ruleId = parsed?.args[0];

            expect(ruleId).to.not.be.undefined;
        });

        it("Should execute settlement", async function () {
            const grossAmount = ethers.parseEther("1000");

            // Payer (or operator) needs tokens
            await testToken.mint(agent.address, grossAmount);
            await testToken.connect(agent).approve(await router.getAddress(), grossAmount);

            const bal1Before = await testToken.balanceOf(recipient1.address);
            const bal2Before = await testToken.balanceOf(recipient2.address);

            await router.connect(agent).executeSettlement(ruleId, grossAmount);

            const bal1After = await testToken.balanceOf(recipient1.address);
            const bal2After = await testToken.balanceOf(recipient2.address);

            expect(bal1After - bal1Before).to.equal(ethers.parseEther("700"));
            expect(bal2After - bal2Before).to.equal(ethers.parseEther("300"));
        });
    });
});
