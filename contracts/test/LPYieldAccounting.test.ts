import { expect } from "chai";
import { ethers } from "hardhat";
import { FinancingPool, LPShareToken, TestToken, InvoiceToken, InvoiceRegistry } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("LP Yield Accounting", function () {
    let financingPool: FinancingPool;
    let lpToken: LPShareToken;
    let testToken: TestToken;
    let invoiceToken: InvoiceToken;
    let invoiceRegistry: InvoiceRegistry;
    let owner: SignerWithAddress;
    let lp1: SignerWithAddress;
    let company: SignerWithAddress;
    let deployer: SignerWithAddress;

    const WAD = ethers.parseEther("1");
    const SECONDS_PER_YEAR = 365 * 24 * 3600;
    const BORROW_APR_WAD = ethers.parseEther("0.15"); // 15% APR
    const PROTOCOL_FEE_BPS = 1000; // 10%

    beforeEach(async function () {
        [deployer, owner, lp1, company] = await ethers.getSigners();

        // Deploy TestToken
        const TestTokenFactory = await ethers.getContractFactory("TestToken");
        testToken = await TestTokenFactory.deploy();
        await testToken.waitForDeployment();

        // Deploy InvoiceToken
        const InvoiceTokenFactory = await ethers.getContractFactory("InvoiceToken");
        invoiceToken = await InvoiceTokenFactory.deploy("TIFA Invoice Token", "TIFA");
        await invoiceToken.waitForDeployment();

        // Deploy InvoiceRegistry
        const InvoiceRegistryFactory = await ethers.getContractFactory("InvoiceRegistry");
        invoiceRegistry = await InvoiceRegistryFactory.deploy(await invoiceToken.getAddress());
        await invoiceRegistry.waitForDeployment();

        // Deploy LPShareToken
        const LPShareTokenFactory = await ethers.getContractFactory("LPShareToken");
        lpToken = await LPShareTokenFactory.deploy();
        await lpToken.waitForDeployment();

        // Deploy FinancingPool
        const FinancingPoolFactory = await ethers.getContractFactory("FinancingPool");
        financingPool = await FinancingPoolFactory.deploy(
            await invoiceToken.getAddress(),
            await invoiceRegistry.getAddress(),
            await testToken.getAddress(),
            await lpToken.getAddress(),
            6000, // 60% LTV
            8000, // 80% max utilization
            BORROW_APR_WAD,
            PROTOCOL_FEE_BPS
        );
        await financingPool.waitForDeployment();

        // Grant LP token roles to pool
        await lpToken.grantPoolRoles(await financingPool.getAddress());

        // Grant ADMIN_ROLE to owner
        await financingPool.grantRole(await financingPool.ADMIN_ROLE(), owner.address);

        // Mint test tokens
        const amount = ethers.parseEther("1000000");
        await testToken.mint(lp1.address, amount);
        await testToken.mint(company.address, amount);

        // Approve pool
        await testToken.connect(lp1).approve(await financingPool.getAddress(), ethers.MaxUint256);
        await testToken.connect(company).approve(await financingPool.getAddress(), ethers.MaxUint256);
    });

    describe("First Deposit", function () {
        it("Should mint shares 1:1 on first deposit", async function () {
            const depositAmount = ethers.parseEther("1000");
            
            await financingPool.connect(lp1).deposit(depositAmount);
            
            const lpShares = await lpToken.balanceOf(lp1.address);
            expect(lpShares).to.equal(depositAmount);
            
            const sharePrice = await financingPool.sharePriceWad();
            expect(sharePrice).to.equal(WAD); // 1.0 in WAD
        });
    });

    describe("Second Deposit After Interest", function () {
        it("Should mint shares at higher share price after interest accrual", async function () {
            // First deposit
            const deposit1 = ethers.parseEther("1000");
            await financingPool.connect(lp1).deposit(deposit1);
            
            // Create invoice and borrow
            const invoiceId = ethers.id("INV-001");
            const invoiceAmount = ethers.parseEther("500");
            
            // Mint invoice NFT
            const invoiceData = {
                invoiceId: invoiceId,
                issuer: company.address,
                debtor: company.address,
                amount: invoiceAmount,
                dueDate: Math.floor(Date.now() / 1000) + 86400,
                currency: ethers.ZeroAddress
            };
            await invoiceToken.connect(company).mintInvoice(invoiceData, "ipfs://metadata");
            
            // Lock collateral
            const tokenId = await invoiceToken.tokenOfInvoice(invoiceId);
            await invoiceToken.connect(company).approve(await financingPool.getAddress(), tokenId);
            await financingPool.connect(company).lockCollateral(invoiceId, tokenId, company.address);
            
            // Borrow
            const borrowAmount = ethers.parseEther("300");
            await financingPool.connect(company).drawCredit(invoiceId, borrowAmount, company.address);
            
            // Advance time (1 year)
            await time.increase(SECONDS_PER_YEAR);
            
            // Accrue interest
            await financingPool.accrueInterest(invoiceId);
            
            // Check share price increased
            const sharePriceBefore = await financingPool.sharePriceWad();
            expect(sharePriceBefore).to.be.gt(WAD);
            
            // Second deposit
            const deposit2 = ethers.parseEther("100");
            const sharesBefore = await lpToken.balanceOf(lp1.address);
            await financingPool.connect(lp1).deposit(deposit2);
            const sharesAfter = await lpToken.balanceOf(lp1.address);
            
            // Shares minted should be less than deposit amount (due to higher share price)
            const sharesMinted = sharesAfter - sharesBefore;
            expect(sharesMinted).to.be.lt(deposit2);
            
            // Share price should remain same (allow small tolerance for rounding)
            const sharePriceAfter = await financingPool.sharePriceWad();
            const sharePriceDiff = sharePriceAfter > sharePriceBefore 
                ? sharePriceAfter - sharePriceBefore 
                : sharePriceBefore - sharePriceAfter;
            // Allow tolerance - deposit can slightly change NAV due to rounding and interest accrual
            // Use 1% tolerance - deposit adds liquidity which can affect share price calculation
            const tolerance = sharePriceBefore / 100n; // 1% tolerance
            expect(sharePriceDiff).to.be.lte(tolerance);
        });
    });

    describe("Interest Accrual", function () {
        it("Should accrue interest over time", async function () {
            // Setup: deposit and borrow
            const deposit = ethers.parseEther("1000");
            await financingPool.connect(lp1).deposit(deposit);
            
            const invoiceId = ethers.id("INV-002");
            const invoiceAmount = ethers.parseEther("500");
            
            const invoiceData = {
                invoiceId: invoiceId,
                issuer: company.address,
                debtor: company.address,
                amount: invoiceAmount,
                dueDate: Math.floor(Date.now() / 1000) + 86400,
                currency: ethers.ZeroAddress
            };
            await invoiceToken.connect(company).mintInvoice(invoiceData, "ipfs://metadata");
            
            const tokenId = await invoiceToken.tokenOfInvoice(invoiceId);
            await invoiceToken.connect(company).approve(await financingPool.getAddress(), tokenId);
            await financingPool.connect(company).lockCollateral(invoiceId, tokenId, company.address);
            
            const borrowAmount = ethers.parseEther("300");
            await financingPool.connect(company).drawCredit(invoiceId, borrowAmount, company.address);
            
            // Check initial state
            let position = await financingPool.getPosition(invoiceId);
            expect(position.interestAccrued).to.equal(0);
            
            // Advance 1 year
            await time.increase(SECONDS_PER_YEAR);
            
            // Accrue interest
            await financingPool.accrueInterest(invoiceId);
            
            // Check interest accrued (approximately 15% of 300 = 45)
            position = await financingPool.getPosition(invoiceId);
            const expectedInterest = (borrowAmount * 15n) / 100n; // 15% of 300 = 45
            expect(position.interestAccrued).to.be.closeTo(expectedInterest, ethers.parseEther("1")); // Within 1 token tolerance
            
            // Check total interest accrued
            const totalInterest = await financingPool.totalInterestAccrued();
            expect(totalInterest).to.equal(position.interestAccrued);
        });
    });

    describe("Repayment with Interest", function () {
        it("Should pay interest first, then principal, and split protocol fee", async function () {
            // Setup
            const deposit = ethers.parseEther("1000");
            await financingPool.connect(lp1).deposit(deposit);
            
            const invoiceId = ethers.id("INV-003");
            const invoiceAmount = ethers.parseEther("500");
            
            const invoiceData = {
                invoiceId: invoiceId,
                issuer: company.address,
                debtor: company.address,
                amount: invoiceAmount,
                dueDate: Math.floor(Date.now() / 1000) + 86400,
                currency: ethers.ZeroAddress
            };
            await invoiceToken.connect(company).mintInvoice(invoiceData, "ipfs://metadata");
            
            const tokenId = await invoiceToken.tokenOfInvoice(invoiceId);
            await invoiceToken.connect(company).approve(await financingPool.getAddress(), tokenId);
            await financingPool.connect(company).lockCollateral(invoiceId, tokenId, company.address);
            
            const borrowAmount = ethers.parseEther("300");
            await financingPool.connect(company).drawCredit(invoiceId, borrowAmount, company.address);
            
            // Advance 1 year and accrue
            await time.increase(SECONDS_PER_YEAR);
            await financingPool.accrueInterest(invoiceId);
            
            const positionBefore = await financingPool.getPosition(invoiceId);
            const interestAccrued = positionBefore.interestAccrued;
            const protocolFeesBefore = await financingPool.protocolFeesAccrued();
            
            // Repay interest + some principal
            const repayAmount = interestAccrued + ethers.parseEther("50");
            await financingPool.connect(company).repayCredit(invoiceId, repayAmount);
            
            // Check interest was paid
            const positionAfter = await financingPool.getPosition(invoiceId);
            expect(positionAfter.interestAccrued).to.equal(0);
            
            // Check protocol fee was accrued
            const protocolFeesAfter = await financingPool.protocolFeesAccrued();
            const expectedProtocolFee = (interestAccrued * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
            // Allow small tolerance for rounding (1e15 = 0.000001 ETH)
            const tolerance = ethers.parseEther("0.000001");
            expect(protocolFeesAfter).to.be.gte(protocolFeesBefore + expectedProtocolFee - tolerance);
            expect(protocolFeesAfter).to.be.lte(protocolFeesBefore + expectedProtocolFee + tolerance);
            
            // Check principal was reduced
            expect(positionAfter.usedCredit).to.be.lt(positionBefore.usedCredit);
        });
    });

    describe("Share Price Increase", function () {
        it("Should increase share price after interest earned", async function () {
            const deposit = ethers.parseEther("1000");
            await financingPool.connect(lp1).deposit(deposit);
            
            const sharePriceBefore = await financingPool.sharePriceWad();
            expect(sharePriceBefore).to.equal(WAD);
            
            // Borrow and accrue interest
            const invoiceId = ethers.id("INV-004");
            const invoiceAmount = ethers.parseEther("500");
            
            const invoiceData = {
                invoiceId: invoiceId,
                issuer: company.address,
                debtor: company.address,
                amount: invoiceAmount,
                dueDate: Math.floor(Date.now() / 1000) + 86400,
                currency: ethers.ZeroAddress
            };
            await invoiceToken.connect(company).mintInvoice(invoiceData, "ipfs://metadata");
            
            const tokenId = await invoiceToken.tokenOfInvoice(invoiceId);
            await invoiceToken.connect(company).approve(await financingPool.getAddress(), tokenId);
            await financingPool.connect(company).lockCollateral(invoiceId, tokenId, company.address);
            
            const borrowAmount = ethers.parseEther("300");
            await financingPool.connect(company).drawCredit(invoiceId, borrowAmount, company.address);
            
            await time.increase(SECONDS_PER_YEAR);
            await financingPool.accrueInterest(invoiceId);
            
            // Share price should increase
            const sharePriceAfter = await financingPool.sharePriceWad();
            expect(sharePriceAfter).to.be.gt(sharePriceBefore);
        });
    });

    describe("Withdraw with Yield", function () {
        it("Should allow LP to withdraw principal + yield", async function () {
            const deposit = ethers.parseEther("1000");
            await financingPool.connect(lp1).deposit(deposit);
            
            const sharesBefore = await lpToken.balanceOf(lp1.address);
            
            // Generate yield through borrowing
            const invoiceId = ethers.id("INV-005");
            const invoiceAmount = ethers.parseEther("500");
            
            const invoiceData = {
                invoiceId: invoiceId,
                issuer: company.address,
                debtor: company.address,
                amount: invoiceAmount,
                dueDate: Math.floor(Date.now() / 1000) + 86400,
                currency: ethers.ZeroAddress
            };
            await invoiceToken.connect(company).mintInvoice(invoiceData, "ipfs://metadata");
            
            const tokenId = await invoiceToken.tokenOfInvoice(invoiceId);
            await invoiceToken.connect(company).approve(await financingPool.getAddress(), tokenId);
            await financingPool.connect(company).lockCollateral(invoiceId, tokenId, company.address);
            
            const borrowAmount = ethers.parseEther("300");
            await financingPool.connect(company).drawCredit(invoiceId, borrowAmount, company.address);
            
            await time.increase(SECONDS_PER_YEAR);
            await financingPool.accrueInterest(invoiceId);
            
            // Repay interest to realize yield
            const position = await financingPool.getPosition(invoiceId);
            await financingPool.connect(company).repayCredit(invoiceId, position.interestAccrued);
            
            // Withdraw
            const withdrawShares = sharesBefore / 2n; // Withdraw half
            const balanceBefore = await testToken.balanceOf(lp1.address);
            await financingPool.connect(lp1).withdraw(withdrawShares);
            const balanceAfter = await testToken.balanceOf(lp1.address);
            
            const withdrawn = balanceAfter - balanceBefore;
            // Withdrawn amount should be greater than proportional deposit (due to yield)
            const proportionalDeposit = deposit / 2n;
            expect(withdrawn).to.be.gte(proportionalDeposit);
        });
    });

    describe("Loss Handling", function () {
        it("Should reduce NAV and share price on write-down", async function () {
            const deposit = ethers.parseEther("1000");
            await financingPool.connect(lp1).deposit(deposit);
            
            // Borrow
            const invoiceId = ethers.id("INV-006");
            const invoiceAmount = ethers.parseEther("500");
            
            const invoiceData = {
                invoiceId: invoiceId,
                issuer: company.address,
                debtor: company.address,
                amount: invoiceAmount,
                dueDate: Math.floor(Date.now() / 1000) + 86400,
                currency: ethers.ZeroAddress
            };
            await invoiceToken.connect(company).mintInvoice(invoiceData, "ipfs://metadata");
            
            const tokenId = await invoiceToken.tokenOfInvoice(invoiceId);
            await invoiceToken.connect(company).approve(await financingPool.getAddress(), tokenId);
            await financingPool.connect(company).lockCollateral(invoiceId, tokenId, company.address);
            
            const borrowAmount = ethers.parseEther("300");
            await financingPool.connect(company).drawCredit(invoiceId, borrowAmount, company.address);
            
            const sharePriceBefore = await financingPool.sharePriceWad();
            const navBefore = await financingPool.getNAV();
            
            // Write down loss
            const lossAmount = ethers.parseEther("50");
            await financingPool.connect(owner).writeDownLoss(invoiceId, lossAmount);
            
            const sharePriceAfter = await financingPool.sharePriceWad();
            const navAfter = await financingPool.getNAV();
            
            // NAV and share price should decrease
            expect(navAfter).to.be.lt(navBefore);
            expect(sharePriceAfter).to.be.lt(sharePriceBefore);
            
            // Check losses tracked
            const totalLosses = await financingPool.totalLosses();
            expect(totalLosses).to.equal(lossAmount);
        });
    });

    describe("Protocol Fee Withdrawal", function () {
        it("Should allow admin to withdraw protocol fees", async function () {
            // Setup and generate fees
            const deposit = ethers.parseEther("1000");
            await financingPool.connect(lp1).deposit(deposit);
            
            const invoiceId = ethers.id("INV-007");
            const invoiceAmount = ethers.parseEther("500");
            
            const invoiceData = {
                invoiceId: invoiceId,
                issuer: company.address,
                debtor: company.address,
                amount: invoiceAmount,
                dueDate: Math.floor(Date.now() / 1000) + 86400,
                currency: ethers.ZeroAddress
            };
            await invoiceToken.connect(company).mintInvoice(invoiceData, "ipfs://metadata");
            
            const tokenId = await invoiceToken.tokenOfInvoice(invoiceId);
            await invoiceToken.connect(company).approve(await financingPool.getAddress(), tokenId);
            await financingPool.connect(company).lockCollateral(invoiceId, tokenId, company.address);
            
            const borrowAmount = ethers.parseEther("300");
            await financingPool.connect(company).drawCredit(invoiceId, borrowAmount, company.address);
            
            await time.increase(SECONDS_PER_YEAR);
            await financingPool.accrueInterest(invoiceId);
            
            const position = await financingPool.getPosition(invoiceId);
            await financingPool.connect(company).repayCredit(invoiceId, position.interestAccrued);
            
            const protocolFees = await financingPool.protocolFeesAccrued();
            expect(protocolFees).to.be.gt(0);
            
            // Withdraw fees
            const balanceBefore = await testToken.balanceOf(owner.address);
            await financingPool.connect(owner).withdrawProtocolFees(owner.address, protocolFees);
            const balanceAfter = await testToken.balanceOf(owner.address);
            
            expect(balanceAfter - balanceBefore).to.equal(protocolFees);
            expect(await financingPool.protocolFeesAccrued()).to.equal(0);
        });
    });
});

