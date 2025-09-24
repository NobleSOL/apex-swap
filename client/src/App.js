import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import logo from "./ApeX-logo.png";
import { applyBrandTheme } from "./theme";

const TOKENS = [
  { symbol: "APE", name: "ApeX Token" },
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "ETH", name: "Ether" },
  { symbol: "BTC", name: "Wrapped Bitcoin" },
];

const POOLS = [
  { id: "APE-USDC", tokenA: "APE", tokenB: "USDC", apr: "18.4%", tvl: "$2.3M" },
  { id: "APE-ETH", tokenA: "APE", tokenB: "ETH", apr: "14.1%", tvl: "$1.1M" },
  { id: "ETH-USDC", tokenA: "ETH", tokenB: "USDC", apr: "9.8%", tvl: "$3.7M" },
  { id: "BTC-USDC", tokenA: "BTC", tokenB: "USDC", apr: "6.2%", tvl: "$4.9M" },
];

function Header({ view, onNavigate }) {
  const handleNav = (target, path) => (event) => {
    event.preventDefault();
    onNavigate(target, path);
  };

  return (
    <header className="top-nav">
      <div className="brand-wrap">
        <img src={logo} alt="ApeX" className="logo" />
        <span className="brand-name">ApeX Swap</span>
      </div>
      <nav className="nav-links">
        <a
          href="/"
          className={`nav-link${view === "swap" ? " is-active" : ""}`}
          onClick={handleNav("swap", "/")}
        >
          Swap
        </a>
        <a
          href="/pools"
          className={`nav-link${view === "pools" ? " is-active" : ""}`}
          onClick={handleNav("pools", "/pools")}
        >
          Pools
        </a>
      </nav>
      <div className="nav-right">
        <span className="network-chip">Keeta Testnet</span>
        <button className="connect-button" type="button">
          Connect Wallet
        </button>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <span>© {new Date().getFullYear()} ApeX Labs</span>
        <div>
          <a href="https://apex.exchange" target="_blank" rel="noreferrer">
            Docs
          </a>
          <a href="https://twitter.com" target="_blank" rel="noreferrer">
            Twitter
          </a>
          <a href="https://discord.com" target="_blank" rel="noreferrer">
            Discord
          </a>
        </div>
      </div>
    </footer>
  );
}

