import { expect } from "chai";
import { ethers } from "hardhat";
import { FinancingPool, LPShareToken, TestToken, InvoiceToken, InvoiceRegistry } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Demo A — LP Yield (Model B'nin kalbi)", function () {
    let financingPool: FinancingPool;
    let lpToken: LPShareToken;
    let testToken: TestToken;
    let invoiceToken: InvoiceToken;
    let invoiceRegistry: InvoiceRegistry;
    let lp: SignerWithAddress;
    let company: SignerWithAddress;
    let deployer: SignerWithAddress;

    const WAD = ethers.parseEther("1");
    const SECONDS_PER_YEAR = 365 * 24 * 3600;
    const BORROW_APR_WAD = ethers.parseEther("0.15"); // 15% APR
    const PROTOCOL_FEE_BPS = 1000; // 10%

    beforeEach(async function () {
        [deployer, lp, company] = await ethers.getSigners();

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

        // Grant ADMIN_ROLE to deployer
        await financingPool.grantRole(await financingPool.ADMIN_ROLE(), deployer.address);

        // Mint test tokens
        const amount = ethers.parseEther("1000000");
        await testToken.mint(lp.address, amount);
        await testToken.mint(company.address, amount);

        // Approve pool
        await testToken.connect(lp).approve(await financingPool.getAddress(), ethers.MaxUint256);
        await testToken.connect(company).approve(await financingPool.getAddress(), ethers.MaxUint256);
    });

    it("Demo: LP deposits -> Company finances -> Time passes -> Repay -> LP sees yield", async function () {
        console.log("\n=== Demo A — LP Yield Flow ===\n");

        // Step 1: LP deposits liquidity
        console.log("Step 1: LP deposits liquidity");
        const depositAmount = ethers.parseEther("10000");
        await financingPool.connect(lp).deposit(depositAmount);
        
        const lpSharesAfterDeposit = await lpToken.balanceOf(lp.address);
        const sharePriceAfterDeposit = await financingPool.sharePriceWad();
        const underlyingValueAfterDeposit = await financingPool.getNAV();
        
        console.log(`  LP Shares: ${ethers.formatEther(lpSharesAfterDeposit)}`);
        console.log(`  Share Price: ${ethers.formatEther(sharePriceAfterDeposit)}`);
        console.log(`  Underlying Value (NAV): ${ethers.formatEther(underlyingValueAfterDeposit)}`);
        
        expect(lpSharesAfterDeposit).to.equal(depositAmount); // 1:1 on first deposit
        expect(sharePriceAfterDeposit).to.equal(WAD); // Share price = 1.0

        // Step 2: Company creates invoice and finances
        console.log("\nStep 2: Company creates invoice and finances");
        const invoiceId = ethers.id("INV-DEMO-001");
        const invoiceAmount = ethers.parseEther("5000");
        
        const invoiceData = {
            invoiceId: invoiceId,
            issuer: company.address,
            debtor: company.address,
            amount: invoiceAmount,
            dueDate: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
            currency: ethers.ZeroAddress
        };
        await invoiceToken.connect(company).mintInvoice(invoiceData, "ipfs://metadata");

        const tokenId = await invoiceToken.tokenOfInvoice(invoiceId);
        await invoiceToken.connect(company).approve(await financingPool.getAddress(), tokenId);
        await financingPool.connect(company).lockCollateral(invoiceId, tokenId, company.address);

        const borrowAmount = ethers.parseEther("3000"); // 60% of 5000
        await financingPool.connect(company).drawCredit(invoiceId, borrowAmount, company.address);

        const sharePriceAfterFinance = await financingPool.sharePriceWad();
        console.log(`  Share Price after finance: ${ethers.formatEther(sharePriceAfterFinance)}`);
        
        // Share price should still be ~1.0 (no interest accrued yet)
        expect(sharePriceAfterFinance).to.be.closeTo(WAD, ethers.parseEther("0.001"));

        // Step 3: Time passes (simulate interest accrual)
        console.log("\nStep 3: Time passes (1 year)");
        await time.increase(SECONDS_PER_YEAR);
        
        // Accrue interest
        await financingPool.accrueInterest(invoiceId);
        
        const sharePriceAfterTime = await financingPool.sharePriceWad();
        const navAfterTime = await financingPool.getNAV();
        const lpSharesAfterTime = await lpToken.balanceOf(lp.address);
        const underlyingValueAfterTime = (lpSharesAfterTime * sharePriceAfterTime) / WAD;
        
        console.log(`  LP Shares: ${ethers.formatEther(lpSharesAfterTime)} (should be same)`);
        console.log(`  Share Price: ${ethers.formatEther(sharePriceAfterTime)} (should increase)`);
        console.log(`  NAV: ${ethers.formatEther(navAfterTime)} (should increase)`);
        console.log(`  Underlying Value: ${ethers.formatEther(underlyingValueAfterTime)} (should increase)`);
        
        // LP shares should be the same
        expect(lpSharesAfterTime).to.equal(lpSharesAfterDeposit);
        
        // Share price should increase (interest accrued)
        expect(sharePriceAfterTime).to.be.gt(sharePriceAfterDeposit);
        
        // Underlying value should increase
        expect(underlyingValueAfterTime).to.be.gt(underlyingValueAfterDeposit);

        // Step 4: Company repays
        console.log("\nStep 4: Company repays");
        const position = await financingPool.getPosition(invoiceId);
        const totalDebt = position.usedCredit + position.interestAccrued;
        
        console.log(`  Principal: ${ethers.formatEther(position.usedCredit)}`);
        console.log(`  Interest: ${ethers.formatEther(position.interestAccrued)}`);
        console.log(`  Total Debt: ${ethers.formatEther(totalDebt)}`);
        
        await financingPool.connect(company).repayCredit(invoiceId, totalDebt);
        
        const sharePriceAfterRepay = await financingPool.sharePriceWad();
        const navAfterRepay = await financingPool.getNAV();
        const lpSharesAfterRepay = await lpToken.balanceOf(lp.address);
        const underlyingValueAfterRepay = (lpSharesAfterRepay * sharePriceAfterRepay) / WAD;
        
        console.log(`  LP Shares: ${ethers.formatEther(lpSharesAfterRepay)} (should be same)`);
        console.log(`  Share Price: ${ethers.formatEther(sharePriceAfterRepay)} (should be higher)`);
        console.log(`  NAV: ${ethers.formatEther(navAfterRepay)} (should be higher)`);
        console.log(`  Underlying Value: ${ethers.formatEther(underlyingValueAfterRepay)} (should be higher)`);
        
        // LP shares should still be the same
        expect(lpSharesAfterRepay).to.equal(lpSharesAfterDeposit);
        
        // Share price should be higher than initial (interest earned)
        expect(sharePriceAfterRepay).to.be.gt(sharePriceAfterDeposit);
        
        // Underlying value should be higher (LP earned yield)
        expect(underlyingValueAfterRepay).to.be.gt(underlyingValueAfterDeposit);
        
        // Calculate yield
        const yieldEarned = underlyingValueAfterRepay - underlyingValueAfterDeposit;
        const yieldPercent = (yieldEarned * 10000n) / underlyingValueAfterDeposit;
        
        console.log(`\n✅ LP Yield Summary:`);
        console.log(`  Initial Deposit: ${ethers.formatEther(underlyingValueAfterDeposit)}`);
        console.log(`  Current Value: ${ethers.formatEther(underlyingValueAfterRepay)}`);
        console.log(`  Yield Earned: ${ethers.formatEther(yieldEarned)}`);
        console.log(`  Yield %: ${Number(yieldPercent) / 100}%`);
        
        // Verify yield is positive
        expect(yieldEarned).to.be.gt(0);
        
        console.log("\n✅ Demo completed successfully!");
    });
});


