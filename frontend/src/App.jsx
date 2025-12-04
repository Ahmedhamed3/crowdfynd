import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import contractAddresses from "./contractAddresses.json";


// === DEPLOYED CONTRACT ADDRESSES ===
const VULNERABLE_CROWDFUND_ADDRESS =
  contractAddresses.crowdfund || contractAddresses.CrowdfundVulnerable;
const SECURE_CROWDFUND_ADDRESS =
  contractAddresses.crowdfundSecure || contractAddresses.CrowdfundSecure;
const ATTACKER_CONTRACT_ADDRESS =
  contractAddresses.attacker || contractAddresses.RefundAttacker;
const ATTACK2_CONTRACT_ADDRESS =
  contractAddresses.attack2DoSAttacker || contractAddresses.Attack2DoSAttacker;

// === WELL-KNOWN LOCAL ACCOUNTS ===
const ATTACKER_ACCOUNT_ADDRESS =
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const ATTACKER2_ACCOUNT_ADDRESS = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";  
const HONEST_ACCOUNT_ADDRESS = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const HONEST_ACCOUNT_2_ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

// Minimal ABIs (only the functions we use)
const CROWDFUND_ABI = [
  "function owner() view returns (address)",
  "function goal() view returns (uint256)",
  "function totalRaised() view returns (uint256)",
  "function contributions(address) view returns (uint256)",
  "function contribute() payable",
  "function requestRefund()",
  "function refundAll()",
  "function getContributorsCount() view returns (uint256)",
  "function contributors(uint256) view returns (address)",
  "function getContributors() view returns (address[])",
  "function getContributionOf(address) view returns (uint256)",
  "function getBalance() view returns (uint256)",
  "function withdraw()",

];

const ATTACKER_ABI = [
  "function attacker() view returns (address)",
  "function fundAttacker() payable",
  "function lastContributionAmount() view returns (uint256)",
  "function contributeFromContract(address,uint256)",
  "function runAttack(address,uint256)",
  "function withdrawLoot()",
];

