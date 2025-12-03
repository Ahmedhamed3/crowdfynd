import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";

// === YOUR DEPLOYED ADDRESSES ===
// === DEPLOYED CONTRACT ADDRESSES ===
const CROWDFUND_CONTRACT_ADDRESS =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ATTACKER_CONTRACT_ADDRESS =
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

// === WELL-KNOWN LOCAL ACCOUNTS ===
const ATTACKER_ACCOUNT_ADDRESS =
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const HONEST_ACCOUNT_ADDRESS = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";

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
  "function attacker() view returns (address)",
  "function fundAttacker() payable",
  "function contributeToCrowdfund(uint256 amount)",
  "function fundAndAttack() payable",
  "function withdrawLoot()",
  "function getMyBalance() view returns (uint256)",
  "function getCrowdfundInfo() view returns (address, uint256, uint256, uint256)",
  "function getAddresses() view returns (address, address)"
];

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [selectedRole, setSelectedRole] = useState("honest");

  const [crowdfund, setCrowdfund] = useState(null);
  const [attacker, setAttacker] = useState(null);

  const [goal, setGoal] = useState("0");
  const [totalRaised, setTotalRaised] = useState("0");
  const [contractBalance, setContractBalance] = useState("0");
  const [attackerBalance, setAttackerBalance] = useState("0");

  const [attackerContractBalance, setAttackerContractBalance] = useState("0");
  const [crowdfundOwner, setCrowdfundOwner] = useState("");
  const [contributeAmount, setContributeAmount] = useState("1.0");
  const [attackAmount, setAttackAmount] = useState("1.0");
  const [amountToFund, setAmountToFund] = useState("0.2");
  const [amountToContributeFromContract, setAmountToContributeFromContract] =
    useState("0.5");
  const [status, setStatus] = useState("");

  const hydrateWalletState = async (requestAccounts = false) => {
    const _provider = new ethers.BrowserProvider(window.ethereum);
    if (requestAccounts) {
      await _provider.send("eth_requestAccounts", []);
    }

    const _signer = await _provider.getSigner();
    const _account = (await _signer.getAddress()).toLowerCase();

    const _crowdfund = new ethers.Contract(
      CROWDFUND_CONTRACT_ADDRESS,
      CROWDFUND_ABI,
      _signer
    );
    const _attacker = new ethers.Contract(
      ATTACKER_CONTRACT_ADDRESS,
      ATTACKER_ABI,
      _signer
    );

    setProvider(_provider);
    setSigner(_signer);
    setAccount(_account);
    setCrowdfund(_crowdfund);
    setAttacker(_attacker);
  };

  // Connect MetaMask
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Install MetaMask.");
      return;
    }
    try {
      await hydrateWalletState(true);
      setStatus("Wallet connected ✅");
    } 
    catch (err) {
      console.error(err);
      setStatus("Failed to connect wallet ❌");
    }
  };

  const shortenedAddress = (addr) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const selectedRoleLabel =
    selectedRole === "attacker"
      ? "Attacker – Imported Account 1"
      : "Honest User – Imported Account 2";

  const roleStatus = useMemo(() => {
    if (!account) {
      return {
        color: "#eab308",
        text: "Connect MetaMask to compare the selected role with the active account.",
      };
    }

    if (selectedRole === "attacker") {
      const matches = account === ATTACKER_ACCOUNT_ADDRESS.toLowerCase();
      return {
        color: matches ? "#22c55e" : "#ef4444",
        text: matches
          ? "Connected as Attacker (Imported Account 1)."
          : "Selected role is Attacker, but MetaMask is using Honest User. Please switch to the attacker account in MetaMask.",
      };
    }

    const matches = account === HONEST_ACCOUNT_ADDRESS.toLowerCase();
    return {
      color: matches ? "#22c55e" : "#ef4444",
      text: matches
        ? "Connected as Honest User (Imported Account 2)."
        : "Selected role is Honest User, but MetaMask is using a different account. Please switch to the honest user account in MetaMask.",
    };
  }, [account, selectedRole]);

  // Load balances / goal
  const refreshData = async () => {
    if (!crowdfund || !attacker || !provider) return;
    try {
      const [crowdfundInfo, atkBal, contractBal] = await Promise.all([
        attacker.getCrowdfundInfo(),
        attacker.getMyBalance(),
        provider.getBalance(ATTACKER_CONTRACT_ADDRESS),
      ]);
      const [_owner, _goal, _totalRaised, _balance] = crowdfundInfo;

      setGoal(ethers.formatEther(_goal));
      setTotalRaised(ethers.formatEther(_totalRaised));
      setContractBalance(ethers.formatEther(_balance));
      setCrowdfundOwner(_owner);
      setAttackerBalance(ethers.formatEther(atkBal));
      setAttackerContractBalance(ethers.formatEther(contractBal));
    } catch (err) {
      console.error(err);
      setStatus("Failed to load data");
    }
  };

  useEffect(() => {
    if (crowdfund && attacker && provider) {
      refreshData();
    }
  }, [crowdfund, attacker, provider]);

   // Keep UI in sync with MetaMask account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (!accounts || accounts.length === 0) {
        setAccount(null);
        setSigner(null);
        setCrowdfund(null);
        setAttacker(null);
        return;
      }

      try {
        await hydrateWalletState();
        setStatus("Wallet updated ✅");
      } catch (err) {
        console.error("Failed to hydrate after account change", err);
        // As a fallback to avoid stale signer, reload the page
        window.location.reload();
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

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

  const ensureAttackerAccount = () => {
    if (!account) {
      setStatus("Connect MetaMask first.");
      return false;
    }

    if (account !== ATTACKER_ACCOUNT_ADDRESS.toLowerCase()) {
      setStatus(
        "Please switch MetaMask to the attacker account to fund the attacker contract.",
      );
      return false;
    }

    return true;
  };

  const handleFundAttackerContract = async () => {
    if (!attacker) return;
    if (!ensureAttackerAccount()) return;

    try {
      setStatus("Funding attacker contract…");
      const tx = await attacker.fundAttacker({
        value: ethers.parseEther(amountToFund || "0"),
      });
      await tx.wait();
      setStatus("Attacker contract funded ✅");
      refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Funding attacker contract failed ❌");
    }
  };

  const handleContributeFromContract = async () => {
    if (!attacker) return;
    if (!ensureAttackerAccount()) return;

    try {
      setStatus("Contributing from attacker contract…");
      const tx = await attacker.contributeToCrowdfund(
        ethers.parseEther(amountToContributeFromContract || "0"),
      );
      await tx.wait();
      setStatus("Contribution from attacker contract complete ✅");
      refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Contribution from attacker contract failed ❌");
    }
  };

  const handleRefreshContractInfo = async () => {
    try {
      setStatus("Refreshing contract info…");
      await refreshData();
      setStatus("Contract info refreshed ✅");
    } catch (err) {
      console.error(err);
      setStatus("Refresh failed ❌");
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
        width: "100%",
        background: "#050816",
        color: "#e5e7eb",
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        justifyContent: "center",
        padding: "40px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1200px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <header style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h1 style={{ fontSize: "28px", margin: 0 }}>
            🧪 Crowdfunding Attack Lab
          </h1>
          <p style={{ fontSize: "14px", opacity: 0.8, margin: 0 }}>
            Visualizing a reentrancy attack on a vulnerable crowdfunding smart contract
            (Hardhat local network). Use the role selector to view the flows as the attacker
            or the honest user.
          </p>
        </header>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            background: "#0b1224",
            border: "1px solid #1f2937",
            borderRadius: "14px",
            padding: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: "13px", opacity: 0.85 }}>
              Viewing as: <strong>{selectedRoleLabel}</strong>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
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
                  Active: {shortenedAddress(account)}
                </div>
              )}
              <button
                onClick={connectWallet}
                style={{
                  padding: "10px 16px",
                  borderRadius: "999px",
                  border: "none",
                  background: "#22c55e",
                  color: "#020617",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                {account ? "Wallet Connected" : "Connect MetaMask"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ fontSize: "13px", opacity: 0.9 }}>Choose a role to view the flows:</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "10px",
              }}
            >
              <button
                onClick={() => setSelectedRole("attacker")}
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  border: selectedRole === "attacker" ? "1px solid #22c55e" : "1px solid #1f2937",
                  background: selectedRole === "attacker" ? "rgba(34, 197, 94, 0.1)" : "#0f172a",
                  color: "#e5e7eb",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                  Attacker – Imported Account 1
                </div>
                <div style={{ fontSize: "12px", opacity: 0.8 }}>
                  {shortenedAddress(ATTACKER_ACCOUNT_ADDRESS)}
                </div>
              </button>

              <button
                onClick={() => setSelectedRole("honest")}
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  border: selectedRole === "honest" ? "1px solid #22c55e" : "1px solid #1f2937",
                  background: selectedRole === "honest" ? "rgba(34, 197, 94, 0.1)" : "#0f172a",
                  color: "#e5e7eb",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                  Honest User – Imported Account 2
                </div>
                <div style={{ fontSize: "12px", opacity: 0.8 }}>
                  {shortenedAddress(HONEST_ACCOUNT_ADDRESS)}
                </div>
              </button>
            </div>
            <div style={{ fontSize: "12px", color: roleStatus.color }}>
              {roleStatus.text}
            </div>
          </div>
        </div>

        {status && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              borderRadius: "8px",
              background: "#0b1120",
              border: "1px solid #1e293b",
            }}
          >
            {status}
          </div>
        )}

        
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "20px",
            marginTop: "4px",
          }}
        >
          {/* Crowdfund card */}
          <div
            style={{
              background: "#020617",
              borderRadius: "16px",
              padding: "18px",
              border: "1px solid #1f2937",
              boxShadow: "0 20px 40px rgba(15,23,42,0.6)",
            }}
          >
            <h2 style={{ fontSize: "18px", marginBottom: "6px" }}>
              🏦 Vulnerable Crowdfund
            </h2>
            <p style={{ fontSize: "12px", opacity: 0.8, marginBottom: "10px" }}>
              Goal must NOT be reached for the attack. Refund logic is vulnerable (reentrancy).
              Honest users are typically contributing and requesting refunds from this panel.
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

            <div style={{ fontSize: "13px", marginBottom: "4px" }}>
              Contribute (usually the honest user – Imported Account 2)
            </div>
            <div style={{ fontSize: "11px", opacity: 0.75, marginBottom: "6px" }}>
              You selected: {selectedRoleLabel}
            </div>
            <input
              value={contributeAmount}
              onChange={(e) => setContributeAmount(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
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
                padding: "10px",
                borderRadius: "10px",
                border: "none",
                background: "#3b82f6",
                color: "white",
                fontWeight: 600,
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
                  padding: "10px",
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
                  padding: "10px",
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
              padding: "18px",
              border: "1px solid #1f2937",
              boxShadow: "0 20px 40px rgba(15,23,42,0.6)",
            }}
          >
            <h2 style={{ fontSize: "18px", marginBottom: "6px" }}>
              👾 Attacker Contract
            </h2>
            <p style={{ fontSize: "12px", opacity: 0.8, marginBottom: "10px" }}>
              Reentrancy attacker that abuses refund() to drain the contract. These actions
              are typically done with Imported Account 1.
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
                style={{ fontSize: "11px", opacity: 0.75, marginTop: "4px" }}
              >
                Selected role: {selectedRoleLabel}
              </div>
              <div
                style={{ fontSize: "11px", opacity: 0.6, marginTop: "4px" }}
              >
                (After attack, this should be high; after "Withdraw loot", it returns to 0 and goes to your wallet.)
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <div
                style={{
                  background: "#0b1120",
                  border: "1px solid #1f2937",
                  borderRadius: "10px",
                  padding: "10px",
                  fontSize: "12px",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                  Contract Info
                </div>
                <div>Crowdfund: {CROWDFUND_CONTRACT_ADDRESS}</div>
                <div>Attacker: {ATTACKER_CONTRACT_ADDRESS}</div>
                <div>Owner: {crowdfundOwner || "-"}</div>
                <div>Goal: {goal} ETH</div>
                <div>Total raised: {totalRaised} ETH</div>
                <div>Balance: {contractBalance} ETH</div>
                <div>Attacker contract balance: {attackerContractBalance} ETH</div>
                <button
                  onClick={handleRefreshContractInfo}
                  style={{
                    marginTop: "8px",
                    padding: "8px",
                    width: "100%",
                    borderRadius: "8px",
                    border: "1px solid #1f2937",
                    background: "#0f172a",
                    color: "#e5e7eb",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Refresh Contract Info
                </button>
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
                padding: "10px",
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
                padding: "10px",
                borderRadius: "10px",
                border: "none",
                background: "#ef4444",
                color: "white",
                fontWeight: 600,
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
                padding: "10px",
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

            <div style={{ marginTop: "14px", display: "grid", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                  Step 1: Fund attacker contract (EOA → attacker contract)
                </div>
                <input
                  value={amountToFund}
                  onChange={(e) => setAmountToFund(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #1f2937",
                    background: "#020617",
                    color: "#e5e7eb",
                    fontSize: "13px",
                    marginBottom: "8px",
                  }}
                />
                <button
                  onClick={handleFundAttackerContract}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #1f2937",
                    background: "#0ea5e9",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: "8px",
                  }}
                >
                  Fund Attacker Contract (EOA → Attacker Contract)
                </button>
              </div>

              <div>
                <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                  Step 2: Contribute from attacker contract → vulnerable crowdfund
                </div>
                <input
                  value={amountToContributeFromContract}
                  onChange={(e) =>
                    setAmountToContributeFromContract(e.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #1f2937",
                    background: "#020617",
                    color: "#e5e7eb",
                    fontSize: "13px",
                    marginBottom: "8px",
                  }}
                />
                <button
                  onClick={handleContributeFromContract}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #1f2937",
                    background: "#8b5cf6",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: "8px",
                  }}
                >
                  Contribute From Attacker Contract → Vulnerable Crowdfund
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
