// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./TifaTypes.sol";
import "./InvoiceToken.sol";

contract InvoiceRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant TOKEN_CONTRACT_ROLE = keccak256("TOKEN_CONTRACT_ROLE");

    InvoiceToken public invoiceToken;

    mapping(bytes32 => bool) private _registered;
    mapping(bytes32 => uint256) private _invoiceToTokenId;
    mapping(bytes32 => uint256) private _cumulativePaid;
    mapping(bytes32 => bool) private _isFinanced;
    mapping(bytes32 => InvoiceStatus) private _status;

    event InvoiceRegistered(
        bytes32 indexed invoiceId,
        uint256 indexed tokenId,
        address issuer,
        address debtor
    );
    event InvoiceLifecycleUpdated(
        bytes32 indexed invoiceId,
        InvoiceStatus oldStatus,
        InvoiceStatus newStatus,
        uint256 blockTimestamp
    );
    event PaymentRecorded(
        bytes32 indexed invoiceId,
        uint256 amount,
        uint256 cumulativePaid,
        uint256 blockTimestamp
    );

    constructor(address invoiceToken_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        invoiceToken = InvoiceToken(invoiceToken_);
    }

    function registerInvoice(
        bytes32 invoiceId,
        uint256 tokenId,
        address issuer,
        address debtor
    ) external {
        require(
            hasRole(TOKEN_CONTRACT_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender),
            "InvoiceRegistry: missing role"
        );
        require(!_registered[invoiceId], "InvoiceRegistry: already registered");

        _registered[invoiceId] = true;
        _invoiceToTokenId[invoiceId] = tokenId;
        // Sync initial status
        _status[invoiceId] = invoiceToken.statusOf(invoiceId);

        emit InvoiceRegistered(invoiceId, tokenId, issuer, debtor);
    }

    function setStatus(bytes32 invoiceId, InvoiceStatus newStatus) external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(AGENT_ROLE, msg.sender),
            "InvoiceRegistry: missing role"
        );
        require(_registered[invoiceId], "InvoiceRegistry: not registered");

        InvoiceStatus oldStatus = _status[invoiceId];
        _status[invoiceId] = newStatus;
        
        // Push update to token as well logic could be here if registry manages token
        // For now user asked to call token.updateStatus
        invoiceToken.updateStatus(invoiceId, newStatus);

        emit InvoiceLifecycleUpdated(invoiceId, oldStatus, newStatus, block.timestamp);
    }

    function recordPayment(bytes32 invoiceId, uint256 amount) external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(AGENT_ROLE, msg.sender),
            "InvoiceRegistry: missing role"
        );
        require(_registered[invoiceId], "InvoiceRegistry: not registered");
        require(amount > 0, "InvoiceRegistry: zero amount");

        _cumulativePaid[invoiceId] += amount;

        emit PaymentRecorded(invoiceId, amount, _cumulativePaid[invoiceId], block.timestamp);
    }

    function setFinanced(bytes32 invoiceId, bool isFinanced_) external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(AGENT_ROLE, msg.sender),
            "InvoiceRegistry: missing role"
        );
        require(_registered[invoiceId], "InvoiceRegistry: not registered");
        _isFinanced[invoiceId] = isFinanced_;
    }

    // Views

    function isRegistered(bytes32 invoiceId) external view returns (bool) {
        return _registered[invoiceId];
    }

    function getStatus(bytes32 invoiceId) external view returns (InvoiceStatus) {
        return _status[invoiceId];
    }

    function getTokenId(bytes32 invoiceId) external view returns (uint256) {
        return _invoiceToTokenId[invoiceId];
    }

    function getCumulativePaid(bytes32 invoiceId) external view returns (uint256) {
        return _cumulativePaid[invoiceId];
    }

    function getInvoiceSummary(bytes32 invoiceId)
        external
        view
        returns (
            InvoiceCoreData memory data,
            InvoiceStatus status,
            uint256 cumulativePaid,
            bool isFinanced
        )
    {
        require(_registered[invoiceId], "InvoiceRegistry: not registered");
        (data, , , ) = invoiceToken.getInvoiceDataById(invoiceId);
        status = _status[invoiceId];
        cumulativePaid = _cumulativePaid[invoiceId];
        isFinanced = _isFinanced[invoiceId];
    }
}
