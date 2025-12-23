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

        // 3. LP Share Token
        const LPShareTokenFactory = await ethers.getContractFactory("LPShareToken");
        const lpToken = await LPShareTokenFactory.deploy();
        await lpToken.waitForDeployment();

        // 4. Financing Pool
        const PoolFactory = await ethers.getContractFactory("FinancingPool");
        const BORROW_APR_WAD = ethers.parseEther("0.15"); // 15% APR
        const PROTOCOL_FEE_BPS = 1000; // 10%
        pool = (await PoolFactory.deploy(
            await invoiceToken.getAddress(),
            await registry.getAddress(),
            await testToken.getAddress(),
            await lpToken.getAddress(),
            DEFAULT_LTV_BPS,
            8000, // 80% max utilization
            BORROW_APR_WAD,
            PROTOCOL_FEE_BPS
        )) as FinancingPool;
        await pool.waitForDeployment();

        // Grant LP token roles to pool
        await lpToken.grantPoolRoles(await pool.getAddress());

        // 4. Settlement Router
        const RouterFactory = await ethers.getContractFactory("SettlementRouter");
        router = (await RouterFactory.deploy(await registry.getAddress())) as SettlementRouter;
        await router.waitForDeployment();

        // Setup roles
        // Grant OPERATOR_ROLE to agent on Pool and Router
        const OPERATOR_ROLE = await pool.OPERATOR_ROLE();
        await pool.grantRole(OPERATOR_ROLE, agent.address);
        await router.grantRole(OPERATOR_ROLE, agent.address);

        // Fund the pool with TestToken via LP deposit
        await testToken.mint(deployer.address, ethers.parseEther("1000000"));
        await testToken.connect(deployer).approve(await pool.getAddress(), ethers.MaxUint256);
        await pool.connect(deployer).deposit(ethers.parseEther("1000000"));

        // Mint tokens for company to repay debt
        await testToken.mint(company.address, ethers.parseEther("10000"));
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

            // Must call from issuer address (company), not deployer
            await invoiceToken.connect(company).mintInvoice(data, "ipfs://rwa-meta");

            const tokenId = await invoiceToken.tokenOfInvoice(INVOICE_ID);
            await registry.connect(deployer).registerInvoice(INVOICE_ID, tokenId, company.address, payer.address);

            expect(await invoiceToken.ownerOf(tokenId)).to.equal(company.address);
        });

        it("Should lock collateral in the pool", async function () {
            const tokenId = await invoiceToken.tokenOfInvoice(INVOICE_ID);

            // Company approves pool to transfer NFT
            await invoiceToken.connect(company).approve(await pool.getAddress(), tokenId);

            // Company locks collateral (lockCollateral will transfer the token)
            await pool.connect(company).lockCollateral(INVOICE_ID, tokenId, company.address);

            const pos = await pool.getPosition(INVOICE_ID);
            expect(pos.exists).to.be.true;
            expect(pos.maxCreditLine).to.equal(ethers.parseEther("1000") * DEFAULT_LTV_BPS / 10000n);
        });

        it("Should draw credit", async function () {
            const amount = ethers.parseEther("500");
            // Company draws credit (drawCredit checks that company matches position.company)

            const balanceBefore = await testToken.balanceOf(company.address);
            await pool.connect(company).drawCredit(INVOICE_ID, amount, company.address);

            const balanceAfter = await testToken.balanceOf(company.address);
            expect(balanceAfter - balanceBefore).to.equal(amount);

            const pos = await pool.getPosition(INVOICE_ID);
            expect(pos.usedCredit).to.equal(amount);
        });

        it("Should repay credit", async function () {
            // Get current position to see total debt (principal + interest)
            const posBefore = await pool.getPosition(INVOICE_ID);
            // Accrue interest first if needed
            if (posBefore.usedCredit > 0) {
                await pool.accrueInterest(INVOICE_ID);
            }
            const posAfterAccrual = await pool.getPosition(INVOICE_ID);
            const totalDebt = posAfterAccrual.usedCredit + posAfterAccrual.interestAccrued;

            // Company approves pool to take tokens back (add 10% buffer for rounding)
            const repayAmount = totalDebt + (totalDebt / 10n);
            await testToken.connect(company).approve(await pool.getAddress(), repayAmount);

            // RepayCredit will accrue interest again and pay what's needed
            await pool.connect(company).repayCredit(INVOICE_ID, repayAmount);

            const pos = await pool.getPosition(INVOICE_ID);
            // Allow small tolerance for rounding (1e12 = 0.000001 ETH)
            expect(pos.usedCredit).to.be.lte(ethers.parseEther("0.000001"));
            expect(pos.interestAccrued).to.be.lte(ethers.parseEther("0.000001"));
        });

        it("Should release collateral", async function () {
            const tokenId = await invoiceToken.tokenOfInvoice(INVOICE_ID);

            // Ensure all debt is paid (accrue and check)
            await pool.accrueInterest(INVOICE_ID);
            const pos = await pool.getPosition(INVOICE_ID);
            if (pos.usedCredit > 0 || pos.interestAccrued > 0) {
                const totalDebt = pos.usedCredit + pos.interestAccrued;
                await testToken.connect(company).approve(await pool.getAddress(), totalDebt);
                await pool.connect(company).repayCredit(INVOICE_ID, totalDebt);
            }

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
            // Must call from issuer address (company), not deployer
            await invoiceToken.connect(company).mintInvoice(data, "ipfs://settle");
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
