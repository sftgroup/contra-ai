// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Test USDC — Mintable test token for Sepolia simulation.
contract TestUSDC is ERC20, Ownable {
    constructor() ERC20("Test USDC", "tUSDC") Ownable(msg.sender) {}

    /// @notice Mint tUSDC to any address. Decimals = 6 (matches real USDC).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
