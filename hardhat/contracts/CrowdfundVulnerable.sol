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

        if (contributions[msg.sender] == 0) {
            contributors.push(msg.sender);
            isContributor[msg.sender] = true;
        }

        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;

        
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
        uint256 length = contributors.length;
        for (uint256 i = 0; i < length; i++) {
            address contributor = contributors[i];
            uint256 amount = contributions[contributor];

            if (amount == 0) continue;

            contributions[contributor] = 0;
            totalRaised -= amount;

            // use call, not transfer, to allow failure detection
            (bool ok, ) = payable(contributor).call{value: amount}("");
            if (!ok) {
                // roll back this contributor's state so logic stays consistent
                contributions[contributor] = amount;
                totalRaised += amount;
                revert("Refund blocked by contributor");
            }
        }
    }

    function getContributorsCount() external view returns (uint256) {
        return contributors.length;
    }
    // Returns the list of all addresses that have ever contributed
    function getContributors() external view returns (address[] memory) {
        return contributors;
    }

    // Helper to read a single user contribution (same as public mapping, but explicit for UI)
    function getContributionOf(address user) external view returns (uint256) {
        return contributions[user];
    }
}
