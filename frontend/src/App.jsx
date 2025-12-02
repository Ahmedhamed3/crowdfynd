import { useEffect, useState } from "react";
import { ethers } from "ethers";

// === YOUR DEPLOYED ADDRESSES ===
const CROWDFUND_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
const ATTACKER_ADDRESS  = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

// Minimal ABIs (only the functions we use)
const CROWDFUND_ABI = [
  "function goal() view returns (uint256)",
  "function totalRaised() view returns (uint256)",
  "function getBalance() view returns (uint256)",
  "function contribute() payable",
  "function refund()",
  "function withdraw()"
];

const ATTACKER_ABI = [
  "function fundAndAttack() payable",
  "function withdrawLoot()",
  "function getMyBalance() view returns (uint256)"
];

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);

  const [crowdfund, setCrowdfund] = useState(null);
  const [attacker, setAttacker] = useState(null);

  const [goal, setGoal] = useState("0");
  const [totalRaised, setTotalRaised] = useState("0");
  const [contractBalance, setContractBalance] = useState("0");
  const [attackerBalance, setAttackerBalance] = useState("0");

  const [contributeAmount, setContributeAmount] = useState("1.0");
  const [attackAmount, setAttackAmount] = useState("1.0");
  const [status, setStatus] = useState("");

  // Connect MetaMask
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Install MetaMask.");
      return;
    }
    try {
      const _provider = new ethers.BrowserProvider(window.ethereum);
      await _provider.send("eth_requestAccounts", []);
      const _signer = await _provider.getSigner();
      const _account = await _signer.getAddress();

      const _crowdfund = new ethers.Contract(
        CROWDFUND_ADDRESS,
        CROWDFUND_ABI,
        _signer
      );
      const _attacker = new ethers.Contract(
        ATTACKER_ADDRESS,
        ATTACKER_ABI,
        _signer
      );

      setProvider(_provider);
      setSigner(_signer);
      setAccount(_account);
      setCrowdfund(_crowdfund);
      setAttacker(_attacker);
      setStatus("Wallet connected ✅");

    } catch (err) {
      console.error(err);
      setStatus("Failed to connect wallet ❌");
    }
  };

  // Load balances / goal
  const refreshData = async () => {
    if (!crowdfund || !attacker) return;
    try {
      const [g, tr, bal, atkBal] = await Promise.all([
        crowdfund.goal(),
        crowdfund.totalRaised(),
        crowdfund.getBalance(),
        attacker.getMyBalance()
      ]);
      setGoal(ethers.formatEther(g));
      setTotalRaised(ethers.formatEther(tr));
      setContractBalance(ethers.formatEther(bal));
      setAttackerBalance(ethers.formatEther(atkBal));
    } catch (err) {
      console.error(err);
      setStatus("Failed to load data");
    }
  };

  useEffect(() => {
    if (crowdfund && attacker) {
      refreshData();
    }
  }, [crowdfund, attacker]);

  // Normal user contribution
  const handleContribute = async () => {
    if (!crowdfund) return;
    try {
      setStatus("Sending contribution…");
      const tx = await crowdfund.contribute({
        value: ethers.parseEther(contributeAmount),
      });
      await tx.wait();
      setStatus("Contribution successful ✅");
      refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Contribution failed ❌");
    }
  };

  // Normal user refund (shows vulnerability without attack)
  const handleRefund = async () => {
    if (!crowdfund) return;
    try {
      setStatus("Requesting refund…");
      const tx = await crowdfund.refund();
      await tx.wait();
      setStatus("Refund call finished ✅");
      refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Refund failed ❌ (maybe no contribution)");
    }
  };

  // Owner withdraw (not secure, but for demo)
  const handleOwnerWithdraw = async () => {
    if (!crowdfund) return;
    try {
      setStatus("Owner withdrawing funds…");
      const tx = await crowdfund.withdraw();
      await tx.wait();
      setStatus("Withdraw finished ✅");
      refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Withdraw failed ❌");
    }
  };

  // === ATTACKER ACTIONS ===

  const handleAttack = async () => {
    if (!attacker) return;
    try {
      setStatus("Running reentrancy attack…");
      const tx = await attacker.fundAndAttack({
        value: ethers.parseEther(attackAmount),
      });
      await tx.wait();
      setStatus("Attack transaction finished ✅");
      refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Attack failed ❌ (check console)");
    }
  };

  const handleWithdrawLoot = async () => {
    if (!attacker) return;
    try {
      setStatus("Withdrawing loot to attacker wallet…");
      const tx = await attacker.withdrawLoot();
      await tx.wait();
      setStatus("Loot withdrawn ✅");
      refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Withdraw loot failed ❌");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050816",
        color: "#e5e7eb",
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        justifyContent: "center",
        padding: "32px 12px",
      }}
    >
      <div style={{ maxWidth: "900px", width: "100%" }}>
        <h1 style={{ fontSize: "26px", marginBottom: "8px" }}>
          🧪 Crowdfunding Attack Lab
        </h1>
        <p style={{ fontSize: "13px", opacity: 0.75, marginBottom: "16px" }}>
          Visualizing a reentrancy attack on a vulnerable crowdfunding smart
          contract (Hardhat local network).
        </p>

        {/* Top bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <button
            onClick={connectWallet}
            style={{
              padding: "8px 14px",
              borderRadius: "999px",
              border: "none",
              background: "#22c55e",
              color: "#020617",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {account ? "Wallet Connected" : "Connect MetaMask"}
          </button>

          {account && (
            <div
              style={{
                fontSize: "12px",
                padding: "6px 12px",
                borderRadius: "999px",
                background: "#0f172a",
                border: "1px solid #1f2937",
                fontFamily: "monospace",
              }}
            >
              {account.slice(0, 6)}...{account.slice(-4)}
            </div>
          )}
        </div>

        {status && (
          <div
            style={{
              fontSize: "12px",
              marginBottom: "14px",
              padding: "8px 10px",
              borderRadius: "8px",
              background: "#0b1120",
              border: "1px solid #1e293b",
            }}
          >
            {status}
          </div>
        )}

        {/* Two-column cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
          }}
        >
          {/* Crowdfund card */}
          <div
            style={{
              background: "#020617",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid #1f2937",
              boxShadow: "0 20px 40px rgba(15,23,42,0.6)",
            }}
          >
            <h2 style={{ fontSize: "18px", marginBottom: "6px" }}>
              🏦 Vulnerable Crowdfund
            </h2>
            <p style={{ fontSize: "12px", opacity: 0.75, marginBottom: "10px" }}>
              Goal must NOT be reached for the attack. Refund logic is
              vulnerable (reentrancy).
            </p>

            <div
              style={{
                background: "#020617",
                borderRadius: "12px",
                padding: "10px",
                border: "1px solid #111827",
                fontSize: "13px",
                marginBottom: "12px",
              }}
            >
              <div>🎯 Goal: {goal} ETH</div>
              <div>📈 Total raised: {totalRaised} ETH</div>
              <div>💰 Contract balance: {contractBalance} ETH</div>
            </div>

            <div style={{ fontSize: "13px", marginBottom: "6px" }}>
              Contribute (as honest user)
            </div>
            <input
              value={contributeAmount}
              onChange={(e) => setContributeAmount(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "10px",
                border: "1px solid #1f2937",
                background: "#020617",
                color: "#e5e7eb",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            />
            <button
              onClick={handleContribute}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "10px",
                border: "none",
                background: "#3b82f6",
                color: "white",
                fontWeight: 500,
                cursor: "pointer",
                marginBottom: "8px",
              }}
            >
              Contribute ETH
            </button>

            <div
              style={{ display: "flex", gap: "8px", marginTop: "4px" }}
            >
              <button
                onClick={handleRefund}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "10px",
                  border: "1px solid #1f2937",
                  background: "#020617",
                  color: "#e5e7eb",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Request Refund
              </button>
              <button
                onClick={handleOwnerWithdraw}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "10px",
                  border: "1px solid #1f2937",
                  background: "#020617",
                  color: "#e5e7eb",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Owner Withdraw
              </button>
            </div>
          </div>

          {/* Attacker card */}
          <div
            style={{
              background: "#020617",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid #1f2937",
              boxShadow: "0 20px 40px rgba(15,23,42,0.6)",
            }}
          >
            <h2 style={{ fontSize: "18px", marginBottom: "6px" }}>
              👾 Attacker Contract
            </h2>
            <p style={{ fontSize: "12px", opacity: 0.75, marginBottom: "10px" }}>
              Reentrancy attacker that abuses refund() to drain the contract.
              Two stages: drain → withdraw loot.
            </p>

            <div
              style={{
                background: "#020617",
                borderRadius: "12px",
                padding: "10px",
                border: "1px solid #111827",
                fontSize: "13px",
                marginBottom: "12px",
              }}
            >
              <div>🧨 Attacker balance: {attackerBalance} ETH</div>
              <div
                style={{ fontSize: "11px", opacity: 0.6, marginTop: "4px" }}
              >
                (After attack, this should be high; after "Withdraw loot", it
                returns to 0 and goes to your wallet.)
              </div>
            </div>

            <div style={{ fontSize: "13px", marginBottom: "6px" }}>
              Attack contribution (initial deposit)
            </div>
            <input
              value={attackAmount}
              onChange={(e) => setAttackAmount(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "10px",
                border: "1px solid #1f2937",
                background: "#020617",
                color: "#e5e7eb",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            />
            <button
              onClick={handleAttack}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "10px",
                border: "none",
                background: "#ef4444",
                color: "white",
                fontWeight: 500,
                cursor: "pointer",
                marginBottom: "8px",
              }}
            >
              Run Attack (fund & reenter)
            </button>

            <button
              onClick={handleWithdrawLoot}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "10px",
                border: "1px solid #1f2937",
                background: "#020617",
                color: "#e5e7eb",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Withdraw Loot to Wallet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
