// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./TifaTypes.sol";

contract InvoiceToken is ERC721, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _tokenIdTracker;

    // invoiceId => tokenId
    mapping(bytes32 => uint256) private _invoiceToTokenId;
    // tokenId => Data
    mapping(uint256 => InvoiceCoreData) private _tokenInvoiceData;
    // invoiceId => Status
    mapping(bytes32 => InvoiceStatus) private _invoiceStatus;
    // invoiceId => Meta URI
    mapping(bytes32 => string) private _invoiceMetaURI;

    event InvoiceMinted(
        bytes32 indexed invoiceId,
        uint256 indexed tokenId,
        address indexed issuer,
        address debtor,
        uint256 amount,
        uint256 dueDate,
        address currency
    );
    event InvoiceStatusUpdated(
        bytes32 indexed invoiceId,
        uint256 indexed tokenId,
        InvoiceStatus oldStatus,
        InvoiceStatus newStatus
    );
    event InvoiceMetaUpdated(
        bytes32 indexed invoiceId,
        uint256 indexed tokenId,
        string oldMetaURI,
        string newMetaURI
    );

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function mintInvoice(
        InvoiceCoreData calldata data,
        string calldata metaURI
    ) external returns (uint256 tokenId) {
        require(data.issuer == msg.sender, "InvoiceToken: issuer mismatch");
        require(_invoiceToTokenId[data.invoiceId] == 0, "InvoiceToken: ID already used");

        _tokenIdTracker += 1;
        tokenId = _tokenIdTracker;

        _safeMint(data.issuer, tokenId);

        _invoiceToTokenId[data.invoiceId] = tokenId;
        _tokenInvoiceData[tokenId] = data;
        _invoiceStatus[data.invoiceId] = InvoiceStatus.ISSUED;
        _invoiceMetaURI[data.invoiceId] = metaURI;

        emit InvoiceMinted(
            data.invoiceId,
            tokenId,
            data.issuer,
            data.debtor,
            data.amount,
            data.dueDate,
            data.currency
        );
        
        return tokenId;
    }

    function updateStatus(bytes32 invoiceId, InvoiceStatus newStatus) external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(MINTER_ROLE, msg.sender),
            "InvoiceToken: missing role"
        );
        require(_invoiceToTokenId[invoiceId] != 0, "InvoiceToken: not found");

        uint256 tokenId = _invoiceToTokenId[invoiceId];
        InvoiceStatus oldStatus = _invoiceStatus[invoiceId];
        _invoiceStatus[invoiceId] = newStatus;

        emit InvoiceStatusUpdated(invoiceId, tokenId, oldStatus, newStatus);
    }

    function updateMetaURI(bytes32 invoiceId, string calldata newMetaURI) external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(MINTER_ROLE, msg.sender),
            "InvoiceToken: missing role"
        );
        require(_invoiceToTokenId[invoiceId] != 0, "InvoiceToken: not found");

        uint256 tokenId = _invoiceToTokenId[invoiceId];
        string memory oldURI = _invoiceMetaURI[invoiceId];
        _invoiceMetaURI[invoiceId] = newMetaURI;

        emit InvoiceMetaUpdated(invoiceId, tokenId, oldURI, newMetaURI);
    }

    // Views

    function getInvoiceDataById(bytes32 invoiceId)
        external
        view
        returns (
            InvoiceCoreData memory data,
            InvoiceStatus status,
            string memory metaURI,
            uint256 tokenId
        )
    {
        tokenId = _invoiceToTokenId[invoiceId];
        require(tokenId != 0, "InvoiceToken: not found");
        data = _tokenInvoiceData[tokenId];
        status = _invoiceStatus[invoiceId];
        metaURI = _invoiceMetaURI[invoiceId];
    }

    function getInvoiceDataByToken(uint256 tokenId)
        external
        view
        returns (
            InvoiceCoreData memory data,
            InvoiceStatus status,
            string memory metaURI,
            bytes32 invoiceId
        )
    {
        require(_ownerOf(tokenId) != address(0), "InvoiceToken: non-existent token");
        data = _tokenInvoiceData[tokenId];
        invoiceId = data.invoiceId;
        status = _invoiceStatus[invoiceId];
        metaURI = _invoiceMetaURI[invoiceId];
    }

    function exists(bytes32 invoiceId) external view returns (bool) {
        return _invoiceToTokenId[invoiceId] != 0;
    }

    function statusOf(bytes32 invoiceId) external view returns (InvoiceStatus) {
        return _invoiceStatus[invoiceId];
    }

    function tokenOfInvoice(bytes32 invoiceId) external view returns (uint256) {
        return _invoiceToTokenId[invoiceId];
    }

    function ownerOfInvoice(bytes32 invoiceId) external view returns (address) {
        uint256 tid = _invoiceToTokenId[invoiceId];
        if (tid == 0) return address(0);
        return ownerOf(tid);
    }
}
