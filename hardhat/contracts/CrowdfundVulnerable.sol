// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CrowdfundVulnerable {
    address public owner;
    uint256 public goal;
    uint256 public deadline;
    uint256 public totalRaised;

    mapping(address => uint256) public contributions;
    address[] public contributors;
    mapping(address => bool) private isContributor;

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

        if (!isContributor[msg.sender]) {
            contributors.push(msg.sender);
            isContributor[msg.sender] = true;
        }

        emit Contributed(msg.sender, msg.value);
    }

    // Intentionally vulnerable refund flow (for reentrancy demo)
    function requestRefund() public {
        require(block.timestamp < deadline, "Too late");
        uint256 amount = contributions[msg.sender];
        require(amount > 0, "Nothing to refund");

        // State update happens AFTER sending funds
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Refund failed");

        // State update happens AFTER sending → reentrancy possible
        contributions[msg.sender] = 0;
        totalRaised -= amount;

        emit Refunded(msg.sender, amount);
    }

    
    function refund() external {
        requestRefund();
    }

    
    function withdraw() external {
        require(msg.sender == owner, "Not owner");
        
        uint256 bal = address(this).balance;
        (bool ok, ) = payable(owner).call{value: bal}("");
        require(ok, "Owner withdraw failed");

        emit Withdrawn(msg.sender, bal);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Vulnerable bulk refund flow (susceptible to DoS via failing receiver)
    function refundAll() external {
        require(block.timestamp >= deadline, "Campaign still active");

        for (uint256 i = 0; i < contributors.length; i++) {
            address contributor = contributors[i];
            uint256 amount = contributions[contributor];

            if (amount > 0) {
                // Using transfer (2300 gas) + no error handling: any revert blocks the loop
                payable(contributor).transfer(amount);
                contributions[contributor] = 0;
                totalRaised -= amount;
            }
        }
    }

    function getContributorsCount() external view returns (uint256) {
        return contributors.length;
    }
}