function SwapPage() {
  const [fromAsset, setFromAsset] = useState("APE");
  const [toAsset, setToAsset] = useState("USDC");
  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState("test-wallet");
  const [status, setStatus] = useState("");

  const heroStats = useMemo(
    () => [
      { label: "24h Volume", value: "$1.42M" },
      { label: "Best Route Savings", value: "$32.4K" },
      { label: "Supported Assets", value: `${TOKENS.length}+` },
    ],
    []
  );

  const handleSwap = async () => {
    if (!amount) {
      setStatus("Enter an amount to swap");
      return;
    }

    setStatus("Processing swap...");

    try {
      const res = await fetch("/.netlify/functions/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAsset,
          to: toAsset,
          amount,
          wallet,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const txHash = data?.tx?.hash || data?.tx?.id || "submitted";
        setStatus(`Swap complete ✅ TX: ${txHash}, Output: ${data.outputAmount} ${toAsset}`);
      } else {
        setStatus(`Error: ${data.error || "Swap failed"}`);
      }
    } catch (err) {
      setStatus(`Request failed: ${err.message}`);
    }
  };

  const handleFlip = () => {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
  };

  return (
    <main className="content-container">
      <section className="hero-banner">
        <h1 className="hero-title">Swap instantly with deep ApeX liquidity</h1>
        <p className="hero-subtitle">
          Execute cross-chain swaps and synthetic trades with institutional-grade routing.
        </p>
        <div className="stats-strip">
          {heroStats.map((item) => (
            <div className="stat-item" key={item.label}>
              <div className="stat-label">{item.label}</div>
              <div className="stat-value">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="swap-section">
        <div className="swap-box">
          <div className="swap-header">
            <div className="swap-controls">
              <button className="icon-button" type="button" aria-label="Refresh quotes">
                ↻
              </button>
              <div className="slippage-chip">Slippage 0.5%</div>
            </div>
          </div>

          <div className="pair-stack">
            <div className="row-header">Sell</div>
            <div className="pair-row">
              <div className="token-col">
                <div className="token-select">
                  <span className="token-symbol">{fromAsset}</span>
                  <select value={fromAsset} onChange={(e) => setFromAsset(e.target.value)}>
                    {TOKENS.map((token) => (
                      <option key={token.symbol} value={token.symbol}>
                        {token.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="amount-col">
                <div className="amount-field">
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    type="number"
                  />
                  <button className="small-action" type="button" onClick={() => setAmount("100")}>
                    MAX
                  </button>
                </div>
              </div>
            </div>

            <div className="toggle-row">
              <div className="hr-line" />
              <button className="direction-toggle" type="button" onClick={handleFlip} aria-label="Switch pair">
                ⇅
              </button>
              <div className="hr-line" />
            </div>

            <div className="row-header">Buy</div>
            <div className="pair-row">
              <div className="token-col">
                <div className="token-select">
                  <span className="token-symbol">{toAsset}</span>
                  <select value={toAsset} onChange={(e) => setToAsset(e.target.value)}>
                    {TOKENS.map((token) => (
                      <option key={token.symbol} value={token.symbol}>
                        {token.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="amount-col">
                <div className="field-group">
                  <div className="balance-line">Best route via ApeX Pools</div>
                  <div className="route-line">Est. output updates after quote</div>
                </div>
              </div>
            </div>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="wallet-input">
              Wallet
            </label>
            <input
              id="wallet-input"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="wallet address"
              type="text"
            />
          </div>

          <div className="submit-row">
            <button className="primary-cta" type="button" onClick={handleSwap}>
              Review Swap
            </button>
          </div>

          {status && <p className="status">{status}</p>}
        </div>
      </section>
    </main>
  );
}

function PoolsPage() {
  const [selectedPoolId, setSelectedPoolId] = useState(POOLS[0].id);
  const selectedPool = useMemo(
    () => POOLS.find((pool) => pool.id === selectedPoolId) || POOLS[0],
    [selectedPoolId]
  );

  const [poolStats, setPoolStats] = useState(null);
  const [poolStatus, setPoolStatus] = useState("");
  const [loadingPool, setLoadingPool] = useState(false);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [lpAmount, setLpAmount] = useState("");
  const [wallet, setWallet] = useState("test-wallet");
  const [addStatus, setAddStatus] = useState("");
  const [removeStatus, setRemoveStatus] = useState("");

  useEffect(() => {
    let isMounted = true;
    const loadPool = async () => {
      setLoadingPool(true);
      setPoolStatus("");
      try {
        const res = await fetch("/.netlify/functions/getpool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokenA: selectedPool.tokenA, tokenB: selectedPool.tokenB }),
        });
        const data = await res.json();
        if (!isMounted) return;
        if (res.ok) {
          setPoolStats(data);
        } else {
          setPoolStatus(data.error || "Unable to load pool reserves");
        }
      } catch (err) {
        if (isMounted) {
          setPoolStatus(`Request failed: ${err.message}`);
        }
      } finally {
        if (isMounted) {
          setLoadingPool(false);
        }
      }
    };

    loadPool();
    return () => {
      isMounted = false;
    };
  }, [selectedPool]);

  const handleAddLiquidity = async () => {
    if (!amountA || !amountB) {
      setAddStatus("Enter amounts for both tokens");
      return;
    }
    setAddStatus("Submitting transaction...");
    try {
      const res = await fetch("/.netlify/functions/addLiquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenA: selectedPool.tokenA,
          tokenB: selectedPool.tokenB,
          amountA,
          amountB,
          wallet,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const txHash = data?.tx?.hash || data?.tx?.id || "submitted";
        setAddStatus(`Liquidity added ✅ TX: ${txHash}`);
        setAmountA("");
        setAmountB("");
      } else {
        setAddStatus(`Error: ${data.error || "Add liquidity failed"}`);
      }
    } catch (err) {
      setAddStatus(`Request failed: ${err.message}`);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!lpAmount) {
      setRemoveStatus("Enter an LP amount to burn");
      return;
    }
    setRemoveStatus("Submitting transaction...");
    try {
      const res = await fetch("/.netlify/functions/removeLiquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenA: selectedPool.tokenA,
          tokenB: selectedPool.tokenB,
          lpAmount,
          wallet,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const txHash = data?.tx?.hash || data?.tx?.id || "submitted";
        setRemoveStatus(
          `Liquidity removed ✅ TX: ${txHash} — Returned ${data.amountA} ${selectedPool.tokenA} & ${data.amountB} ${selectedPool.tokenB}`
        );
        setLpAmount("");
      } else {
        setRemoveStatus(`Error: ${data.error || "Remove liquidity failed"}`);
      }
    } catch (err) {
      setRemoveStatus(`Request failed: ${err.message}`);
    }
  };

  return (
    <main className="content-container">
      <section className="hero-banner">
        <h1 className="hero-title">Provide liquidity. Earn real yield.</h1>
        <p className="hero-subtitle">
          Supply assets into ApeX Pools to capture trading fees and protocol rewards.
        </p>
        <div className="stats-strip">
          {POOLS.map((pool) => (
            <div className="stat-item" key={pool.id}>
              <div className="stat-label">{pool.tokenA}/{pool.tokenB} APR</div>
              <div className="stat-value">{pool.apr}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="pools-section">
        <h2 className="section-title">Available Pools</h2>
        <div className="pools-grid">
          {POOLS.map((pool) => (
            <button
              type="button"
              key={pool.id}
              className={`pool-card${selectedPoolId === pool.id ? " is-active" : ""}`}
              onClick={() => setSelectedPoolId(pool.id)}
            >
              <div className="pool-pair">
                {pool.tokenA}/{pool.tokenB}
              </div>
              <div className="pool-metrics">
                <span>
                  <span className="metric-label">APR</span>
                  {pool.apr}
                </span>
                <span>
                  <span className="metric-label">TVL</span>
                  {pool.tvl}
                </span>
              </div>
              <div className="pool-cta">Manage position</div>
            </button>
          ))}
        </div>
      </section>

      <section className="swap-section">
        <div className="liquidity-panels">
          <div className="swap-box liquidity-box">
            <h2>Pool Overview</h2>
            <p className="balance-line">
              Selected pool: {selectedPool.tokenA}/{selectedPool.tokenB}
            </p>
            {loadingPool ? (
              <p className="status">Fetching reserves...</p>
            ) : poolStats ? (
              <div className="info-rows">
                <div className="info-line">
                  Reserves: {poolStats.reserveA} {selectedPool.tokenA} / {poolStats.reserveB} {selectedPool.tokenB}
                </div>
                <div className="info-line">Pool address: coming soon</div>
              </div>
            ) : (
              <p className="status">{poolStatus}</p>
            )}
          </div>

          <div className="swap-box liquidity-box">
            <h2>Add Liquidity</h2>
            <div className="field-group">
              <span className="field-label">Amount {selectedPool.tokenA}</span>
              <input
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                placeholder="0.0"
                type="number"
              />
            </div>
            <div className="field-group">
              <span className="field-label">Amount {selectedPool.tokenB}</span>
              <input
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                placeholder="0.0"
                type="number"
              />
            </div>
            <div className="field-group">
              <span className="field-label">Wallet</span>
              <input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="wallet address" />
            </div>
            <button type="button" className="primary-cta" onClick={handleAddLiquidity}>
              Supply liquidity
            </button>
            {addStatus && <p className="status">{addStatus}</p>}
          </div>

          <div className="swap-box liquidity-box">
            <h2>Remove Liquidity</h2>
            <div className="field-group">
              <span className="field-label">LP Tokens to Burn</span>
              <input
                value={lpAmount}
                onChange={(e) => setLpAmount(e.target.value)}
                placeholder="0.0"
                type="number"
              />
            </div>
            <div className="field-group">
              <span className="field-label">Wallet</span>
              <input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="wallet address" />
            </div>
            <button type="button" className="primary-cta" onClick={handleRemoveLiquidity}>
              Withdraw liquidity
            </button>
            {removeStatus && <p className="status">{removeStatus}</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [view, setView] = useState(() =>
    typeof window !== "undefined" && window.location.pathname.toLowerCase().includes("pools")
      ? "pools"
      : "swap"
  );

  useEffect(() => {
    applyBrandTheme(logo).catch(() => {
      /* ignore theme errors */
    });
  }, []);

  useEffect(() => {
    const handlePop = () => {
      const next = window.location.pathname.toLowerCase().includes("pools") ? "pools" : "swap";
      setView(next);
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const handleNavigate = (target, path) => {
    if (typeof window !== "undefined") {
      if (window.location.pathname !== path) {
        window.history.pushState({}, "", path);
      }
      setView(target);
    }
  };

  return (
    <div className="app">
      <div className="site-shell">
        <Header view={view} onNavigate={handleNavigate} />
        {view === "pools" ? <PoolsPage /> : <SwapPage />}
        <Footer />
      </div>
    </div>
  );
}

export default App;
