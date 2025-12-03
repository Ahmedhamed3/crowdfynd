import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";


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
];

const ATTACKER_ABI = [
  "function attacker() view returns (address)",
  "function depositToCrowdfund() payable",
  "function runAttack(uint256 attackAmount)",
  "function withdrawLoot()",
  "function getCrowdfundInfo() view returns (uint256, uint256, uint256)",
  "function getAttackerContractBalance() view returns (uint256)",
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
  const [crowdfundBalance, setCrowdfundBalance] = useState("0");
  const [attackerContractBalance, setAttackerContractBalance] = useState("0");
  const [attackerWalletBalance, setAttackerWalletBalance] = useState("0");
  const [contributeAmount, setContributeAmount] = useState("1.0");
  const [depositAmount, setDepositAmount] = useState("1.0");
  const [attackAmount, setAttackAmount] = useState("1.0");
  
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
    } catch (err) {
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
          : "Selected role is Attacker, but MetaMask is using a different account. You can still read balances, but switch to the attacker account to send transactions.",
        };
    }

    const matches = account === HONEST_ACCOUNT_ADDRESS.toLowerCase();
    return {
      color: matches ? "#22c55e" : "#ef4444",
      text: matches
        ? "Connected as Honest User (Imported Account 2)."
        : "Selected role is Honest User, but MetaMask is using a different account. You can still read balances, but switch accounts to contribute as the honest user.",
    };
  }, [account, selectedRole]);

  // Load balances / goal
  const refreshData = async () => {
    if (!crowdfund || !attacker || !provider) return;
    try {
      const [[_goal, _totalRaised, _balance], atkContractBalance] =
        await Promise.all([
          attacker.getCrowdfundInfo(),
          attacker.getAttackerContractBalance(),
        ]);

      setGoal(ethers.formatEther(_goal));
      setTotalRaised(ethers.formatEther(_totalRaised));
      setCrowdfundBalance(ethers.formatEther(_balance));
      setAttackerContractBalance(ethers.formatEther(atkContractBalance));
    } catch (err) {
      console.error(err);
      setStatus("Failed to load data");
    }
  };
  const refreshAttackerWalletBalance = async () => {
    if (!provider || !signer) return;
    const walletAddress = await signer.getAddress();
    const bal = await provider.getBalance(walletAddress);
    setAttackerWalletBalance(ethers.formatEther(bal));
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

  // Honest user contribution
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


  // === ATTACKER ACTIONS ===

  const handleAttackerDeposit = async () => {
    if (!attacker) return;
    try {
      setStatus("Depositing through attacker contract…");
      const tx = await attacker.depositToCrowdfund({
        value: ethers.parseEther(depositAmount || "0"),
      });
      await tx.wait();
      setStatus("Deposit forwarded to vulnerable crowdfund ✅");
      refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Deposit failed ❌ (use attacker account)");
    }
  };

  const handleRunAttack = async () => {
    if (!attacker) return;
   

    try {
      setStatus("Running reentrancy attack…");
      const tx = await attacker.runAttack(ethers.parseEther(attackAmount || "0"));
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
      refreshAttackerWalletBalance();
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
              Honest users are typically contributing from this panel.
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
              <div>💰 Contract balance: {crowdfundBalance} ETH</div>
            </div>

            <div style={{ fontSize: "13px", marginBottom: "4px" }}>
              Contribute (honest user – Imported Account 2)
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
              ⚔️ Attacker Contract Flow
            </h2>
            <p style={{ fontSize: "12px", opacity: 0.8, marginBottom: "10px" }}>
              Three-step attack: deposit/contribute → run reentrancy → withdraw loot.
            </p>

            <div
              style={{
                background: "#020617",
                borderRadius: "12px",
                padding: "10px",
                border: "1px solid #111827",
                fontSize: "13px",
                marginBottom: "12px",
                display: "grid",
                gap: "6px",
              }}
            >
              <div>🏛 Crowdfund balance: {crowdfundBalance} ETH</div>
              <div>🧨 Attacker contract balance: {attackerContractBalance} ETH</div>
              <div>🧍 Attacker wallet balance: {attackerWalletBalance} ETH</div>
            </div>

            
            <div style={{ display: "grid", gap: "10px" }}>
              <div>
                <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                  Step 1: Deposit / Contribute (attacker → contract → crowdfund)
                </div>
                <input
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #0c408aff",
                    background: "#020617",
                    color: "#e5e7eb",
                    fontSize: "13px",
                    marginBottom: "8px",
                  }}
                />
                <button
                  onClick={handleAttackerDeposit}
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
                  Deposit / Contribute (Attacker)
                </button>
              </div>

              <div>
                <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                  Step 2: Run Attack (reentrancy)
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
                  onClick={handleRunAttack}
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
                  Run Attack (reentrancy)
                </button>
              </div>

              <div>
                <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                  Step 3: Withdraw loot to attacker wallet
                </div>
                <button
                  onClick={handleWithdrawLoot}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #1f2937",
                    background: "#16a34a",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: "8px",
                  }}
                >
                  Withdraw Loot to Wallet
                </button>
              </div>
              <div>
                <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                  Refresh balances
                </div>
                <div style={{ display: "grid", gap: "8px" }}>
                  <button
                    onClick={refreshData}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "10px",
                      border: "1px solid #1f2937",
                      background: "#334155",
                      color: "white",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Refresh Contract Balances
                  </button>
                  <button
                    onClick={refreshAttackerWalletBalance}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "10px",
                      border: "1px solid #1f2937",
                      background: "#475569",
                      color: "white",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Refresh Attacker Wallet Balance
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
