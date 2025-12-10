// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./TifaTypes.sol";
import "./InvoiceToken.sol";
import "./InvoiceRegistry.sol";

contract FinancingPool is AccessControl, ReentrancyGuard, IERC721Receiver {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    InvoiceToken public invoiceToken;
    InvoiceRegistry public registry;
    IERC20 public liquidityToken;

    struct CollateralPosition {
        bytes32 invoiceId;
        uint256 tokenId;
        address company;
        uint256 maxCreditLine;
        uint256 usedCredit;
        uint256 ltvBps;
        bool liquidated;
        bool exists;
    }

    mapping(bytes32 => CollateralPosition) private _positions;

    uint256 public defaultLtvBps;

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

    constructor(
        address invoiceToken_,
        address registry_,
        address liquidityToken_,
        uint256 defaultLtvBps_
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        invoiceToken = InvoiceToken(invoiceToken_);
        registry = InvoiceRegistry(registry_);
        liquidityToken = IERC20(liquidityToken_);
        defaultLtvBps = defaultLtvBps_;
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
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(OPERATOR_ROLE, msg.sender),
            "FinancingPool: missing role"
        );
        require(!_positions[invoiceId].exists, "FinancingPool: already exists");
        require(invoiceToken.ownerOf(tokenId) == address(this), "FinancingPool: not collateralized");

        (InvoiceCoreData memory data, , , ) = invoiceToken.getInvoiceDataById(invoiceId);
        
        uint256 maxCreditLine = (data.amount * defaultLtvBps) / 10_000;

        _positions[invoiceId] = CollateralPosition({
            invoiceId: invoiceId,
            tokenId: tokenId,
            company: company,
            maxCreditLine: maxCreditLine,
            usedCredit: 0,
            ltvBps: defaultLtvBps,
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
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(OPERATOR_ROLE, msg.sender),
            "FinancingPool: missing role"
        );
        require(_positions[invoiceId].exists, "FinancingPool: not found");
        require(!_positions[invoiceId].liquidated, "FinancingPool: liquidated");
        
        CollateralPosition storage pos = _positions[invoiceId];
        require(pos.usedCredit + amount <= pos.maxCreditLine, "FinancingPool: credit limit exceeded");
        require(liquidityToken.balanceOf(address(this)) >= amount, "FinancingPool: insufficient liquidity");

        pos.usedCredit += amount;
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
        uint256 actualAmount = amount;
        
        if (amount > pos.usedCredit) {
            actualAmount = pos.usedCredit; // Cap repayment to debt, simplistic
        }

        require(
            liquidityToken.transferFrom(msg.sender, address(this), actualAmount),
            "FinancingPool: transfer failed"
        );

        pos.usedCredit -= actualAmount;

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
        require(pos.usedCredit == 0, "FinancingPool: debt remaining");

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
}
