import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { FinancingPool, InvoiceToken, InvoiceRegistry, TestToken, LPShareToken } from "../typechain-types";

describe("Production Safeguards", function () {
    let owner: any;
    let lp1: any;
    let issuer: any;
    let issuer2: any;
    let testToken: TestToken;
    let invoiceToken: InvoiceToken;
    let registry: InvoiceRegistry;
    let lpToken: LPShareToken;
    let financingPool: FinancingPool;

    const GRACE_PERIOD = 7 * 24 * 3600; // 7 days
    const RECOVERY_WINDOW = 30 * 24 * 3600; // 30 days

    beforeEach(async function () {
        [owner, lp1, issuer, issuer2] = await ethers.getSigners();

        // Deploy TestToken
        const TestTokenFactory = await ethers.getContractFactory("TestToken");
        testToken = await TestTokenFactory.deploy();

        // Deploy InvoiceToken
        const InvoiceTokenFactory = await ethers.getContractFactory("InvoiceToken");
        invoiceToken = await InvoiceTokenFactory.deploy();

        // Deploy Registry
        const RegistryFactory = await ethers.getContractFactory("InvoiceRegistry");
        registry = await RegistryFactory.deploy(invoiceToken.address);

        // Deploy LPShareToken
        const LPShareTokenFactory = await ethers.getContractFactory("LPShareToken");
        lpToken = await LPShareTokenFactory.deploy("TIFA LP Token", "TIFA-LP");

        // Deploy FinancingPool
        const FinancingPoolFactory = await ethers.getContractFactory("FinancingPool");
        financingPool = await FinancingPoolFactory.deploy(
            invoiceToken.address,
            registry.address,
            testToken.address,
            lpToken.address,
            6000, // defaultLtvBps (60%)
            8000, // maxUtilizationBps (80%)
            ethers.parseEther("0.15"), // borrowAprWad (15%)
            1000  // protocolFeeBps (10%)
        );

        // Grant roles
        await lpToken.grantRole(await lpToken.MINTER_ROLE(), financingPool.address);
        await lpToken.grantRole(await lpToken.BURNER_ROLE(), financingPool.address);
        await registry.grantRole(await registry.OPERATOR_ROLE(), financingPool.address);
        await financingPool.grantRole(await financingPool.ADMIN_ROLE(), owner.address);
    });

    describe("Pause Mechanism", function () {
        it("Should prevent drawCredit when paused", async function () {
            // Setup: Deposit liquidity and create invoice
            const deposit = ethers.parseEther("10000");
            await testToken.mint(lp1.address, deposit);
            await testToken.connect(lp1).approve(financingPool.address, deposit);
            await financingPool.connect(lp1).deposit(deposit);

            const invoiceId = ethers.id("INV-PAUSE-001");
            const invoiceAmount = ethers.parseEther("5000");
            const dueDate = Math.floor(Date.now() / 1000) + 86400;

            const invoiceData = {
                invoiceId: invoiceId,
                issuer: issuer.address,
                debtor: issuer.address,
                amount: invoiceAmount,
                dueDate: dueDate,
                currency: ethers.ZeroAddress
            };
            await invoiceToken.connect(issuer).mintInvoice(invoiceData, "ipfs://metadata");

            const tokenId = await invoiceToken.tokenOfInvoice(invoiceId);
            await invoiceToken.connect(issuer).approve(financingPool.address, tokenId);
            await financingPool.connect(issuer).lockCollateral(invoiceId, tokenId, issuer.address);

            // Pause pool
            await financingPool.connect(owner).pause();

            // Try to draw credit - should revert
            await expect(
                financingPool.connect(issuer).drawCredit(invoiceId, ethers.parseEther("3000"), issuer.address)
            ).to.be.revertedWithCustomError(financingPool, "EnforcedPause");

            // Unpause
            await financingPool.connect(owner).unpause();

            // Now should work
            await expect(
                financingPool.connect(issuer).drawCredit(invoiceId, ethers.parseEther("3000"), issuer.address)
            ).to.not.be.reverted;
        });

        it("Should prevent deposit/withdraw when paused", async function () {
            const deposit = ethers.parseEther("10000");
            await testToken.mint(lp1.address, deposit);
            await testToken.connect(lp1).approve(financingPool.address, deposit);

            await financingPool.connect(owner).pause();

            await expect(
                financingPool.connect(lp1).deposit(deposit)
            ).to.be.revertedWithCustomError(financingPool, "EnforcedPause");

            await financingPool.connect(owner).unpause();
            await financingPool.connect(lp1).deposit(deposit);

            await financingPool.connect(owner).pause();
            await expect(
                financingPool.connect(lp1).withdraw(ethers.parseEther("5000"))
            ).to.be.revertedWithCustomError(financingPool, "EnforcedPause");
        });
    });

    describe("Utilization Circuit Breaker", function () {
        it("Should revert drawCredit when utilization >= maxUtilizationBps", async function () {
            // Setup: Deposit liquidity
            const deposit = ethers.parseEther("10000");
            await testToken.mint(lp1.address, deposit);
            await testToken.connect(lp1).approve(financingPool.address, deposit);
            await financingPool.connect(lp1).deposit(deposit);

            // Create and lock invoice
            const invoiceId = ethers.id("INV-UTIL-001");
            const invoiceAmount = ethers.parseEther("5000");
            const dueDate = Math.floor(Date.now() / 1000) + 86400;

            const invoiceData = {
                invoiceId: invoiceId,
                issuer: issuer.address,
                debtor: issuer.address,
                amount: invoiceAmount,
                dueDate: dueDate,
                currency: ethers.ZeroAddress
            };
            await invoiceToken.connect(issuer).mintInvoice(invoiceData, "ipfs://metadata");

            const tokenId = await invoiceToken.tokenOfInvoice(invoiceId);
            await invoiceToken.connect(issuer).approve(financingPool.address, tokenId);
            await financingPool.connect(issuer).lockCollateral(invoiceId, tokenId, issuer.address);

            // Draw credit up to max utilization (80% = 8000 bps)
            // maxUtilizationBps = 8000, so we can borrow up to 80% of 10000 = 8000
            await financingPool.connect(issuer).drawCredit(invoiceId, ethers.parseEther("8000"), issuer.address);

            // Try to draw more - should revert
            await expect(
                financingPool.connect(issuer).drawCredit(invoiceId, ethers.parseEther("100"), issuer.address)
            ).to.be.revertedWith("UTILIZATION_LIMIT_REACHED");
        });
    });

    describe("Max Single Loan Size", function () {
        it("Should revert drawCredit when loan > maxLoanBpsOfTVL", async function () {
            // Setup: Deposit liquidity
            const deposit = ethers.parseEther("10000");
            await testToken.mint(lp1.address, deposit);
            await testToken.connect(lp1).approve(financingPool.address, deposit);
            await financingPool.connect(lp1).deposit(deposit);

            // maxLoanBpsOfTVL defaults to 1000 (10%)
            // NAV ≈ 10000, so max single loan = 10000 * 10% = 1000

            const invoiceId = ethers.id("INV-MAXLOAN-001");
            const invoiceAmount = ethers.parseEther("5000");
            const dueDate = Math.floor(Date.now() / 1000) + 86400;

            const invoiceData = {
                invoiceId: invoiceId,
                issuer: issuer.address,
                debtor: issuer.address,
                amount: invoiceAmount,
                dueDate: dueDate,
                currency: ethers.ZeroAddress
            };
            await invoiceToken.connect(issuer).mintInvoice(invoiceData, "ipfs://metadata");

            const tokenId = await invoiceToken.tokenOfInvoice(invoiceId);
            await invoiceToken.connect(issuer).approve(financingPool.address, tokenId);
            await financingPool.connect(issuer).lockCollateral(invoiceId, tokenId, issuer.address);

            // Try to draw more than 10% of NAV - should revert
            await expect(
                financingPool.connect(issuer).drawCredit(invoiceId, ethers.parseEther("1001"), issuer.address)
            ).to.be.revertedWith("MAX_SINGLE_LOAN_EXCEEDED");

            // Should work with amount <= 10%
            await expect(
                financingPool.connect(issuer).drawCredit(invoiceId, ethers.parseEther("1000"), issuer.address)
            ).to.not.be.reverted;
        });
    });

    describe("Issuer Exposure Limit", function () {
        it("Should revert drawCredit when issuer exposure > maxIssuerExposureBps", async function () {
            // Setup: Deposit liquidity
            const deposit = ethers.parseEther("10000");
            await testToken.mint(lp1.address, deposit);
            await testToken.connect(lp1).approve(financingPool.address, deposit);
            await financingPool.connect(lp1).deposit(deposit);

            // maxIssuerExposureBps defaults to 2500 (25%)
            // NAV ≈ 10000, so max issuer exposure = 10000 * 25% = 2500

            // Create first invoice
            const invoiceId1 = ethers.id("INV-EXPOSURE-001");
            const invoiceAmount1 = ethers.parseEther("5000");
            const dueDate = Math.floor(Date.now() / 1000) + 86400;

            const invoiceData1 = {
                invoiceId: invoiceId1,
                issuer: issuer.address,
                debtor: issuer.address,
                amount: invoiceAmount1,
                dueDate: dueDate,
                currency: ethers.ZeroAddress
            };
            await invoiceToken.connect(issuer).mintInvoice(invoiceData1, "ipfs://metadata");

            const tokenId1 = await invoiceToken.tokenOfInvoice(invoiceId1);
            await invoiceToken.connect(issuer).approve(financingPool.address, tokenId1);
            await financingPool.connect(issuer).lockCollateral(invoiceId1, tokenId1, issuer.address);

            // Draw up to limit (2500)
            await financingPool.connect(issuer).drawCredit(invoiceId1, ethers.parseEther("2500"), issuer.address);

            // Create second invoice
            const invoiceId2 = ethers.id("INV-EXPOSURE-002");
            const invoiceData2 = {
                invoiceId: invoiceId2,
                issuer: issuer.address,
                debtor: issuer.address,
                amount: ethers.parseEther("5000"),
                dueDate: dueDate,
                currency: ethers.ZeroAddress
            };
            await invoiceToken.connect(issuer).mintInvoice(invoiceData2, "ipfs://metadata");

            const tokenId2 = await invoiceToken.tokenOfInvoice(invoiceId2);
            await invoiceToken.connect(issuer).approve(financingPool.address, tokenId2);
            await financingPool.connect(issuer).lockCollateral(invoiceId2, tokenId2, issuer.address);

            // Try to draw more - should revert (would exceed 25% limit)
            await expect(
                financingPool.connect(issuer).drawCredit(invoiceId2, ethers.parseEther("1"), issuer.address)
            ).to.be.revertedWith("ISSUER_EXPOSURE_LIMIT_EXCEEDED");

            // Repay some debt
            await testToken.mint(issuer.address, ethers.parseEther("1000"));
            await testToken.connect(issuer).approve(financingPool.address, ethers.parseEther("1000"));
            await financingPool.connect(issuer).repayCredit(invoiceId1, ethers.parseEther("1000"));

            // Now should be able to draw more
            await expect(
                financingPool.connect(issuer).drawCredit(invoiceId2, ethers.parseEther("1000"), issuer.address)
            ).to.not.be.reverted;
        });
    });

    describe("Normal Flow Still Works", function () {
        it("Should allow normal operations below all limits", async function () {
            // Setup: Deposit liquidity
            const deposit = ethers.parseEther("10000");
            await testToken.mint(lp1.address, deposit);
            await testToken.connect(lp1).approve(financingPool.address, deposit);
            await financingPool.connect(lp1).deposit(deposit);

            // Create invoice
            const invoiceId = ethers.id("INV-NORMAL-001");
            const invoiceAmount = ethers.parseEther("5000");
            const dueDate = Math.floor(Date.now() / 1000) + 86400;

            const invoiceData = {
                invoiceId: invoiceId,
                issuer: issuer.address,
                debtor: issuer.address,
                amount: invoiceAmount,
                dueDate: dueDate,
                currency: ethers.ZeroAddress
            };
            await invoiceToken.connect(issuer).mintInvoice(invoiceData, "ipfs://metadata");

            const tokenId = await invoiceToken.tokenOfInvoice(invoiceId);
            await invoiceToken.connect(issuer).approve(financingPool.address, tokenId);
            await financingPool.connect(issuer).lockCollateral(invoiceId, tokenId, issuer.address);

            // Draw credit (well below limits)
            await expect(
                financingPool.connect(issuer).drawCredit(invoiceId, ethers.parseEther("1000"), issuer.address)
            ).to.not.be.reverted;

            // Repay
            await testToken.mint(issuer.address, ethers.parseEther("1100")); // Include interest
            await testToken.connect(issuer).approve(financingPool.address, ethers.parseEther("1100"));
            await expect(
                financingPool.connect(issuer).repayCredit(invoiceId, ethers.parseEther("1100"))
            ).to.not.be.reverted;
        });
    });
});









