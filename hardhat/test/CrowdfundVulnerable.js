import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";
import { expect } from "chai";
import hardhat from "hardhat";

const { ethers } = hardhat;

async function deployCrowdfundFixture() {
  const [deployer, honest1, honest2, attacker1, attacker2] =
    await ethers.getSigners();

  const Crowdfund = await ethers.getContractFactory("CrowdfundVulnerable");
  const crowdfund = await Crowdfund.deploy(100, 60);

  const RefundAttacker = await ethers.getContractFactory("RefundAttacker");
  const refundAttacker = await RefundAttacker.connect(attacker1).deploy();

  const Attack2 = await ethers.getContractFactory("Attack2DoSAttacker");
  const attack2 = await Attack2.connect(attacker2).deploy(
    attacker2.address
  );

  return {
    crowdfund,
    refundAttacker,
    attack2,
    deployer,
    honest1,
    honest2,
    attacker1,
    attacker2,
  };
}

describe("CrowdfundVulnerable bulk refunds", function () {
  it("allows refundAll when only EOAs contributed", async function () {
    const { crowdfund, honest1, honest2 } = await loadFixture(
      deployCrowdfundFixture
    );

    await crowdfund.connect(honest1).contribute({ value: ethers.parseEther("1") });
    await crowdfund.connect(honest2).contribute({ value: ethers.parseEther("2") });

    await expect(crowdfund.refundAll()).to.not.be.reverted;

    expect(await crowdfund.contributions(honest1.address)).to.equal(0);
    expect(await crowdfund.contributions(honest2.address)).to.equal(0);
    expect(await crowdfund.totalRaised()).to.equal(0);
    expect(await ethers.provider.getBalance(crowdfund.target)).to.equal(0);
  });

  it("reverts refundAll when the DoS attacker contract is a contributor", async function () {
    const { crowdfund, honest1, attack2, attacker2 } = await loadFixture(
      deployCrowdfundFixture
    );

    await crowdfund.connect(honest1).contribute({ value: ethers.parseEther("1") });

    await attack2
      .connect(attacker2)
      .fundAttack2({ value: ethers.parseEther("0.2") });
    await attack2
      .connect(attacker2)
      .joinCrowdfund(crowdfund.target, ethers.parseEther("0.1"));

    await expect(crowdfund.refundAll()).to.be.revertedWith(
      "Refund blocked by contributor"
    );

    expect(await crowdfund.contributions(attack2.target)).to.equal(
      ethers.parseEther("0.1")
    );
    expect(await crowdfund.contributions(honest1.address)).to.equal(
      ethers.parseEther("1")
    );
  });
});

describe("CrowdfundVulnerable – Attack 1 reentrancy", function () {
  it("still allows the RefundAttacker to drain funds", async function () {
    const { crowdfund, refundAttacker, honest1, attacker1 } = await loadFixture(
      deployCrowdfundFixture
    );

    await crowdfund.connect(honest1).contribute({ value: ethers.parseEther("5") });

    await refundAttacker
      .connect(attacker1)
      .fundAttacker({ value: ethers.parseEther("1") });
    await refundAttacker
      .connect(attacker1)
      .contributeFromContract(crowdfund.target, ethers.parseEther("1"));

    const crowdfundBalanceBefore = await ethers.provider.getBalance(
      crowdfund.target
    );

    await expect(
      refundAttacker
        .connect(attacker1)
        .runAttack(crowdfund.target, ethers.parseEther("1"))
    ).to.not.be.reverted;

    const crowdfundBalanceAfter = await ethers.provider.getBalance(
      crowdfund.target
    );

    expect(crowdfundBalanceAfter).to.equal(0);
    expect(await crowdfund.totalRaised()).to.equal(0);
    expect(await crowdfund.contributions(refundAttacker.target)).to.equal(0);
    expect(await ethers.provider.getBalance(refundAttacker.target)).to.be.gte(
      crowdfundBalanceBefore
    );
  });
});