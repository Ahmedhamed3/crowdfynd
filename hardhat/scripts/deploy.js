// scripts/deploy.js (ESM-compatible for Hardhat v2)

import hardhat from "hardhat";

const { ethers } = hardhat;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts using:", deployer.address);

  // Deploy CrowdfundVulnerable (goal: 100 ETH, duration: 60 minutes)
  const Crowdfund = await ethers.getContractFactory("CrowdfundVulnerable");
  const crowdfund = await Crowdfund.deploy(100, 60);
  await crowdfund.waitForDeployment();

  const crowdfundAddress = await crowdfund.getAddress();
  console.log("CrowdfundVulnerable deployed at:", crowdfundAddress);

  // Deploy RefundAttacker and pass the crowdfund address
  const Attacker = await ethers.getContractFactory("RefundAttacker");
  const attacker = await Attacker.deploy(crowdfundAddress);
  await attacker.waitForDeployment();

  const attackerAddress = await attacker.getAddress();
  console.log("RefundAttacker deployed at:", attackerAddress);

  console.log("\n🚀 Deployment complete!");
  console.log("-----------------------------------");
  console.log("Crowdfund Address:", crowdfundAddress);
  console.log("Attacker Contract Address:", attackerAddress);
  console.log("-----------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