const ATTACK2_ABI = [
  "function attacker() view returns (address)",
  "function fundAttack2() payable",
  "function joinCrowdfund(address,uint256)",
  "function triggerRefundAll(address)",
  "function withdrawLoot()",
  "function getBalance() view returns (uint256)",
  "event JoinedCrowdfund(address indexed attacker, uint256 amount)",
  "event RefundAllBlocked(address indexed attacker)",
];

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [selectedRole, setSelectedRole] = useState("honest1");
  const [mode, setMode] = useState("vulnerable");

  const [crowdfund, setCrowdfund] = useState(null);
  const [attacker, setAttacker] = useState(null);
  const [attack2, setAttack2] = useState(null);


  const [goal, setGoal] = useState("0");
  const [totalRaised, setTotalRaised] = useState("0");
  const [crowdfundOwner, setCrowdfundOwner] = useState(null);
  const [crowdfundBalance, setCrowdfundBalance] = useState("0");
  const [attackerContractBalance, setAttackerContractBalance] = useState("0");
  const [attackerEOABalance, setAttackerEOABalance] = useState("0");
  const [attack2ContractBalance, setAttack2ContractBalance] = useState("0");
  const [attacker2EOABalance, setAttacker2EOABalance] = useState("0");
  const [attack2CrowdfundContribution, setAttack2CrowdfundContribution] =
    useState("0");
  const [contributeAmount, setContributeAmount] = useState("1.0");
  const [attackerFundingAmount, setAttackerFundingAmount] = useState("1.0");
  const [attackerContributionAmount, setAttackerContributionAmount] =
    useState("1.0");
  const [attackAmount, setAttackAmount] = useState("1.0");
  const [attack2FundingAmount, setAttack2FundingAmount] = useState("0.2");
  const [attack2JoinAmount, setAttack2JoinAmount] = useState("0.1");

  const [contributors, setContributors] = useState([]);
  
  
  const [status, setStatus] = useState("");

  const crowdfundAddress = useMemo(
    () =>
      mode === "vulnerable"
        ? VULNERABLE_CROWDFUND_ADDRESS
        : SECURE_CROWDFUND_ADDRESS,
    [mode]
  );

  const hydrateWalletState = async (requestAccounts = false) => {
    const _provider = new ethers.BrowserProvider(window.ethereum);
    if (requestAccounts) {
      await _provider.send("eth_requestAccounts", []);
    }
    const network = await _provider.getNetwork();
    setChainId(network.chainId);

    if (network.chainId !== 31337n) {
      setStatus("❌ Wrong network: please switch MetaMask to Hardhat (31337)");
      setCrowdfund(null);
      setAttacker(null);
      setProvider(_provider);
      setSigner(null);
      setAccount(null);
      return false;
    }

    const [crowdfundCode, attackerCode, attack2Code] = await Promise.all([
      _provider.getCode(crowdfundAddress),
      _provider.getCode(ATTACKER_CONTRACT_ADDRESS),
      _provider.getCode(ATTACK2_CONTRACT_ADDRESS),
    ]);

    if (
      crowdfundCode === "0x" ||
      attackerCode === "0x" ||
      attack2Code === "0x" ||
      crowdfundAddress === ethers.ZeroAddress
    ) {
      setStatus("❌ Contract not deployed or wrong network");
      setCrowdfund(null);
      setAttacker(null);
      setAttack2(null);
      setProvider(_provider);
      setSigner(null);
      setAccount(null);
      return false;
    }

    const _signer = await _provider.getSigner();
    const _account = (await _signer.getAddress()).toLowerCase();

    const _crowdfund = new ethers.Contract(
      crowdfundAddress,
      CROWDFUND_ABI,
      _signer
    );
    const _attacker = new ethers.Contract(
      ATTACKER_CONTRACT_ADDRESS,
      ATTACKER_ABI,
      _signer
    );
    const _attack2 = new ethers.Contract(
      ATTACK2_CONTRACT_ADDRESS,
      ATTACK2_ABI,
      _signer
    );

    setProvider(_provider);
    setSigner(_signer);
    setAccount(_account);
    setCrowdfund(_crowdfund);
    setAttacker(_attacker);
    setAttack2(_attack2);
    return true;
  };

  // Connect MetaMask
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Install MetaMask.");
      return;
    }
    try {
      const hydrated = await hydrateWalletState(true);
      if (!hydrated) return;
      setStatus("Wallet connected ✅");
      refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Failed to connect wallet ❌");
    }
  };

  const shortenedAddress = (addr) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const roleOptions = {
    attacker1: {
      label: "Attacker 1 – Reentrancy (Imported Account 1)",
      address: ATTACKER_ACCOUNT_ADDRESS,
    },
    attacker2: {
      label: "Attacker 2 – DoS (Hardhat Account 3)",
      address: ATTACKER2_ACCOUNT_ADDRESS,
    },
    honest1: {
      label: "Honest User 1 – Imported Account", // legacy imported account
      address: HONEST_ACCOUNT_ADDRESS,
    },
    honest2: {
      label: "Honest User 2 – Hardhat Account 2",
      address: HONEST_ACCOUNT_2_ADDRESS,
    },
  };

  const selectedRoleLabel = roleOptions[selectedRole]?.label ?? "Unknown role";
  const selectedAttackerAddress = useMemo(() => {
    if (selectedRole === "attacker1") return ATTACKER_ACCOUNT_ADDRESS;
    if (selectedRole === "attacker2") return ATTACKER2_ACCOUNT_ADDRESS;
    return null;
  }, [selectedRole]);

  const selectedAttackerBalance = useMemo(() => {
    if (selectedRole === "attacker1") return attackerEOABalance;
    if (selectedRole === "attacker2") return attacker2EOABalance;
    return null;
  }, [selectedRole, attackerEOABalance, attacker2EOABalance]);

  const roleStatus = useMemo(() => {
    if (!account) {
      return {
        color: "#eab308",
        text: "Connect MetaMask to compare the selected role with the active account.",
      };
    }

    const selected = roleOptions[selectedRole];
    if (!selected) {
      return {
        color: "#f97316",
        text: "Unknown role selected",
      };
    }

    const matches = account === selected.address.toLowerCase();
    return {
      color: matches ? "#22c55e" : "#ef4444",
      text: matches
        ? `Connected as ${selected.label}.`
        : `Selected role is ${selected.label}, but MetaMask is using a different account. You can still read balances, but switch accounts to send transactions for this role.`,
    };
  }, [account, selectedRole]);

  const ensureContractsReady = () => {
    if (!provider || !crowdfund || !attacker || !attack2) {
      setStatus("❌ Contract not deployed or wrong network");
      return false;
    }
    if (chainId !== 31337n) {
      setStatus("❌ Wrong network: please switch MetaMask to Hardhat (31337)");
      return false;
    }
    return true;
  };

  const ensureAttack1Account = () => {
    if (!account) {
      setStatus("❌ Connect MetaMask first");
      return false;
    }
    const matches = account === ATTACKER_ACCOUNT_ADDRESS.toLowerCase();
    if (!matches) {
      setStatus("❌ Switch MetaMask to the attacker account before running attacker steps");
    }
    return matches;
  };

  const ensureSelectedAttackerAccount = () => {
    if (!account) {
      setStatus("❌ Connect MetaMask first");
      return false;
    }
    if (!selectedAttackerAddress) {
      setStatus("❌ Select Attacker 1 or Attacker 2 to run this attack");
      return false;
    }
    const matches = account === selectedAttackerAddress.toLowerCase();
    if (!matches) {
      setStatus("❌ Switch MetaMask to the selected attacker before running Attack 3");
    }
    return matches;
  };

  const ensureAttack2Account = () => {
    if (!account) {
      setStatus("❌ Connect MetaMask first");
      return false;
    }
    const matches = account === ATTACKER2_ACCOUNT_ADDRESS.toLowerCase();
    if (!matches) {
      setStatus("❌ Switch MetaMask to Attacker 2 (Hardhat account #3) before running this flow");
    }
    return matches;
  };

  const ensureHonestAccount = () => {
    if (!account) {
      setStatus("❌ Connect MetaMask first");
      return false;
    }
    const matches =
      account === HONEST_ACCOUNT_ADDRESS.toLowerCase() ||
      account === HONEST_ACCOUNT_2_ADDRESS.toLowerCase();
    if (!matches) {
      setStatus(
        "⚠️ You selected the honest flow but MetaMask is not using one of the honest user accounts"
      );
    }
    return matches;
  };

  const loadContributors = async (contractOverride) => {
    const targetCrowdfund = contractOverride ?? crowdfund;
    if (!targetCrowdfund) return;
    try {
      const addrs = await targetCrowdfund.getContributors();

      const rows = await Promise.all(
        addrs.map(async (addr) => {
          const amount = await targetCrowdfund.getContributionOf(addr);
          return {
            address: addr,
            amountEth: Number(ethers.formatEther(amount)),
          };
        })
      );

      setContributors(rows);
    } catch (err) {
      console.error("loadContributors error", err);
    }
  };


  // Load balances / goal
  const refreshData = async () => {
    if (!crowdfund || !attacker || !provider) return;
    try {
      const network = await provider.getNetwork();
      setChainId(network.chainId);
      if (network.chainId !== 31337n) {
        setStatus("❌ Wrong network: please switch MetaMask to Hardhat (31337)");
        return;
      }
      const [crowdfundCode, attackerCode, attack2Code] = await Promise.all([
        provider.getCode(crowdfundAddress),
        provider.getCode(ATTACKER_CONTRACT_ADDRESS),
        provider.getCode(ATTACK2_CONTRACT_ADDRESS),
      ]);

      if (crowdfundCode === "0x" || attackerCode === "0x" || attack2Code === "0x") {
        setStatus("❌ Contract not deployed or wrong network");
        return;
      }

      const crowdfundForReads = new ethers.Contract(
        crowdfundAddress,
        CROWDFUND_ABI,
        provider
      );
      const [
        _goal,
        _totalRaised,
        ownerAddress,
        _attackerContractContribution,
        _attack2Contribution,
        _crowdfundBalanceWei,
        _attackerContractBalanceWei,
        _attack2ContractBalanceWei,
        _attacker1EOABalanceWei,
        _attacker2EOABalanceWei,
      ] = await Promise.all([
        crowdfundForReads.goal(),
        crowdfundForReads.totalRaised(),
        crowdfundForReads.owner(),
        crowdfundForReads.contributions(ATTACKER_CONTRACT_ADDRESS),
        crowdfundForReads.contributions(ATTACK2_CONTRACT_ADDRESS),
        provider.getBalance(crowdfundAddress),
        provider.getBalance(ATTACKER_CONTRACT_ADDRESS),
        provider.getBalance(ATTACK2_CONTRACT_ADDRESS),
        provider.getBalance(ATTACKER_ACCOUNT_ADDRESS),
        provider.getBalance(ATTACKER2_ACCOUNT_ADDRESS),
      ]);

      setCrowdfundOwner(ownerAddress);

      setGoal(ethers.formatEther(_goal));
      setTotalRaised(ethers.formatEther(_totalRaised));
      setCrowdfundBalance(ethers.formatEther(_crowdfundBalanceWei));
      setAttackerContractBalance(
        ethers.formatEther(_attackerContractBalanceWei)
      );
      setAttack2ContractBalance(
        ethers.formatEther(_attack2ContractBalanceWei)
      );
      setAttackerEOABalance(ethers.formatEther(_attacker1EOABalanceWei));
      setAttacker2EOABalance(ethers.formatEther(_attacker2EOABalanceWei));
      const contributed = ethers.formatEther(_attackerContractContribution);
      setAttackAmount(contributed);
      setAttackerContributionAmount(contributed);
      setAttack2CrowdfundContribution(
        ethers.formatEther(_attack2Contribution)
      );

      await loadContributors(crowdfundForReads);
    } catch (err) {
      console.error(err);
      setStatus("Failed to load data");
    }
  };
  const refreshKnownWalletBalances = async () => {
    if (!provider) return;
    const [a1, a2] = await Promise.all([
      provider.getBalance(ATTACKER_ACCOUNT_ADDRESS),
      provider.getBalance(ATTACKER2_ACCOUNT_ADDRESS),
    ]);
    setAttackerEOABalance(ethers.formatEther(a1));
    setAttacker2EOABalance(ethers.formatEther(a2));
  };

  useEffect(() => {
    if (crowdfund && attacker && attack2 && provider) {
      refreshData();
    }
  }, [crowdfund, attacker, attack2, provider]);

  useEffect(() => {
    const syncCrowdfundForMode = async () => {
      if (!provider || !signer) return;
      const code = await provider.getCode(crowdfundAddress);
      if (code === "0x" || crowdfundAddress === ethers.ZeroAddress) {
        setStatus("❌ Contract not deployed for this mode");
        setCrowdfund(null);
        return;
      }

      const _crowdfund = new ethers.Contract(
        crowdfundAddress,
        CROWDFUND_ABI,
        signer
      );
      setCrowdfund(_crowdfund);
      setStatus(
        mode === "vulnerable"
          ? "Switched to 🔓 Vulnerable mode"
          : "Switched to 🔒 Secure mode"
      );
    };

    syncCrowdfundForMode();
  }, [mode, provider, signer, crowdfundAddress]);


  // Load the known wallet balances once on initial render
  useEffect(() => {
    if (!window.ethereum) return;
     refreshKnownWalletBalances();
  }, []);

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
        const hydrated = await hydrateWalletState();
        if (hydrated) {
          // Keep the displayed attacker balance aligned with the active MetaMask account
          refreshKnownWalletBalances();
          setStatus("Wallet updated ✅");
          refreshData();
        }
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
    if (!ensureContractsReady()) return;
    ensureHonestAccount();
    try {
      const value = ethers.parseEther(contributeAmount || "0");
      if (value <= 0n) {
        setStatus("❌ Enter a positive contribution amount");
        return;
      }
      setStatus("Sending contribution…");
      const tx = await crowdfund.contribute({
        value,
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
    if (!ensureContractsReady()) return;
    if (!ensureAttack1Account()) return;
    try {
      const value = ethers.parseEther(attackerFundingAmount || "0");
      if (value <= 0n) {
        setStatus("❌ Enter a positive amount to fund the attacker contract");
        return;
      }
      setStatus("Funding attacker contract…");
      const tx = await attacker.fundAttacker({
        value,
      });
      await tx.wait();
      setStatus("Attacker contract funded ✅");
      refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Deposit failed ❌ (use attacker account)");
    }
  };

  const handleContributeFromAttacker = async () => {
    if (!ensureContractsReady()) return;
    if (!ensureAttack1Account()) return;
    try {
      const value = ethers.parseEther(attackerContributionAmount || "0");
      if (value <= 0n) {
        setStatus("❌ Enter a positive contribution amount for the attacker contract");
        return;
      }
      const contractBal = await provider.getBalance(ATTACKER_CONTRACT_ADDRESS);
      if (contractBal < value) {
        setStatus("❌ Attacker contract balance too low for that contribution");
        return;
      }
      setStatus("Contributing from attacker contract to crowdfund…");
      const tx = await attacker.contributeFromContract(
        crowdfundAddress,
        value
      );
      await tx.wait();
      await refreshData();
      setStatus("Contribution sent from attacker contract ✅");
    } catch (err) {
      console.error(err);
      setStatus("Contribution from attacker contract failed ❌");
    }
  };
   
  const handleRunAttack = async () => {
    if (!ensureContractsReady()) return;
    if (!ensureAttack1Account()) return;
    try {
      const value = ethers.parseEther(attackAmount || "0");
      if (value <= 0n) {
        setStatus("❌ Attack amount must be positive and match the attacker contribution");
        return;
      }
      setStatus("Running reentrancy attack…");
      const tx = await attacker.runAttack(crowdfundAddress, value);
      await tx.wait();
      setStatus(
        mode === "vulnerable"
          ? "Attack 1 succeeded – reentrancy drained the crowdfund ❌"
          : "Reentrancy attempt executed – secure contract updates state before sending ETH ✅"
      );
      refreshData();
    } catch (err) {
      console.error(err);
      setStatus(
        mode === "secure"
          ? "Reentrancy blocked ✅ – secure crowdfund updates state before sending ETH"
          : "Attack failed ❌ (check console)"
      );
    }
  };

  const handleWithdrawLoot = async () => {
    if (!ensureContractsReady()) return;
    if (!ensureAttack1Account()) return;
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

  // === ATTACK 2 (DoS) ===
  const handleAttack2Fund = async () => {
    if (!ensureContractsReady()) return;
    if (!ensureAttack2Account()) return;
    try {
      const parsedAmount = ethers.parseEther(attack2FundingAmount || "0");
      if (parsedAmount <= 0n) {
        setStatus("❌ Enter a positive amount to fund the Attack 2 contract");
        return;
      }

      setStatus("Funding Attack 2 contract from attacker wallet…");
      const tx = await attack2.fundAttack2({ value: parsedAmount });
      await tx.wait();
      setStatus("Attack 2 contract funded ✅");
      refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Funding Attack 2 contract failed ❌");
    }
  };
  const handleAttack2Join = async () => {
    if (!ensureContractsReady()) return;
    if (!ensureAttack2Account()) return;
    try {
      const value = ethers.parseEther(attack2JoinAmount || "0");
      if (value <= 0n) {
        setStatus("❌ Enter a positive amount to join the crowdfund as Attacker 2");
        return;
      }
      const parsedAmount = ethers.parseEther(attack2JoinAmount || "0");
      if (parsedAmount <= 0n) {
        setStatus("❌ Attack 2 contract balance too low — fund it first");
        return;
      }
      setStatus("Joining crowdfund as DoS attacker…");
      const tx = await attack2.joinCrowdfund(crowdfundAddress, parsedAmount);
      await tx.wait();
      setStatus("Attacker 2 joined the crowdfund ✅");
      refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Join failed ❌ (check console)");
    }
  };

  const handleAttack2BlockRefunds = async () => {
    if (!ensureContractsReady()) return;
    if (!ensureAttack2Account()) return;
    try {
      setStatus(
        mode === "vulnerable"
          ? "Triggering refundAll() – expected to revert due to DoS…"
          : "Triggering refundAll() on secure contract (should be best-effort)…"
      );
      const tx = await attack2.triggerRefundAll(crowdfundAddress);
      await tx.wait();
      setStatus(
        mode === "vulnerable"
          ? "refundAll() completed (unexpected) ✅"
          : "refundAll() completed (DoS attacker could not block all refunds) ✅"
      );
    } catch (err) {
      console.error(err);
      setStatus(
        mode === "vulnerable"
          ? "refundAll() reverted ❌ – DoS attacker blocked everyone"
          : "Secure refundAll() handled DoS attempt (check events) ✅"
      );
    } finally {
      refreshData();
    }
  };

  const handleAttack2Withdraw = async () => {
    if (!ensureContractsReady()) return;
    if (!ensureAttack2Account()) return;
    try {
      setStatus("Withdrawing any balance from Attack 2 contract…");
      const tx = await attack2.withdrawLoot();
      await tx.wait();
      setStatus("Attack 2 withdrawal complete ✅");
      refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Withdraw failed ❌ (likely no balance or reverted call)");
    }
  };


  // === ATTACK 3 (Unauthorized withdraw / broken access control) ===
  const handleUnauthorizedWithdraw = async () => {
    if (!ensureContractsReady()) return;
    if (!ensureSelectedAttackerAccount()) return;
    try {
      setStatus("Attempting unauthorized withdraw…");
      const tx = await crowdfund.withdraw();
      await tx.wait();

      if (mode === "vulnerable") {
        setStatus(
          "Withdraw succeeded — broken access control allowed attacker to drain the contract."
        );
      } else {
        setStatus(
          "Withdraw blocked — only the owner can withdraw (access control working)."
        );
      }
    } catch (err) {
      console.error(err);
      setStatus(
        "Withdraw blocked — only the owner can withdraw (access control working)."
      );
    } finally {
      refreshData();
      refreshKnownWalletBalances();
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
            Visualizing a reentrancy attack and a DoS-style bulk refund attack on a vulnerable
            crowdfunding smart contract (Hardhat local network). Use the role selector to view the
            flows as the attackers or honest users.
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "10px",
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid #1f2937",
                background: "#0b1120",
                display: "grid",
                gap: "8px",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 700 }}>
                Mode toggle
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {[
                  { key: "vulnerable", label: "🔓 Vulnerable" },
                  { key: "secure", label: "🔒 Secure" },
                ].map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setMode(option.key)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "10px",
                      border:
                        mode === option.key
                          ? "1px solid #22c55e"
                          : "1px solid #1f2937",
                      background:
                        mode === option.key
                          ? "rgba(34, 197, 94, 0.15)"
                          : "#0f172a",
                      color: "#e5e7eb",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>
                {mode === "vulnerable"
                  ? "Uses CrowdfundVulnerable — both attack panels remain fully exploitable."
                  : "Uses CrowdfundSecure — reentrancy mitigated and refundAll best-effort DoS resistance."}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.7 }}>
                Active crowdfund: <code>{crowdfundAddress}</code>
              </div>
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
              {Object.entries(roleOptions).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setSelectedRole(key)}
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    border:
                      selectedRole === key
                        ? "1px solid #22c55e"
                        : "1px solid #1f2937",
                    background:
                      selectedRole === key
                        ? "rgba(34, 197, 94, 0.1)"
                        : "#0f172a",
                    color: "#e5e7eb",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                    {value.label}
                  </div>
                  <div style={{ fontSize: "12px", opacity: 0.8 }}>
                    {shortenedAddress(value.address)}
                  </div>
                </button>
              ))}
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
              🏦 Crowdfund ({mode === "vulnerable" ? "🔓 Vulnerable" : "🔒 Secure"})
            </h2>
            <p style={{ fontSize: "12px", opacity: 0.8, marginBottom: "10px" }}>
              {mode === "vulnerable"
                ? "Goal must NOT be reached for the attack. Refund logic is intentionally vulnerable so both attack panels keep working."
                : "Hardened contract uses checks-effects-interactions and best-effort bulk refunds. Try the same attacks to see why they fail."}
            </p>
            <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "10px" }}>
              {mode === "vulnerable"
                ? "Access control: ✗ Anyone can withdraw (Attack 3 exploitable)."
                : "Access control: ✓ Only owner can withdraw (Attack 3 blocked)."}
            </div>

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
              <div>
                👑 Owner: {crowdfundOwner ? shortenedAddress(crowdfundOwner) : "—"}
              </div>
              <div>🎯 Goal: {goal} ETH</div>
              <div>📈 Total raised: {totalRaised} ETH</div>
              <div>💰 Contract balance: {crowdfundBalance} ETH</div>
            </div>

            <div
              style={{
                background: "#0b1120",
                borderRadius: 8,
                padding: 12,
                border: "1px solid #1f2937",
                marginBottom: 12,
                fontSize: 12,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 700 }}>Defense status</div>
              <div>
                Reentrancy protection:{" "}
                {mode === "vulnerable"
                  ? "❌ state updates happen after sending ETH"
                  : "✅ CEI + nonReentrant guard before sending ETH"}
              </div>
              <div>
                Global refund DoS resistance:{" "}
                {mode === "vulnerable"
                  ? "❌ single revert blocks the entire refundAll loop"
                  : "✅ failed refunds emit RefundFailed and loop continues"}
              </div>
              <div>
                Refund pattern:{" "}
                {mode === "vulnerable"
                  ? "❌ push pattern – bulk sends without checks"
                  : "✅ safer pull-first with best-effort bulk option"}
              </div>
            </div>

            <h3 style={{ marginTop: 24, marginBottom: 8 }}>Contributors</h3>
            <div
              style={{
                background: "#020617",
                borderRadius: 8,
                padding: 12,
                border: "1px solid #1f2937",
                maxHeight: 220,
                overflowY: "auto",
                fontSize: 12,
              }}
            >
              {contributors.length === 0 && (
                <div style={{ color: "#9ca3af" }}>No contributions yet.</div>
              )}

              {contributors.map((c) => (
                <div
                  key={c.address}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    borderBottom: "1px solid #111827",
                  }}
                >
                  <span
                    style={{
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.address}
                  </span>
                  <span>{c.amountEth.toFixed(4)} ETH</span>
                </div>
              ))}
            </div>

            <button
              onClick={async () => {
                if (!crowdfund) return;
                try {
                  setStatus(
                    mode === "vulnerable"
                      ? "Calling refundAll()… (expected to revert if DoS attacker joined)"
                      : "Calling refundAll() with best-effort refunds…"
                  );
                  const tx = await crowdfund.refundAll();
                  await tx.wait();
                  setStatus(
                    mode === "vulnerable"
                      ? "refundAll() succeeded unexpectedly ✅"
                      : "refundAll() completed (DoS attacker could not block everyone) ✅"
                  );
                  await refreshData();
                } catch (err) {
                  console.error(err);
                  // This is where the DoS by Attack 2 is visible
                  setStatus(
                    mode === "vulnerable"
                      ? "refundAll() reverted ❌ – DoS attacker blocked everyone"
                      : "refundAll() hit a failure but loop continued – check RefundFailed events"
                  );
                  await refreshData();
                }
              }}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "none",
                background: "#f97316",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try Global Refund (refundAll)
            </button>

            <div style={{ fontSize: "13px", marginBottom: "4px" }}>
              Contribute (any account – Honest Users 1 & 2 share this flow)
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
              ⚔️ Attack 1 – Reentrancy on Refund (Attacker 1)
            </h2>
            <p style={{ fontSize: "12px", opacity: 0.8, marginBottom: "10px" }}>
              Four-step attack: fund attacker contract → contribute from contract → run reentrancy → withdraw loot. Keep this
              flow untouched for Attacker 1. {" "}
              {mode === "vulnerable"
                ? "In vulnerable mode, the refund sends before zeroing out, so the loop drains funds."
                : "In secure mode, state is cleared before sending, so the reentrancy loop should fail."}
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
              <div>🧨 Attack 1 contract balance: {attackerContractBalance} ETH</div>
              <div>🧍 Attacker 1 EOA balance: {attackerEOABalance} ETH</div>
            </div>

            
            <div style={{ display: "grid", gap: "10px" }}>
              <div>
                <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                  Step 1: Deposit / Fund Attacker Contract
                </div>
                <input
                  value={attackerFundingAmount}
                  onChange={(e) => setAttackerFundingAmount(e.target.value)}
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
                  Deposit / Fund Attacker Contract
                </button>
              </div>

              <div>
                <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                  Step 2: Contribute From Attacker Contract → Crowdfund
                </div>
                <div style={{ fontSize: "11px", opacity: 0.75, marginBottom: "6px" }}>
                  Use the SAME amount here and in Step 3. This value must already sit in the attacker
                  contract from Step 1.
                </div>
                <input
                  value={attackerContributionAmount}
                  onChange={(e) => setAttackerContributionAmount(e.target.value)}
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
                  onClick={handleContributeFromAttacker}
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
                  Contribute From Attacker Contract → Crowdfund
                </button>
              </div>

              <div>
                <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                  Step 3: Run Attack (reentrancy)
                </div>

                <div style={{ fontSize: "11px", opacity: 0.75, marginBottom: "6px" }}>
                  Enter the SAME amount used in Step 2. Run with msg.value = 0 (no extra ETH should be sent).
                </div>
                <input
                  value={attackAmount}
                  onChange={(e) => setAttackAmount(e.target.value)}
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
                  Step 4: Withdraw loot to attacker wallet
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
                    onClick={refreshKnownWalletBalances}
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
                    Refresh Attacker Wallet Balances
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Attack 3 card */}
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
              ⚔️ Attack 3 – Unauthorized Withdraw (Broken Access Control)
            </h2>
            <p style={{ fontSize: "12px", opacity: 0.8, marginBottom: "10px" }}>
              Uses the currently selected attacker role to call <code>withdraw()</code> directly. In vulnerable mode, anyone can
              drain the crowdfund. In secure mode, the owner check should block the call.
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
              <div>
                Selected role: {selectedAttackerAddress ? selectedRoleLabel : "Pick Attacker 1 or Attacker 2"}
              </div>
              <div>
                Attacker wallet: {selectedAttackerAddress ? shortenedAddress(selectedAttackerAddress) : "N/A"}
              </div>
              <div>
                Attacker balance: {selectedAttackerBalance ?? "N/A"} ETH
              </div>
              <div>Crowdfund balance: {crowdfundBalance} ETH</div>
            </div>

            <button
              onClick={handleUnauthorizedWithdraw}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "10px",
                border: "none",
                background: "#facc15",
                color: "#020617",
                fontWeight: 700,
                cursor: "pointer",
                marginBottom: "8px",
              }}
            >
              Try Unauthorized Withdraw
            </button>
            <div style={{ fontSize: "12px", opacity: 0.75 }}>
              {mode === "vulnerable"
                ? "Expected: succeeds and drains contract (no access control)."
                : "Expected: reverts with Not owner (access control enforced)."}
            </div>
          </div>

          {/* Attack 2 card */}
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
              🚫 Attack 2 – DoS on refundAll (Attacker 2)
            </h2>
            <p style={{ fontSize: "12px", opacity: 0.8, marginBottom: "10px" }}>
              Join the crowdfund with a small contribution, then trigger <code>refundAll()</code> so the attacker\'s
              reverting fallback blocks the loop. This is independent from Attack 1. {" "}
              {mode === "vulnerable"
                ? "In vulnerable mode the revert DoS should block everyone."
                : "In secure mode the loop keeps going and emits RefundFailed for any reverting address."}.
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
              <div>🛑 Attack 2 contract balance: {attack2ContractBalance} ETH</div>
              <div>🧍 Attacker 2 wallet balance: {attacker2EOABalance} ETH</div>
              <div>📌 Attack 2 contribution recorded: {attack2CrowdfundContribution} ETH</div>
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              <div>
                <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                  Step 0: Fund Attack 2 Contract
                </div>
                <div style={{ fontSize: "11px", opacity: 0.75, marginBottom: "6px" }}>
                  Send ETH from Attacker 2 EOA into the Attack 2 contract so it can
                  contribute on-chain.
                </div>
                <input
                  value={attack2FundingAmount}
                  onChange={(e) => setAttack2FundingAmount(e.target.value)}
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
                  onClick={handleAttack2Fund}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #1f2937",
                    background: "#22c55e",
                    color: "#020617",
                    fontWeight: 700,
                    cursor: "pointer",
                    marginBottom: "8px",
                  }}
                >
                  Fund Attack 2 Contract
                </button>
              </div>

              <div>
                <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                  Step 1: Join Crowdfund as DoS Attacker
                </div>
                <div style={{ fontSize: "11px", opacity: 0.75, marginBottom: "6px" }}>
                  Sends a small amount from the Attack 2 contract so it appears in the contributors list.
                </div>
                <input
                  value={attack2JoinAmount}
                  onChange={(e) => setAttack2JoinAmount(e.target.value)}
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
                  onClick={handleAttack2Join}
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
                  Join Crowdfund (Attack 2)
                </button>
              </div>

              <div>
                <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                  Step 2: Trigger refundAll() (DoS)
                </div>
                <div style={{ fontSize: "11px", opacity: 0.75, marginBottom: "6px" }}>
                  Calls the vulnerable bulk refund loop. The reverting fallback should block all refunds.
                </div>
                <button
                  onClick={handleAttack2BlockRefunds}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#f97316",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: "8px",
                  }}
                >
                  Trigger refundAll() (expected to revert)
                </button>
              </div>

              <div>
                <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                  Step 3: Withdraw from Attack 2 contract
                </div>
                <div style={{ fontSize: "11px", opacity: 0.75, marginBottom: "6px" }}>
                  Optional cleanup for any ETH sent directly to the attacker contract.
                </div>
                <button
                  onClick={handleAttack2Withdraw}
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
                  Withdraw (Attack 2)
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
                    onClick={refreshKnownWalletBalances}
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
                    Refresh Attacker Wallet Balances
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
