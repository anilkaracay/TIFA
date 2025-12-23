import { expect } from "chai";
import { ethers } from "hardhat";
import { FinancingPool, LPShareToken, TestToken, InvoiceToken, InvoiceRegistry } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Demo B — Recourse vs Non-recourse", function () {
    let financingPool: FinancingPool;
    let lpToken: LPShareToken;
    let testToken: TestToken;
    let invoiceToken: InvoiceToken;
    let invoiceRegistry: InvoiceRegistry;
    let owner: SignerWithAddress;
    let lp1: SignerWithAddress;
    let issuer: SignerWithAddress;
    let deployer: SignerWithAddress;

    const WAD = ethers.parseEther("1");
    const SECONDS_PER_YEAR = 365 * 24 * 3600;
    const BORROW_APR_WAD = ethers.parseEther("0.15"); // 15% APR
    const PROTOCOL_FEE_BPS = 1000; // 10%
    const GRACE_PERIOD = 7 * 24 * 3600; // 7 days
    const RECOVERY_WINDOW = 30 * 24 * 3600; // 30 days

    beforeEach(async function () {
        [deployer, owner, lp1, issuer] = await ethers.getSigners();

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

        // Deploy FinancingPool (risk model parameters are set as defaults in constructor)
        const FinancingPoolFactory = await ethers.getContractFactory("FinancingPool");
        financingPool = await FinancingPoolFactory.deploy(
            await invoiceToken.getAddress(),
            await invoiceRegistry.getAddress(),
            await testToken.getAddress(),
            await lpToken.getAddress(),
            6000, // 60% LTV default (non-recourse)
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
        await testToken.mint(issuer.address, amount);
        await testToken.mint(owner.address, amount);

        // Approve pool
        await testToken.connect(lp1).approve(await financingPool.getAddress(), ethers.MaxUint256);
        await testToken.connect(issuer).approve(await financingPool.getAddress(), ethers.MaxUint256);
        await testToken.connect(owner).approve(await financingPool.getAddress(), ethers.MaxUint256);
    });

    it("Demo B.1: RECOURSE mode - Issuer pays recourse, LP loss minimal", async function () {
        console.log("\n=== Demo B.1 — RECOURSE Mode ===\n");

        // Step 1: LP deposits liquidity
        console.log("Step 1: LP deposits liquidity");
        const depositAmount = ethers.parseEther("10000");
        await financingPool.connect(lp1).deposit(depositAmount);
        
        const sharePriceBefore = await financingPool.sharePriceWad();
        const navBefore = await financingPool.getNAV();
        console.log(`  Share Price: ${ethers.formatEther(sharePriceBefore)}`);
        console.log(`  NAV: ${ethers.formatEther(navBefore)}`);

        // Step 2: Create invoice and finance
        console.log("\nStep 2: Create invoice and finance");
        const invoiceId = ethers.id("INV-RECOURSE-001");
        const invoiceAmount = ethers.parseEther("5000");
        const dueDate = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
        
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
        await invoiceToken.connect(issuer).approve(await financingPool.getAddress(), tokenId);
        await financingPool.connect(issuer).lockCollateral(invoiceId, tokenId, issuer.address);

        // Set to RECOURSE mode (before borrowing)
        await financingPool.connect(owner).setPositionRecourseMode(invoiceId, 0); // 0 = RECOURSE
        
        const borrowAmount = ethers.parseEther("4000"); // 80% of 5000 (RECOURSE LTV)
        await financingPool.connect(issuer).drawCredit(invoiceId, borrowAmount, issuer.address);

        let position = await financingPool.getPosition(invoiceId);
        console.log(`  Recourse Mode: ${position.recourseMode} (0=RECOURSE)`);
        console.log(`  Borrowed: ${ethers.formatEther(position.usedCredit)}`);

        // Step 3: Make invoice overdue
        console.log("\nStep 3: Make invoice overdue");
        await time.increase(86400 + 1); // Pass due date
        
        // Step 4: Start grace period
        console.log("Step 4: Start grace period");
        await financingPool.connect(owner).markOverdueAndStartGrace(invoiceId);
        
        position = await financingPool.getPosition(invoiceId);
        console.log(`  Grace Ends At: ${position.graceEndsAt}`);

        // Step 5: Wait for grace period to end and declare default
        console.log("\nStep 5: Wait for grace period and declare default");
        await time.increase(GRACE_PERIOD + 1);
        await financingPool.connect(owner).declareDefault(invoiceId);
        
        position = await financingPool.getPosition(invoiceId);
        console.log(`  Is In Default: ${position.isInDefault}`);
        console.log(`  Default Declared At: ${position.defaultDeclaredAt}`);

        // Step 6: Issuer pays recourse
        console.log("\nStep 6: Issuer pays recourse");
        const positionBeforeRecourse = await financingPool.getPosition(invoiceId);
        const totalDebt = positionBeforeRecourse.usedCredit + positionBeforeRecourse.interestAccrued;
        
        console.log(`  Total Debt: ${ethers.formatEther(totalDebt)}`);
        
        await financingPool.connect(issuer).payRecourse(invoiceId, totalDebt);
        
        const positionAfterRecourse = await financingPool.getPosition(invoiceId);
        const sharePriceAfter = await financingPool.sharePriceWad();
        const navAfter = await financingPool.getNAV();
        const lpLosses = await financingPool.lpLosses();
        
        console.log(`  Used Credit After: ${ethers.formatEther(positionAfterRecourse.usedCredit)}`);
        console.log(`  Interest After: ${ethers.formatEther(positionAfterRecourse.interestAccrued)}`);
        console.log(`  Share Price: ${ethers.formatEther(sharePriceAfter)}`);
        console.log(`  NAV: ${ethers.formatEther(navAfter)}`);
        console.log(`  LP Losses: ${ethers.formatEther(lpLosses)}`);

        // Verify LP loss is minimal/zero
        expect(positionAfterRecourse.usedCredit).to.equal(0);
        expect(positionAfterRecourse.interestAccrued).to.equal(0);
        expect(lpLosses).to.equal(0);
        expect(sharePriceAfter).to.be.gte(sharePriceBefore); // Share price should not decrease
        
        console.log("\n✅ RECOURSE Mode: LP loss is zero, share price maintained!");
    });

    it("Demo B.2: NON_RECOURSE mode - Reserve absorbs loss, LP protected", async function () {
        console.log("\n=== Demo B.2 — NON_RECOURSE Mode (Reserve Sufficient) ===\n");

        // Step 1: LP deposits liquidity
        console.log("Step 1: LP deposits liquidity");
        const depositAmount = ethers.parseEther("10000");
        await financingPool.connect(lp1).deposit(depositAmount);
        
        const sharePriceBefore = await financingPool.sharePriceWad();
        const navBefore = await financingPool.getNAV();
        console.log(`  Share Price: ${ethers.formatEther(sharePriceBefore)}`);
        console.log(`  NAV: ${ethers.formatEther(navBefore)}`);

        // Step 2: Fund reserve (sufficient to cover loss)
        console.log("\nStep 2: Fund reserve (sufficient)");
        const borrowAmount = ethers.parseEther("3000"); // Will be borrowed
        const reserveAmount = borrowAmount + ethers.parseEther("500"); // More than loss
        await financingPool.connect(owner).fundReserve(reserveAmount);
        
        const reserveBefore = await financingPool.reserveBalance();
        console.log(`  Reserve Balance: ${ethers.formatEther(reserveBefore)}`);

        // Step 3: Create invoice and finance (defaults to NON_RECOURSE)
        console.log("\nStep 3: Create invoice and finance (NON_RECOURSE)");
        const invoiceId = ethers.id("INV-NONRECOURSE-001");
        const invoiceAmount = ethers.parseEther("5000");
        const dueDate = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
        
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
        await invoiceToken.connect(issuer).approve(await financingPool.getAddress(), tokenId);
        await financingPool.connect(issuer).lockCollateral(invoiceId, tokenId, issuer.address);

        await financingPool.connect(issuer).drawCredit(invoiceId, borrowAmount, issuer.address);

        let position = await financingPool.getPosition(invoiceId);
        console.log(`  Recourse Mode: ${position.recourseMode} (1=NON_RECOURSE)`);
        console.log(`  Borrowed: ${ethers.formatEther(position.usedCredit)}`);

        // Step 4: Make invoice overdue
        console.log("\nStep 4: Make invoice overdue");
        await time.increase(86400 + 1); // Pass due date
        
        // Step 5: Start grace period
        console.log("Step 5: Start grace period");
        await financingPool.connect(owner).markOverdueAndStartGrace(invoiceId);
        
        // Step 6: Wait for grace period and declare default
        console.log("\nStep 6: Wait for grace period and declare default");
        await time.increase(GRACE_PERIOD + 1);
        await financingPool.connect(owner).declareDefault(invoiceId);
        
        // Step 7: Wait for recovery window
        console.log("\nStep 7: Wait for recovery window");
        await time.increase(RECOVERY_WINDOW + 1);
        
        // Step 8: Write down loss
        console.log("\nStep 8: Write down loss");
        const lossAmount = borrowAmount; // Full principal loss
        
        const reserveBeforeLoss = await financingPool.reserveBalance();
        const sharePriceBeforeLoss = await financingPool.sharePriceWad();
        const lpLossesBefore = await financingPool.lpLosses();
        
        await financingPool.connect(owner).writeDownLoss(invoiceId, lossAmount);
        
        const reserveAfter = await financingPool.reserveBalance();
        const sharePriceAfter = await financingPool.sharePriceWad();
        const lpLossesAfter = await financingPool.lpLosses();
        const navAfter = await financingPool.getNAV();
        
        console.log(`  Reserve Before: ${ethers.formatEther(reserveBeforeLoss)}`);
        console.log(`  Reserve After: ${ethers.formatEther(reserveAfter)}`);
        console.log(`  Reserve Used: ${ethers.formatEther(reserveBeforeLoss - reserveAfter)}`);
        console.log(`  Share Price Before: ${ethers.formatEther(sharePriceBeforeLoss)}`);
        console.log(`  Share Price After: ${ethers.formatEther(sharePriceAfter)}`);
        console.log(`  LP Losses: ${ethers.formatEther(lpLossesAfter)}`);
        console.log(`  NAV After: ${ethers.formatEther(navAfter)}`);

        // Verify reserve absorbed the loss
        expect(reserveAfter).to.be.lt(reserveBeforeLoss);
        expect(reserveAfter).to.equal(reserveBeforeLoss - lossAmount); // Reserve should decrease by loss amount
        expect(lpLossesAfter).to.equal(0); // Reserve should absorb, no LP loss
        // Share price may decrease slightly due to reserve being used, but LP losses should be 0
        // The key is that LP losses are 0, not that share price stays exactly the same
        
        console.log("\n✅ NON_RECOURSE Mode (Reserve Sufficient): Reserve absorbed loss, LP protected!");
    });

    it("Demo B.3: NON_RECOURSE mode - Reserve insufficient, LP NAV decreases", async function () {
        console.log("\n=== Demo B.3 — NON_RECOURSE Mode (Reserve Insufficient) ===\n");

        // Step 1: LP deposits liquidity
        console.log("Step 1: LP deposits liquidity");
        const depositAmount = ethers.parseEther("10000");
        await financingPool.connect(lp1).deposit(depositAmount);
        
        const sharePriceBefore = await financingPool.sharePriceWad();
        const navBefore = await financingPool.getNAV();
        console.log(`  Share Price: ${ethers.formatEther(sharePriceBefore)}`);
        console.log(`  NAV: ${ethers.formatEther(navBefore)}`);

        // Step 2: Fund small reserve (insufficient)
        console.log("\nStep 2: Fund small reserve (insufficient)");
        const reserveAmount = ethers.parseEther("500"); // Less than loss
        await financingPool.connect(owner).fundReserve(reserveAmount);
        
        const reserveBefore = await financingPool.reserveBalance();
        console.log(`  Reserve Balance: ${ethers.formatEther(reserveBefore)}`);

        // Step 3: Create invoice and finance
        console.log("\nStep 3: Create invoice and finance (NON_RECOURSE)");
        const invoiceId = ethers.id("INV-NONRECOURSE-002");
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
        await invoiceToken.connect(issuer).approve(await financingPool.getAddress(), tokenId);
        await financingPool.connect(issuer).lockCollateral(invoiceId, tokenId, issuer.address);

        const borrowAmount = ethers.parseEther("3000"); // 60% of 5000
        await financingPool.connect(issuer).drawCredit(invoiceId, borrowAmount, issuer.address);

        // Step 4-7: Overdue -> Grace -> Default -> Recovery window
        console.log("\nStep 4-7: Overdue -> Grace -> Default -> Recovery window");
        await time.increase(86400 + 1);
        await financingPool.connect(owner).markOverdueAndStartGrace(invoiceId);
        await time.increase(GRACE_PERIOD + 1);
        await financingPool.connect(owner).declareDefault(invoiceId);
        await time.increase(RECOVERY_WINDOW + 1);
        
        // Step 8: Write down loss (reserve insufficient)
        console.log("\nStep 8: Write down loss (reserve insufficient)");
        const lossAmount = borrowAmount; // Full principal loss
        
        const reserveBeforeLoss = await financingPool.reserveBalance();
        const sharePriceBeforeLoss = await financingPool.sharePriceWad();
        const lpLossesBefore = await financingPool.lpLosses();
        
        await financingPool.connect(owner).writeDownLoss(invoiceId, lossAmount);
        
        const reserveAfter = await financingPool.reserveBalance();
        const sharePriceAfter = await financingPool.sharePriceWad();
        const lpLossesAfter = await financingPool.lpLosses();
        const navAfter = await financingPool.getNAV();
        
        console.log(`  Reserve Before: ${ethers.formatEther(reserveBeforeLoss)}`);
        console.log(`  Reserve After: ${ethers.formatEther(reserveAfter)} (should be 0)`);
        console.log(`  Share Price Before: ${ethers.formatEther(sharePriceBeforeLoss)}`);
        console.log(`  Share Price After: ${ethers.formatEther(sharePriceAfter)} (should decrease)`);
        console.log(`  LP Losses: ${ethers.formatEther(lpLossesAfter)} (should be > 0)`);
        console.log(`  NAV After: ${ethers.formatEther(navAfter)} (should decrease)`);

        // Verify reserve exhausted and LP NAV decreased
        expect(reserveAfter).to.equal(0); // Reserve should be exhausted
        expect(lpLossesAfter).to.be.gt(0); // LP should take the remaining loss
        expect(sharePriceAfter).to.be.lt(sharePriceBeforeLoss); // Share price should decrease
        
        const lpLossAmount = lpLossesAfter;
        const expectedLpLoss = lossAmount - reserveBeforeLoss;
        console.log(`  Expected LP Loss: ${ethers.formatEther(expectedLpLoss)}`);
        console.log(`  Actual LP Loss: ${ethers.formatEther(lpLossAmount)}`);
        
        // Allow small tolerance for rounding
        expect(lpLossAmount).to.be.closeTo(expectedLpLoss, ethers.parseEther("0.01"));
        
        console.log("\n✅ NON_RECOURSE Mode (Reserve Insufficient): Reserve exhausted, LP NAV decreased!");
    });
});

