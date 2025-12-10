// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./InvoiceRegistry.sol";

contract SettlementRouter is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    InvoiceRegistry public registry;

    struct SettlementRule {
        bytes32 ruleId;
        bytes32 invoiceId;
        address payer;
        address[] recipients;
        uint256[] bpsSplit;
        address currency;
        bool active;
    }

    mapping(bytes32 => SettlementRule) private _rules;

    event SettlementRuleCreated(
        bytes32 indexed ruleId,
        bytes32 indexed invoiceId,
        address payer,
        address[] recipients,
        uint256[] bpsSplit
    );
    event SettlementExecuted(
        bytes32 indexed ruleId,
        bytes32 indexed invoiceId,
        uint256 grossAmount,
        address payer
    );

    constructor(address registry_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        registry = InvoiceRegistry(registry_);
    }

    function createRule(
        bytes32 invoiceId,
        address payer,
        address[] calldata recipients,
        uint256[] calldata bpsSplit,
        address currency
    ) external returns (bytes32 ruleId) {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(OPERATOR_ROLE, msg.sender),
            "SettlementRouter: missing role"
        );
        require(recipients.length == bpsSplit.length, "SettlementRouter: length mismatch");
        require(registry.isRegistered(invoiceId), "SettlementRouter: invoice not found");

        uint256 totalBps;
        for (uint256 i = 0; i < bpsSplit.length; i++) {
            totalBps += bpsSplit[i];
        }
        require(totalBps == 10_000, "SettlementRouter: bps sum != 100%");

        ruleId = keccak256(abi.encodePacked(invoiceId, payer, block.timestamp, recipients.length));

        _rules[ruleId] = SettlementRule({
            ruleId: ruleId,
            invoiceId: invoiceId,
            payer: payer,
            recipients: recipients,
            bpsSplit: bpsSplit,
            currency: currency,
            active: true
        });

        emit SettlementRuleCreated(ruleId, invoiceId, payer, recipients, bpsSplit);
    }

    function deactivateRule(bytes32 ruleId) external onlyRole(ADMIN_ROLE) {
        _rules[ruleId].active = false;
    }

    function executeSettlement(
        bytes32 ruleId,
        uint256 grossAmount
    ) external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(OPERATOR_ROLE, msg.sender),
            "SettlementRouter: missing role"
        );
        SettlementRule memory rule = _rules[ruleId];
        require(rule.active, "SettlementRouter: rule not active");
        require(grossAmount > 0, "SettlementRouter: zero amount");

        IERC20 token = IERC20(rule.currency);

        for (uint256 i = 0; i < rule.recipients.length; i++) {
            uint256 share = (grossAmount * rule.bpsSplit[i]) / 10_000;
            if (share > 0) {
                // Assuming caller (operator) has approved this contract, OR operator sends funds directly
                // Requirement said "transferFrom(msg.sender...)"
                require(
                    token.transferFrom(msg.sender, rule.recipients[i], share),
                    "SettlementRouter: transfer failed"
                );
            }
        }

        emit SettlementExecuted(ruleId, rule.invoiceId, grossAmount, msg.sender);
    }

    function getRule(bytes32 ruleId) external view returns (SettlementRule memory) {
        return _rules[ruleId];
    }
}
