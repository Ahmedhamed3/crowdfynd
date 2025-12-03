// scripts/deploy.js (ESM-compatible for Hardhat v2)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import hardhat from "hardhat";

const { ethers } = hardhat;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_ADDRESSES_PATH = path.join(
  __dirname,
  "..",
  "..",
  "frontend",
  "src",
  "contractAddresses.json"
);

function writeAddressesToFrontend(addresses) {
  fs.writeFileSync(
    FRONTEND_ADDRESSES_PATH,
    JSON.stringify(addresses, null, 2)
  );
  console.log("Saved contract addresses to", FRONTEND_ADDRESSES_PATH);
}

async function main() {
  const [deployer, , attacker2Signer] = await ethers.getSigners();
  console.log("Deploying contracts using:", deployer.address);

  // Deploy CrowdfundVulnerable (goal: 100 ETH, duration: 60 minutes)
  const Crowdfund = await ethers.getContractFactory("CrowdfundVulnerable");
  const crowdfund = await Crowdfund.deploy(100, 60);
  await crowdfund.waitForDeployment();

  const crowdfundAddress = await crowdfund.getAddress();
  console.log("CrowdfundVulnerable deployed at:", crowdfundAddress);

  // Deploy RefundAttacker (Attack 1) and pass the crowdfund address
  const Attacker = await ethers.getContractFactory("RefundAttacker");
  const attacker = await Attacker.deploy(crowdfundAddress);
  await attacker.waitForDeployment();

  const attackerAddress = await attacker.getAddress();
  console.log("RefundAttacker deployed at:", attackerAddress);

  // Deploy Attack 2 DoS attacker and pass the crowdfund address
  const Attack2 = await ethers.getContractFactory(
    "Attack2DoSAttacker",
    attacker2Signer
  );

  const attack2 = await Attack2.deploy(
    crowdfund.target,
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
  );
  await attack2.waitForDeployment();

  const attack2Address = await attack2.getAddress();
  console.log("Attack2DoSAttacker deployed at:", attack2Address);

  writeAddressesToFrontend({
    crowdfund: crowdfundAddress,
    attacker: attackerAddress,
    attack2DoSAttacker: attack2Address,
  });

  console.log("\n🚀 Deployment complete!");
  console.log("-----------------------------------");
  console.log("Crowdfund Address:", crowdfundAddress);
  console.log("Attacker Contract Address:", attackerAddress);
  console.log("Attack 2 Contract Address:", attack2Address);
  console.log("-----------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
