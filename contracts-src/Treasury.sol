// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Treasury — Auto-forward USDC to beneficiary
/// @notice Receives USDC from ContraNFT.mint() and immediately forwards to beneficiary.
///         autoForward can be disabled for emergency, then manualWithdraw is used.
contract Treasury is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public beneficiary;
    bool public autoForward = true;

    event Deposited(address indexed from, uint256 amount, uint256 timestamp);
    event AutoForwarded(address indexed to, uint256 amount);
    event ManualWithdraw(address indexed to, uint256 amount);
    event EmergencyWithdraw(address indexed to, address token, uint256 amount);
    event BeneficiaryUpdated(address oldBeneficiary, address newBeneficiary);
    event AutoForwardToggled(bool enabled);

    constructor(address _usdc, address _beneficiary) Ownable(msg.sender) {
        require(_usdc != address(0), "zero usdc");
        require(_beneficiary != address(0), "zero beneficiary");
        usdc = IERC20(_usdc);
        beneficiary = _beneficiary;
    }

    /// @notice Called by ContraNFT after transferring USDC to this contract.
    ///         Immediately forwards the USDC to beneficiary when autoForward is on.
    function deposit(uint256 amount) external {
        if (autoForward && amount > 0) {
            usdc.safeTransfer(beneficiary, amount);
            emit AutoForwarded(beneficiary, amount);
        }
        emit Deposited(msg.sender, amount, block.timestamp);
    }

    function manualWithdraw(uint256 amount) external onlyOwner {
        usdc.safeTransfer(beneficiary, amount);
        emit ManualWithdraw(beneficiary, amount);
    }

    /// @notice Emergency withdraw any token to any address. Safety valve.
    function emergencyWithdraw(address _token, address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "zero to");
        IERC20(_token).safeTransfer(_to, _amount);
        emit EmergencyWithdraw(_to, _token, _amount);
    }

    function setBeneficiary(address _newBeneficiary) external onlyOwner {
        require(_newBeneficiary != address(0), "zero beneficiary");
        emit BeneficiaryUpdated(beneficiary, _newBeneficiary);
        beneficiary = _newBeneficiary;
    }

    function setAutoForward(bool _enabled) external onlyOwner {
        autoForward = _enabled;
        emit AutoForwardToggled(_enabled);
    }
}
