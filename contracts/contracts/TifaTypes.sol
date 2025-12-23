// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

enum InvoiceStatus {
    NONE,
    ISSUED,
    TOKENIZED,
    FINANCED,
    PARTIALLY_PAID,
    PAID,
    DEFAULTED
}

enum RecourseMode {
    RECOURSE,
    NON_RECOURSE
}

enum DefaultResolution {
    NONE,
    RECOVERED,
    WRITTEN_DOWN,
    RECOURSE_CLAIMED
}

struct InvoiceCoreData {
    bytes32 invoiceId;
    address issuer;
    address debtor;
    uint256 amount;
    uint256 dueDate;
    address currency;
}
