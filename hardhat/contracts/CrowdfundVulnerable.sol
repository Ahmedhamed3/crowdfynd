// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CrowdfundVulnerable {
    address public owner;
    uint256 public goal;
    uint256 public deadline;
    uint256 public totalRaised;

    mapping(address => uint256) public contributions;

    event Contributed(address indexed user, uint256 amount);
    event Refunded(address indexed user, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);

    constructor(uint256 _goalInEther, uint256 _durationMinutes) {
        owner = msg.sender;
        goal = _goalInEther * 1 ether;
        deadline = block.timestamp + (_durationMinutes * 1 minutes);
    }

    function contribute() external payable {
        require(block.timestamp < deadline, "Campaign ended");
        require(msg.value > 0, "Send ETH");

        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;

        emit Contributed(msg.sender, msg.value);
    }

    // ❌ Vulnerable refund
    function requestRefund() public {
        require(block.timestamp < deadline, "Too late");
        uint256 amount = contributions[msg.sender];
        require(amount > 0, "Nothing to refund");

        // Vulnerability: state not updated before sending = reentrancy
        payable(msg.sender).transfer(amount);

        contributions[msg.sender] = 0;
        totalRaised -= amount;

        emit Refunded(msg.sender, amount);
    }

    // Backwards compatibility for older callers
    function refund() external {
        requestRefund();
    }

    // ❌ Vulnerable withdraw (no checks)
    function withdraw() external {
        require(msg.sender == owner, "Not owner");
        
        uint256 amount = address(this).balance;

        payable(owner).transfer(amount);

        emit Withdrawn(msg.sender, amount);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
