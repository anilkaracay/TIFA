// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./TifaTypes.sol";
import "./InvoiceToken.sol";
import "./InvoiceRegistry.sol";
import "./LPShareToken.sol";
import "./WadMath.sol";

contract FinancingPool is AccessControl, ReentrancyGuard, IERC721Receiver {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    InvoiceToken public invoiceToken;
    InvoiceRegistry public registry;
    IERC20 public liquidityToken;
    LPShareToken public lpToken;

    struct CollateralPosition {
        bytes32 invoiceId;
        uint256 tokenId;
        address company;
        uint256 maxCreditLine;
        uint256 usedCredit;        // Principal outstanding
        uint256 interestAccrued;   // Interest accrued but not yet paid
        uint256 lastAccrualTs;     // Timestamp of last interest accrual
        uint256 ltvBps;
        RecourseMode recourseMode; // RECOURSE or NON_RECOURSE
        uint256 dueDate;           // Invoice due date
        uint256 graceEndsAt;        // Timestamp when grace period ends (0 if not started)
        uint256 defaultDeclaredAt;  // Timestamp when default was declared (0 if not defaulted)
        bool isInDefault;           // Whether position is in default
        DefaultResolution resolution; // Resolution status
        bool liquidated;
        bool exists;
    }

    mapping(bytes32 => CollateralPosition) private _positions;

    uint256 public defaultLtvBps;
    
    // LP Pool Accounting
    uint256 public totalLiquidity;           // Total LP deposits (cash balance)
    uint256 public totalBorrowed;             // Total principal outstanding (alias for totalPrincipalOutstanding)
    uint256 public totalPrincipalOutstanding; // Total principal outstanding
    uint256 public totalInterestAccrued;      // Total interest accrued but not yet paid
    uint256 public totalLosses;               // Realized losses from defaults
    uint256 public lpLosses;                   // Losses absorbed by LPs (excludes reserve-absorbed)
    uint256 public protocolFeesAccrued;        // Protocol fees accumulated
    uint256 public reserveBalance;           // First-loss buffer / reserves
    uint256 public reserveTargetBps;          // Reserve target as basis points of NAV (e.g., 500 = 5%)
    uint256 public maxUtilizationBps;         // Maximum utilization (e.g., 8000 = 80%)
    
    // Risk Model Parameters
    uint256 public gracePeriodSeconds;         // Grace period after due date (e.g., 7 days)
    uint256 public recoveryWindowSeconds;     // Recovery window after default (e.g., 30 days)
    uint256 public writeDownBps;              // Write-down percentage (e.g., 10000 = 100%)
    uint256 public maxLtvRecourseBps;         // Max LTV for recourse (e.g., 8000 = 80%)
    uint256 public maxLtvNonRecourseBps;      // Max LTV for non-recourse (e.g., 6000 = 60%)
    
    // Interest & Fee Parameters
    uint256 public borrowAprWad;              // Borrow APR in WAD (e.g., 0.15e18 = 15%)
    uint256 public protocolFeeBps;            // Protocol fee in basis points (e.g., 1000 = 10%)
    
    // Pool start time for APR calculation
    uint256 public poolStartTime;

    event CollateralLocked(
        bytes32 indexed invoiceId,
        uint256 indexed tokenId,
        address indexed company,
        uint256 creditLine,
        uint256 ltvBps
    );
    event CreditDrawn(
        bytes32 indexed invoiceId,
        uint256 amount,
        address to
    );
    event CreditRepaid(
        bytes32 indexed invoiceId,
        uint256 amount,
        uint256 remainingDebt
    );
    event CollateralReleased(
        bytes32 indexed invoiceId,
        uint256 indexed tokenId,
        address company
    );
    event CollateralLiquidated(
        bytes32 indexed invoiceId,
        uint256 indexed tokenId,
        uint256 recoveredAmount
    );
    event LiquidityDeposited(
        address indexed lp,
        uint256 amount,
        uint256 lpSharesMinted
    );
    event LiquidityWithdrawn(
        address indexed lp,
        uint256 lpSharesBurned,
        uint256 amount
    );
    event InterestAccrued(
        bytes32 indexed invoiceId,
        uint256 interestDelta,
        uint256 totalInterestAccrued
    );
    event InterestPaid(
        bytes32 indexed invoiceId,
        uint256 interestPaid,
        uint256 protocolFee,
        uint256 lpInterest
    );
    event SharePriceUpdated(
        uint256 nav,
        uint256 sharePriceWad
    );
    event ProtocolFeesWithdrawn(
        address indexed to,
        uint256 amount
    );
    event GraceStarted(
        bytes32 indexed invoiceId,
        uint256 dueDate,
        uint256 graceEndsAt
    );
    event DefaultDeclared(
        bytes32 indexed invoiceId,
        RecourseMode mode,
        uint256 principal,
        uint256 interest,
        uint256 timestamp
    );
    event RecoursePaid(
        bytes32 indexed invoiceId,
        address indexed issuer,
        uint256 amount,
        bytes32 txHash
    );
    event LossWrittenDown(
        bytes32 indexed invoiceId,
        uint256 lossAmount,
        uint256 reserveUsed,
        uint256 lpLoss
    );
    event ReserveFunded(
        uint256 amount,
        uint256 newBalance
    );
    event ReserveTargetUpdated(
        uint256 bps
    );
    event PositionRecourseModeSet(
        bytes32 indexed invoiceId,
        RecourseMode mode
    );

    constructor(
        address invoiceToken_,
        address registry_,
        address liquidityToken_,
        address lpToken_,
        uint256 defaultLtvBps_,
        uint256 maxUtilizationBps_,
        uint256 borrowAprWad_,
        uint256 protocolFeeBps_
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        invoiceToken = InvoiceToken(invoiceToken_);
        registry = InvoiceRegistry(registry_);
        liquidityToken = IERC20(liquidityToken_);
        lpToken = LPShareToken(lpToken_);
        defaultLtvBps = defaultLtvBps_;
        maxUtilizationBps = maxUtilizationBps_;
        borrowAprWad = borrowAprWad_;
        protocolFeeBps = protocolFeeBps_;
        poolStartTime = block.timestamp;
        
        // Risk Model Defaults
        gracePeriodSeconds = 7 days;
        recoveryWindowSeconds = 30 days;
        writeDownBps = 10000; // 100%
        maxLtvRecourseBps = 8000; // 80%
        maxLtvNonRecourseBps = 6000; // 60%
        reserveTargetBps = 500; // 5% of NAV
        
        // Note: LP token roles must be granted to this pool address after deployment
        // This is done in the deployment script
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function lockCollateral(
        bytes32 invoiceId,
        uint256 tokenId,
        address company
    ) external {
        // Allow anyone to lock IF they own the token
        require(invoiceToken.ownerOf(tokenId) == msg.sender, "FinancingPool: not owner");
        
        // Transfer to pool
        invoiceToken.safeTransferFrom(msg.sender, address(this), tokenId);

        (InvoiceCoreData memory data, , , ) = invoiceToken.getInvoiceDataById(invoiceId);
        
        uint256 maxCreditLine = (data.amount * defaultLtvBps) / 10_000;

        _positions[invoiceId] = CollateralPosition({
            invoiceId: invoiceId,
            tokenId: tokenId,
            company: company,
            maxCreditLine: maxCreditLine,
            usedCredit: 0,
            interestAccrued: 0,
            lastAccrualTs: 0,
            ltvBps: defaultLtvBps,
            recourseMode: RecourseMode.NON_RECOURSE,
            dueDate: data.dueDate,
            graceEndsAt: 0,
            defaultDeclaredAt: 0,
            isInDefault: false,
            resolution: DefaultResolution.NONE,
            liquidated: false,
            exists: true
        });

        emit CollateralLocked(invoiceId, tokenId, company, maxCreditLine, defaultLtvBps);
    }

    function drawCredit(
        bytes32 invoiceId,
        uint256 amount,
        address to
    ) external nonReentrant {
        // require(
        //     hasRole(ADMIN_ROLE, msg.sender) || hasRole(OPERATOR_ROLE, msg.sender),
        //     "FinancingPool: missing role"
        // );
        require(_positions[invoiceId].exists, "FinancingPool: not found");
        require(!_positions[invoiceId].liquidated, "FinancingPool: liquidated");
        
        CollateralPosition storage pos = _positions[invoiceId];
        require(pos.company == msg.sender, "FinancingPool: not company");
        require(pos.usedCredit + amount <= pos.maxCreditLine, "FinancingPool: credit limit exceeded");
        
        // Check available liquidity (respect LP constraints)
        uint256 available = availableLiquidity();
        require(amount <= available, "FinancingPool: insufficient liquidity");

        pos.usedCredit += amount;
        pos.lastAccrualTs = block.timestamp; // Start accrual from now
        totalBorrowed += amount;
        totalPrincipalOutstanding += amount;
        require(liquidityToken.transfer(to, amount), "FinancingPool: transfer failed");

        emit CreditDrawn(invoiceId, amount, to);
    }

    function repayCredit(
        bytes32 invoiceId,
        uint256 amount
    ) external nonReentrant {
        require(_positions[invoiceId].exists, "FinancingPool: not found");
        require(!_positions[invoiceId].liquidated, "FinancingPool: liquidated");
        require(amount > 0, "FinancingPool: zero amount");

        CollateralPosition storage pos = _positions[invoiceId];
        
        // Accrue interest first
        _accrueInterest(invoiceId);
        
        uint256 totalDebt = pos.usedCredit + pos.interestAccrued;
        uint256 actualAmount = amount > totalDebt ? totalDebt : amount;
        
        require(
            liquidityToken.transferFrom(msg.sender, address(this), actualAmount),
            "FinancingPool: transfer failed"
        );

        // Apply repayment: interest first, then principal
        uint256 interestPaid = actualAmount > pos.interestAccrued ? pos.interestAccrued : actualAmount;
        uint256 principalPaid = actualAmount - interestPaid;
        
        // Update interest
        if (interestPaid > 0) {
            pos.interestAccrued -= interestPaid;
            totalInterestAccrued -= interestPaid;
            
            // Split protocol fee
            uint256 protocolFee = WadMath.bpsMul(interestPaid, protocolFeeBps);
            uint256 lpInterest = interestPaid - protocolFee;
            protocolFeesAccrued += protocolFee;
            
            emit InterestPaid(invoiceId, interestPaid, protocolFee, lpInterest);
        }
        
        // Update principal
        if (principalPaid > 0) {
            pos.usedCredit -= principalPaid;
            totalBorrowed -= principalPaid;
            totalPrincipalOutstanding -= principalPaid;
        }
        
        // Update last accrual timestamp
        if (pos.usedCredit > 0) {
            pos.lastAccrualTs = block.timestamp;
        } else {
            pos.lastAccrualTs = 0; // No debt, no accrual
        }

        emit CreditRepaid(invoiceId, actualAmount, pos.usedCredit);
    }

    function releaseCollateral(bytes32 invoiceId) external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(OPERATOR_ROLE, msg.sender),
            "FinancingPool: missing role"
        );
        CollateralPosition storage pos = _positions[invoiceId];
        require(pos.exists, "FinancingPool: not found");
        require(!pos.liquidated, "FinancingPool: liquidated");
        require(pos.usedCredit == 0 && pos.interestAccrued == 0, "FinancingPool: debt remaining");

        uint256 tokenId = pos.tokenId;
        address company = pos.company;
        
        delete _positions[invoiceId]; // Remove position

        invoiceToken.safeTransferFrom(address(this), company, tokenId);

        emit CollateralReleased(invoiceId, tokenId, company);
    }

    function liquidateCollateral(bytes32 invoiceId) external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(OPERATOR_ROLE, msg.sender),
            "FinancingPool: missing role"
        );
        CollateralPosition storage pos = _positions[invoiceId];
        require(pos.exists, "FinancingPool: not found");
        
        pos.liquidated = true;
        // Placeholder for recovered amount logic
        uint256 recoveredAmount = 0;

        emit CollateralLiquidated(invoiceId, pos.tokenId, recoveredAmount);
    }

    function getPosition(bytes32 invoiceId) external view returns (CollateralPosition memory) {
        return _positions[invoiceId];
    }

    function isCollateralized(bytes32 invoiceId) external view returns (bool) {
        return _positions[invoiceId].exists;
    }

    /**
     * @dev Recovery function: If NFT is already in Pool but position doesn't exist,
     * this function can create the position. Only callable by the company address.
     * This handles edge cases where NFT was transferred but lockCollateral failed.
     */
    function recoverLockCollateral(
        bytes32 invoiceId,
        uint256 tokenId,
        address company
    ) external {
        // Only company can recover their own position
        require(msg.sender == company, "FinancingPool: not company");
        
        // Verify NFT is actually owned by Pool
        require(invoiceToken.ownerOf(tokenId) == address(this), "FinancingPool: NFT not in pool");
        
        // Verify position doesn't already exist
        require(!_positions[invoiceId].exists, "FinancingPool: position already exists");

        // Get invoice data
        (InvoiceCoreData memory data, , , ) = invoiceToken.getInvoiceDataById(invoiceId);
        
        // Verify invoiceId matches
        require(data.invoiceId == invoiceId, "FinancingPool: invoiceId mismatch");
        
        uint256 maxCreditLine = (data.amount * defaultLtvBps) / 10_000;

        // Create position
        _positions[invoiceId] = CollateralPosition({
            invoiceId: invoiceId,
            tokenId: tokenId,
            company: company,
            maxCreditLine: maxCreditLine,
            usedCredit: 0,
            interestAccrued: 0,
            lastAccrualTs: 0,
            ltvBps: defaultLtvBps,
            recourseMode: RecourseMode.NON_RECOURSE,
            dueDate: data.dueDate,
            graceEndsAt: 0,
            defaultDeclaredAt: 0,
            isInDefault: false,
            resolution: DefaultResolution.NONE,
            liquidated: false,
            exists: true
        });

        emit CollateralLocked(invoiceId, tokenId, company, maxCreditLine, defaultLtvBps);
    }

    // ============ LP FUNCTIONS ============

    /**
     * @notice Deposit liquidity into the pool and receive LP shares
     * @param amount Amount of liquidityToken to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "FinancingPool: zero amount");
        
        // Transfer tokens from LP to pool
        require(
            liquidityToken.transferFrom(msg.sender, address(this), amount),
            "FinancingPool: transfer failed"
        );

        // Calculate LP shares to mint based on current NAV
        uint256 lpShares = calculateLPSharesForDeposit(amount);
        
        // Update pool state
        totalLiquidity += amount;
        
        // Mint LP shares
        lpToken.mint(msg.sender, lpShares);

        emit LiquidityDeposited(msg.sender, amount, lpShares);
    }

    /**
     * @notice Withdraw liquidity from the pool by burning LP shares
     * @param lpShares Amount of LP shares to burn
     */
    function withdraw(uint256 lpShares) external nonReentrant {
        require(lpShares > 0, "FinancingPool: zero shares");
        
        // Check utilization constraint
        uint256 currentUtilization = utilization();
        require(
            currentUtilization < maxUtilizationBps,
            "FinancingPool: utilization too high"
        );

        // Calculate withdrawal amount based on current NAV
        uint256 withdrawalAmount = calculateWithdrawalAmount(lpShares);
        
        // Check pool has enough liquidity
        require(
            withdrawalAmount <= availableLiquidity(),
            "FinancingPool: insufficient liquidity for withdrawal"
        );

        // Update pool state
        totalLiquidity -= withdrawalAmount;
        
        // Burn LP shares
        lpToken.burn(msg.sender, lpShares);
        
        // Transfer tokens back to LP
        require(
            liquidityToken.transfer(msg.sender, withdrawalAmount),
            "FinancingPool: transfer failed"
        );

        emit LiquidityWithdrawn(msg.sender, lpShares, withdrawalAmount);
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Calculate available liquidity for lending
     * @return Available liquidity = totalLiquidity - totalBorrowed
     */
    function availableLiquidity() public view returns (uint256) {
        uint256 balance = liquidityToken.balanceOf(address(this));
        uint256 available = totalLiquidity > totalBorrowed 
            ? totalLiquidity - totalBorrowed 
            : 0;
        // Return minimum of balance and calculated available
        return balance < available ? balance : available;
    }

    /**
     * @notice Calculate current pool utilization (borrowed / total liquidity)
     * @return Utilization in basis points (e.g., 7500 = 75%)
     */
    function utilization() public view returns (uint256) {
        if (totalLiquidity == 0) return 0;
        return (totalBorrowed * 10_000) / totalLiquidity;
    }

    /**
     * @notice Calculate Net Asset Value (NAV) of the pool
     * @return NAV = cash + principalOutstanding + interestAccrued - losses - protocolFeesAccrued
     */
    function getNAV() public view returns (uint256) {
        // NAV = cashBalance + totalPrincipalOutstanding + totalInterestAccrued - lpLosses - protocolFeesAccrued
        // Note: Reserve-absorbed losses don't reduce LP NAV
        uint256 cashBalance = liquidityToken.balanceOf(address(this));
        uint256 navValue = cashBalance + totalPrincipalOutstanding + totalInterestAccrued;
        
        if (lpLosses > navValue) {
            return 0; // NAV cannot be negative
        }
        navValue -= lpLosses;
        
        if (protocolFeesAccrued > navValue) {
            return 0; // NAV cannot be negative
        }
        navValue -= protocolFeesAccrued;
        
        return navValue;
    }
    
    /**
     * @notice Alias for getNAV() for consistency
     */
    function nav() public view returns (uint256) {
        return getNAV();
    }

    /**
     * @notice Calculate LP share price (NAV / total LP shares) in WAD
     * @return sharePriceWad Price per LP share in WAD (1e18 = 1.0)
     */
    function getLPSharePrice() public view returns (uint256) {
        return sharePriceWad();
    }
    
    /**
     * @notice Calculate LP share price in WAD
     * @return sharePriceWad Price per LP share in WAD
     */
    function sharePriceWad() public view returns (uint256) {
        uint256 totalShares = lpToken.totalSupply();
        if (totalShares == 0) {
            return WadMath.WAD; // 1.0 in WAD
        }
        uint256 navValue = getNAV();
        return WadMath.wadDiv(navValue, totalShares);
    }

    /**
     * @notice Calculate LP shares to mint for a given deposit amount
     * @param depositAmount Amount of liquidityToken being deposited
     * @return LP shares to mint
     */
    function calculateLPSharesForDeposit(uint256 depositAmount) public view returns (uint256) {
        uint256 totalShares = lpToken.totalSupply();
        if (totalShares == 0) {
            // First deposit: mint shares 1:1
            return depositAmount;
        }
        
        uint256 priceWad = sharePriceWad();
        // shares = depositAmount * WAD / sharePriceWad
        return WadMath.wadDiv(depositAmount, priceWad);
    }

    /**
     * @notice Calculate withdrawal amount for a given LP share amount
     * @param lpShares Amount of LP shares to burn
     * @return Amount of liquidityToken to withdraw
     */
    function calculateWithdrawalAmount(uint256 lpShares) public view returns (uint256) {
        uint256 totalShares = lpToken.totalSupply();
        require(totalShares > 0, "FinancingPool: no LP shares");
        
        uint256 priceWad = sharePriceWad();
        // withdrawalAmount = lpShares * sharePriceWad / WAD
        return WadMath.wadMul(lpShares, priceWad);
    }

    /**
     * @notice Get LP position for an address
     * @param lp Address of LP
     * @return lpShares Number of LP shares owned
     * @return underlyingValue Value of LP shares in liquidityToken units
     * @return sharePrice Current price per LP share
     */
    function getLPPosition(address lp) external view returns (
        uint256 lpShares,
        uint256 underlyingValue,
        uint256 sharePrice
    ) {
        lpShares = lpToken.balanceOf(lp);
        sharePrice = sharePriceWad();
        underlyingValue = WadMath.wadMul(lpShares, sharePrice);
    }
    
    // ============ INTEREST ACCRUAL ============
    
    /**
     * @notice Accrue interest for a position
     * @param invoiceId Position to accrue interest for
     */
    function _accrueInterest(bytes32 invoiceId) internal {
        CollateralPosition storage pos = _positions[invoiceId];
        
        if (pos.usedCredit == 0 || pos.lastAccrualTs == 0) {
            return; // No debt or not started
        }
        
        uint256 dt = block.timestamp - pos.lastAccrualTs;
        if (dt == 0) {
            return; // No time elapsed
        }
        
        // interestDelta = principal * borrowAprWad * dt / secondsPerYear
        uint256 interestDelta = WadMath.wadMul(
            pos.usedCredit,
            WadMath.wadMul(borrowAprWad, dt * WadMath.WAD / WadMath.SECONDS_PER_YEAR)
        );
        
        pos.interestAccrued += interestDelta;
        totalInterestAccrued += interestDelta;
        pos.lastAccrualTs = block.timestamp;
        
        emit InterestAccrued(invoiceId, interestDelta, totalInterestAccrued);
        
        // Emit share price update
        uint256 navValue = getNAV();
        uint256 priceWad = sharePriceWad();
        emit SharePriceUpdated(navValue, priceWad);
    }
    
    /**
     * @notice Public function to accrue interest for a position (for testing/viewing)
     * @param invoiceId Position to accrue interest for
     */
    function accrueInterest(bytes32 invoiceId) external {
        require(_positions[invoiceId].exists, "FinancingPool: not found");
        _accrueInterest(invoiceId);
    }
    
    // ============ PROTOCOL FEE WITHDRAWAL ============
    
    /**
     * @notice Withdraw protocol fees
     * @param to Address to receive fees
     * @param amount Amount to withdraw
     */
    function withdrawProtocolFees(address to, uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(to != address(0), "FinancingPool: invalid address");
        require(amount > 0, "FinancingPool: zero amount");
        require(amount <= protocolFeesAccrued, "FinancingPool: insufficient fees");
        
        protocolFeesAccrued -= amount;
        require(
            liquidityToken.transfer(to, amount),
            "FinancingPool: transfer failed"
        );
        
        emit ProtocolFeesWithdrawn(to, amount);
    }
    
    // ============ RISK MODEL FUNCTIONS ============
    
    /**
     * @notice Set recourse mode for a position (can only be set before credit is drawn)
     * @param invoiceId Position to set mode for
     * @param mode RECOURSE or NON_RECOURSE
     */
    function setPositionRecourseMode(bytes32 invoiceId, RecourseMode mode) external {
        require(_positions[invoiceId].exists, "FinancingPool: not found");
        CollateralPosition storage pos = _positions[invoiceId];
        require(pos.usedCredit == 0, "FinancingPool: cannot change mode after credit drawn");
        require(
            msg.sender == pos.company || hasRole(ADMIN_ROLE, msg.sender),
            "FinancingPool: not authorized"
        );
        
        pos.recourseMode = mode;
        
        // Adjust max credit line based on mode
        if (mode == RecourseMode.RECOURSE) {
            // Recalculate with higher LTV
            (InvoiceCoreData memory data, , , ) = invoiceToken.getInvoiceDataById(invoiceId);
            uint256 newMaxCreditLine = (data.amount * maxLtvRecourseBps) / 10_000;
            pos.maxCreditLine = newMaxCreditLine;
            pos.ltvBps = maxLtvRecourseBps;
        } else {
            // Recalculate with lower LTV
            (InvoiceCoreData memory data, , , ) = invoiceToken.getInvoiceDataById(invoiceId);
            uint256 newMaxCreditLine = (data.amount * maxLtvNonRecourseBps) / 10_000;
            pos.maxCreditLine = newMaxCreditLine;
            pos.ltvBps = maxLtvNonRecourseBps;
        }
        
        emit PositionRecourseModeSet(invoiceId, mode);
    }
    
    /**
     * @notice Mark position as overdue and start grace period
     * @param invoiceId Position to mark overdue
     */
    function markOverdueAndStartGrace(bytes32 invoiceId) external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(OPERATOR_ROLE, msg.sender),
            "FinancingPool: missing role"
        );
        require(_positions[invoiceId].exists, "FinancingPool: not found");
        CollateralPosition storage pos = _positions[invoiceId];
        require(pos.usedCredit > 0, "FinancingPool: no debt");
        require(block.timestamp >= pos.dueDate, "FinancingPool: not yet due");
        require(pos.graceEndsAt == 0, "FinancingPool: grace already started");
        
        pos.graceEndsAt = block.timestamp + gracePeriodSeconds;
        
        emit GraceStarted(invoiceId, pos.dueDate, pos.graceEndsAt);
    }
    
    /**
     * @notice Declare default (only after grace period)
     * @param invoiceId Position to declare default
     */
    function declareDefault(bytes32 invoiceId) external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(OPERATOR_ROLE, msg.sender),
            "FinancingPool: missing role"
        );
        require(_positions[invoiceId].exists, "FinancingPool: not found");
        CollateralPosition storage pos = _positions[invoiceId];
        require(pos.usedCredit > 0, "FinancingPool: no debt");
        require(pos.graceEndsAt > 0, "FinancingPool: grace not started");
        require(block.timestamp >= pos.graceEndsAt, "FinancingPool: grace period not ended");
        require(!pos.isInDefault, "FinancingPool: already in default");
        
        pos.isInDefault = true;
        pos.defaultDeclaredAt = block.timestamp;
        
        emit DefaultDeclared(
            invoiceId,
            pos.recourseMode,
            pos.usedCredit,
            pos.interestAccrued,
            block.timestamp
        );
    }
    
    /**
     * @notice Pay recourse obligation (for RECOURSE mode)
     * @param invoiceId Position to pay recourse for
     * @param amount Amount to pay
     */
    function payRecourse(bytes32 invoiceId, uint256 amount) external nonReentrant {
        require(_positions[invoiceId].exists, "FinancingPool: not found");
        CollateralPosition storage pos = _positions[invoiceId];
        require(pos.recourseMode == RecourseMode.RECOURSE, "FinancingPool: not recourse");
        require(pos.isInDefault, "FinancingPool: not in default");
        require(msg.sender == pos.company, "FinancingPool: not issuer");
        
        uint256 totalDebt = pos.usedCredit + pos.interestAccrued;
        uint256 actualAmount = amount > totalDebt ? totalDebt : amount;
        
        require(
            liquidityToken.transferFrom(msg.sender, address(this), actualAmount),
            "FinancingPool: transfer failed"
        );
        
        // Apply payment: interest first, then principal
        uint256 interestPaid = actualAmount > pos.interestAccrued ? pos.interestAccrued : actualAmount;
        uint256 principalPaid = actualAmount - interestPaid;
        
        if (interestPaid > 0) {
            pos.interestAccrued -= interestPaid;
            totalInterestAccrued -= interestPaid;
            
            uint256 protocolFee = WadMath.bpsMul(interestPaid, protocolFeeBps);
            uint256 lpInterest = interestPaid - protocolFee;
            protocolFeesAccrued += protocolFee;
            
            emit InterestPaid(invoiceId, interestPaid, protocolFee, lpInterest);
        }
        
        if (principalPaid > 0) {
            pos.usedCredit -= principalPaid;
            totalBorrowed -= principalPaid;
            totalPrincipalOutstanding -= principalPaid;
        }
        
        // If fully paid, resolve default
        if (pos.usedCredit == 0 && pos.interestAccrued == 0) {
            pos.isInDefault = false;
            pos.resolution = DefaultResolution.RECOURSE_CLAIMED;
        }
        
        emit RecoursePaid(invoiceId, msg.sender, actualAmount, bytes32(uint256(uint160(msg.sender))));
        emit CreditRepaid(invoiceId, actualAmount, pos.usedCredit);
    }
    
    /**
     * @notice Resolve default (for NON_RECOURSE after recovery window)
     * @param invoiceId Position to resolve
     * @param resolutionType RECOVERED, WRITTEN_DOWN, or RECOURSE_CLAIMED
     */
    function resolveDefault(bytes32 invoiceId, DefaultResolution resolutionType) external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(OPERATOR_ROLE, msg.sender),
            "FinancingPool: missing role"
        );
        require(_positions[invoiceId].exists, "FinancingPool: not found");
        CollateralPosition storage pos = _positions[invoiceId];
        require(pos.isInDefault, "FinancingPool: not in default");
        require(pos.resolution == DefaultResolution.NONE, "FinancingPool: already resolved");
        
        if (resolutionType == DefaultResolution.WRITTEN_DOWN) {
            require(
                pos.recourseMode == RecourseMode.NON_RECOURSE,
                "FinancingPool: cannot write down recourse"
            );
            require(
                block.timestamp >= pos.defaultDeclaredAt + recoveryWindowSeconds,
                "FinancingPool: recovery window not ended"
            );
            
            // Calculate loss amount
            uint256 lossAmount = (pos.usedCredit * writeDownBps) / 10000;
            _applyLossWaterfall(invoiceId, lossAmount);
        } else if (resolutionType == DefaultResolution.RECOVERED) {
            // Assume full recovery (principal + interest paid off-chain)
            pos.isInDefault = false;
            pos.resolution = DefaultResolution.RECOVERED;
            // Note: Principal/interest should be cleared separately if recovered
        }
        
        pos.resolution = resolutionType;
    }
    
    /**
     * @notice Internal function to apply loss waterfall
     * @param invoiceId Position ID
     * @param lossAmount Loss amount to apply
     */
    function _applyLossWaterfall(bytes32 invoiceId, uint256 lossAmount) internal {
        CollateralPosition storage pos = _positions[invoiceId];
        require(lossAmount <= pos.usedCredit, "FinancingPool: loss exceeds principal");
        
        uint256 reserveUsed = 0;
        uint256 lpLoss = 0;
        
        if (reserveBalance >= lossAmount) {
            // Reserve absorbs entire loss
            reserveBalance -= lossAmount;
            reserveUsed = lossAmount;
            lpLoss = 0;
        } else {
            // Reserve exhausted, remaining hits LP NAV
            reserveUsed = reserveBalance;
            lpLoss = lossAmount - reserveBalance;
            reserveBalance = 0;
        }
        
        // Update position
        pos.usedCredit -= lossAmount;
        totalBorrowed -= lossAmount;
        totalPrincipalOutstanding -= lossAmount;
        totalLosses += lossAmount;
        
        // Update LP losses (only the portion absorbed by LPs)
        if (lpLoss > 0) {
            lpLosses += lpLoss;
            // Emit share price update (NAV will reflect LP loss)
            uint256 navValue = getNAV();
            uint256 priceWad = sharePriceWad();
            emit SharePriceUpdated(navValue, priceWad);
        }
        
        // Set resolution to WRITTEN_DOWN
        pos.resolution = DefaultResolution.WRITTEN_DOWN;
        
        emit LossWrittenDown(invoiceId, lossAmount, reserveUsed, lpLoss);
    }
    
    /**
     * @notice Write down a loss (for defaults) - Updated to use loss waterfall
     * @param invoiceId Position to write down
     * @param lossAmount Amount to write down
     */
    function writeDownLoss(bytes32 invoiceId, uint256 lossAmount) external onlyRole(ADMIN_ROLE) {
        require(_positions[invoiceId].exists, "FinancingPool: not found");
        CollateralPosition storage pos = _positions[invoiceId];
        require(
            pos.recourseMode == RecourseMode.NON_RECOURSE,
            "FinancingPool: use payRecourse for recourse positions"
        );
        
        _applyLossWaterfall(invoiceId, lossAmount);
    }
    
    // ============ RESERVE MANAGEMENT ============
    
    /**
     * @notice Fund reserve
     * @param amount Amount to add to reserve
     */
    function fundReserve(uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(amount > 0, "FinancingPool: zero amount");
        require(
            liquidityToken.transferFrom(msg.sender, address(this), amount),
            "FinancingPool: transfer failed"
        );
        
        reserveBalance += amount;
        emit ReserveFunded(amount, reserveBalance);
    }
    
    /**
     * @notice Set reserve target
     * @param bps Reserve target in basis points
     */
    function setReserveTarget(uint256 bps) external onlyRole(ADMIN_ROLE) {
        require(bps <= 10000, "FinancingPool: invalid bps");
        reserveTargetBps = bps;
        emit ReserveTargetUpdated(bps);
    }
    
    /**
     * @notice Route protocol fees to reserve until target met
     */
    function routeProtocolFeesToReserve() external onlyRole(ADMIN_ROLE) {
        uint256 navValue = getNAV();
        uint256 targetReserve = (navValue * reserveTargetBps) / 10000;
        
        if (reserveBalance < targetReserve && protocolFeesAccrued > 0) {
            uint256 needed = targetReserve - reserveBalance;
            uint256 toRoute = needed > protocolFeesAccrued ? protocolFeesAccrued : needed;
            
            protocolFeesAccrued -= toRoute;
            reserveBalance += toRoute;
            
            emit ReserveFunded(toRoute, reserveBalance);
        }
    }
}
