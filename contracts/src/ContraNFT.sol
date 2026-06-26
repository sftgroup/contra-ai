// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ITreasury {
    function deposit(uint256 amount) external;
}

/// @title ContraNFT — Founding Shareholder NFT
/// @notice Phase 1: 10,000 USDC mint, 4-chain deployment with adjustable quotas.
///         Funds flow: user → this contract → treasury (auto-forward) → beneficiary.
contract ContraNFT is ERC721, Ownable {
    using SafeERC20 for IERC20;

    // ───── Config (Owner-adjustable) ─────

    /// @notice Payment token (e.g. USDC). Owner can change it any time.
    IERC20 public paymentToken;

    /// @notice Mint price, in paymentToken decimals.
    uint256 public mintPrice;

    /// @notice Maximum tokens that can be minted on this chain.
    ///         Adjustable (both directions), minimum = totalMinted.
    uint256 public maxSupply;

    /// @notice Treasury contract address. USDC is forwarded here immediately after mint.
    address public treasury;

    /// @notice Final beneficiary address — set on Treasury, stored here for reference.
    address public beneficiary;

    // ───── State ─────

    uint256 public totalMinted;
    bool public paused;

    // ───── Events ─────

    event MintEvent(address indexed minter, uint256 indexed tokenId);
    event Paused();
    event Unpaused();
    event MaxSupplyUpdated(uint256 oldMax, uint256 newMax);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event PaymentTokenUpdated(address oldToken, address newToken);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event BeneficiaryUpdated(address oldBeneficiary, address newBeneficiary);

    // ───── Errors ─────

    error SoldOut();
    error InsufficientPayment();
    error TransferFailed();
    error BelowTotalMinted(uint256 requested, uint256 totalMinted);
    error IsPaused();
    error PriceNotSet();

    // ───── Constructor ─────

    /// @param _name NFT collection name (e.g. "Contra AI")
    /// @param _symbol NFT symbol (e.g. "CONTRA")
    /// @param _paymentToken Payment token address (e.g. USDC)
    /// @param _mintPrice Mint price (in _paymentToken decimals, e.g. 10_000 * 1e6 for USDC)
    /// @param _maxSupply Initial max supply for this chain
    /// @param _treasury Treasury contract address
    /// @param _beneficiary Final beneficiary address (set on Treasury, stored here for reference)
    constructor(
        string memory _name,
        string memory _symbol,
        address _paymentToken,
        uint256 _mintPrice,
        uint256 _maxSupply,
        address _treasury,
        address _beneficiary
    ) ERC721(_name, _symbol) Ownable(msg.sender) {
        require(_paymentToken != address(0), "zero token");
        require(_mintPrice > 0, "zero price");
        require(_treasury != address(0), "zero treasury");
        require(_beneficiary != address(0), "zero beneficiary");
        paymentToken = IERC20(_paymentToken);
        mintPrice = _mintPrice;
        maxSupply = _maxSupply;
        treasury = _treasury;
        beneficiary = _beneficiary;
    }

    // ───── Mint ─────

    /// @notice Mint a founding shareholder NFT.
    ///         1. Transfers mintPrice tokens from minter to treasury.
    ///         2. Treasury auto-forwards to beneficiary.
    ///         3. Mints the NFT to the minter.
    function mint() external {
        if (paused) revert IsPaused();
        if (mintPrice == 0) revert PriceNotSet();
        if (totalMinted >= maxSupply) revert SoldOut();

        uint256 tokenId = ++totalMinted;
        IERC20 pay = paymentToken;
        uint256 price = mintPrice;

        // Transfer tokens from minter → treasury
        pay.safeTransferFrom(msg.sender, treasury, price);

        // Notify treasury to auto-forward
        ITreasury(treasury).deposit(price);

        // Mint NFT
        _safeMint(msg.sender, tokenId);

        emit MintEvent(msg.sender, tokenId);
    }

    // ───── Owner: Pause ─────

    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    // ───── Owner: Max Supply ─────

    /// @notice Adjust max supply. Can increase or decrease.
    ///         Only constraint: cannot go below already-minted amount.
    function setMaxSupply(uint256 _newMax) external onlyOwner {
        if (_newMax < totalMinted) revert BelowTotalMinted(_newMax, totalMinted);
        uint256 oldMax = maxSupply;
        maxSupply = _newMax;
        emit MaxSupplyUpdated(oldMax, _newMax);
    }

    // ───── Owner: Payment Token / Price ─────

    /// @notice Change the payment token. Will not affect already-minted NFTs.
    function setPaymentToken(address _newToken) external onlyOwner {
        require(_newToken != address(0), "zero token");
        emit PaymentTokenUpdated(address(paymentToken), _newToken);
        paymentToken = IERC20(_newToken);
    }

    /// @notice Change the mint price. Will not affect already-minted NFTs.
    function setMintPrice(uint256 _newPrice) external onlyOwner {
        emit MintPriceUpdated(mintPrice, _newPrice);
        mintPrice = _newPrice;
    }

    // ───── Owner: Treasury / Beneficiary ─────

    function setTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "zero treasury");
        emit TreasuryUpdated(treasury, _newTreasury);
        treasury = _newTreasury;
    }

    function setBeneficiary(address _newBeneficiary) external onlyOwner {
        require(_newBeneficiary != address(0), "zero beneficiary");
        emit BeneficiaryUpdated(beneficiary, _newBeneficiary);
        beneficiary = _newBeneficiary;
    }
}
