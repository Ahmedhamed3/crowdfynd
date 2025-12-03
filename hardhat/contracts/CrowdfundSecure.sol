// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CrowdfundSecure
/// @notice A hardened variant of the vulnerable crowdfund used in the demos.
/// It keeps the same external API so the frontend and attacker contracts can
/// switch between vulnerable and secure modes without code changes.
contract CrowdfundSecure {
    address public owner;
    uint256 public goal;
    uint256 public deadline;
    uint256 public totalRaised;

    mapping(address => uint256) public contributions;
    address[] public contributors;
    mapping(address => bool) private isContributor;

    // Simple non-reentrancy guard (avoids pulling in extra dependencies).
    bool private locked;

    event Contributed(address indexed user, uint256 amount);
    event Refunded(address indexed user, uint256 amount);
    event RefundFailed(address indexed user, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);

    modifier nonReentrant() {
        require(!locked, "Reentrancy");
        locked = true;
        _;
        locked = false;
    }

    constructor(uint256 _goalInEther, uint256 _durationMinutes) {
        owner = msg.sender;
        goal = _goalInEther * 1 ether;
        deadline = block.timestamp + (_durationMinutes * 1 minutes);
    }

    function contribute() external payable {
        require(block.timestamp < deadline, "Campaign ended");
        require(msg.value > 0, "Send ETH");

        if (!isContributor[msg.sender]) {
            contributors.push(msg.sender);
            isContributor[msg.sender] = true;
        }

        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;

        emit Contributed(msg.sender, msg.value);
    }

    // Uses checks-effects-interactions + nonReentrant to block reentrancy.
    function requestRefund() public nonReentrant {
        require(block.timestamp < deadline, "Too late");
        uint256 amount = contributions[msg.sender];
        require(amount > 0, "Nothing to refund");

        contributions[msg.sender] = 0;
        totalRaised -= amount;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Refund failed");

        emit Refunded(msg.sender, amount);
    }

    function refund() external {
        requestRefund();
    }

    // Best-effort bulk refund that cannot be fully DoS'ed by a reverting receiver.
    function refundAll() external nonReentrant {
        uint256 length = contributors.length;
        for (uint256 i = 0; i < length; i++) {
            address contributor = contributors[i];
            uint256 amount = contributions[contributor];
            if (amount == 0) continue;

            contributions[contributor] = 0;
            totalRaised -= amount;

            (bool ok, ) = payable(contributor).call{value: amount}("");
            if (!ok) {
                // If a refund fails (e.g., reverting fallback), keep their balance
                // so they can pull it themselves later via requestRefund().
                contributions[contributor] = amount;
                totalRaised += amount;
                emit RefundFailed(contributor, amount);
            } else {
                emit Refunded(contributor, amount);
            }
        }
    }

    function withdraw() external nonReentrant {
        require(msg.sender == owner, "Not owner");

        uint256 bal = address(this).balance;
        require(bal > 0, "Nothing to withdraw");

        (bool ok, ) = payable(owner).call{value: bal}("");
        require(ok, "Owner withdraw failed");

        emit Withdrawn(msg.sender, bal);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getContributorsCount() external view returns (uint256) {
        return contributors.length;
    }

    function getContributors() external view returns (address[] memory) {
        return contributors;
    }

    function getContributionOf(address user) external view returns (uint256) {
        return contributions[user];
    }
}