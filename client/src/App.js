import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { applyBrandTheme } from "./theme";

const BRAND_LOGO =
  "https://cdn.builder.io/api/v1/image/assets%2Fd70091a6f5494e0195b033a72f7e79ae%2Fbcf60e97978040f8b093caea61156022?format=webp&width=800";

const TOKENS = [
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "ETH", name: "Ether" },
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "kUSD", name: "Keeta USD" },
];

const TOKEN_ICON_PATHS = {
  usdc: "/tokens/usdc.svg",
  sol: "/tokens/sol.svg",
  eth: "/tokens/eth.svg",
  btc: "/tokens/btc.svg",
  kusd: "/tokens/kusd.svg",
};

const POOLS = [
  { id: "USDC-SOL", tokenA: "USDC", tokenB: "SOL", apr: "18.4%", tvl: "$8.4M" },
  { id: "ETH-BTC", tokenA: "ETH", tokenB: "BTC", apr: "14.1%", tvl: "$6.1M" },
  { id: "kUSD-SOL", tokenA: "kUSD", tokenB: "SOL", apr: "11.8%", tvl: "$2.9M" },
  { id: "USDC-kUSD", tokenA: "USDC", tokenB: "kUSD", apr: "9.4%", tvl: "$1.9M" },
];

function SwapIcon() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
    >
      <path
        d="M7 7h11M7 7l3-3M7 7l3 3M17 17H6m11 0l-3-3m3 3l-3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowTopRight() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M7 17L17 7M17 7H9M17 7V15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getTokenIconUrl(symbol) {
  const key = String(symbol || "").toLowerCase();
  return TOKEN_ICON_PATHS[key] || "/tokens/default.svg";
}

const FALLBACK_TOKEN_ICON = "/tokens/default.svg";

function TokenBadge({ symbol }) {
  const [errored, setErrored] = useState(false);
  useEffect(() => setErrored(false), [symbol]);
  const src = errored ? FALLBACK_TOKEN_ICON : getTokenIconUrl(symbol);
  return (
    <img
      className="token-img"
      src={src}
      alt={`${symbol} logo`}
      onError={() => {
        if (!errored) {
          setErrored(true);
        }
      }}
    />
  );
}

function TokenSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const lower = query.toLowerCase();
    return options.filter(
      (option) =>
        option.symbol.toLowerCase().includes(lower) ||
        option.name.toLowerCase().includes(lower)
    );
  }, [options, query]);

  const closePopover = () => {
    setOpen(false);
    setQuery("");
  };

  const handleSelect = (symbol) => {
    onChange(symbol);
    closePopover();
  };

  return (
    <div className="token-select" data-open={open}>
      <button
        type="button"
        className="token-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="token-trigger-icon">
          <TokenBadge symbol={value} />
        </span>
        <span className="token-trigger-symbol">{value}</span>
      </button>
      {open && (
        <div className="token-popover" role="listbox">
          <input
            className="token-search"
            placeholder="Search token"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="token-list">
            {filtered.map((option) => (
              <button
                key={option.symbol}
                type="button"
                className={`token-item${
                  option.symbol === value ? " is-active" : ""
                }`}
                onClick={() => handleSelect(option.symbol)}
              >
                <span className="token-icon">
                  <TokenBadge symbol={option.symbol} />
                </span>
                <div className="token-info">
                  <span className="token-symbol">{option.symbol}</span>
                  <span className="token-name">{option.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ view, onNavigate }) {
  const handleNav = (target, path, scrollTarget) => (event) => {
    event.preventDefault();
    onNavigate(target, path, scrollTarget);
  };

  return (
    <header className="site-header">
      <nav className="top-nav">
        <a href="/" className="brand" onClick={handleNav("swap", "/", "swap")}>
          <img src={BRAND_LOGO} alt="Silverback" className="brand-mark" />
          <span className="brand-word">SILVERBACK</span>
        </a>
        <div className="nav-pill">
          <a
            href="/"
            className={`nav-pill-item${view === "swap" ? " is-active" : ""}`}
            onClick={handleNav("swap", "/", "swap")}
          >
            Swap
          </a>
          <a
            href="/pools"
            className={`nav-pill-item${view === "pools" ? " is-active" : ""}`}
            onClick={handleNav("pools", "/pools", "pools")}
          >
            Pools
          </a>
          <a
            href="/#stats"
            className="nav-pill-item"
            onClick={handleNav("swap", "/", "stats")}
          >
            Stats
          </a>
        </div>
        <div className="nav-actions">
          <button className="link-action" type="button">
            Docs
          </button>
          <button className="connect-button" type="button">
            Connect
          </button>
        </div>
      </nav>
    </header>
  );
}

function Footer({ onNavigate }) {
  const handleNav = (target, path, scrollTarget) => (event) => {
    if (!onNavigate) {
      return;
    }
    event.preventDefault();
    onNavigate(target, path, scrollTarget);
  };

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <img src={BRAND_LOGO} alt="Silverback" className="brand-mark" />
          <div>
            <div className="brand-word">SILVERBACK</div>
            <p className="footer-tagline">The native DEX of the Keeta ecosystem.</p>
          </div>
        </div>
        <div className="footer-links">
          <a href="/" onClick={handleNav("swap", "/", "swap")}>
            Swap
          </a>
          <a href="/pools" onClick={handleNav("pools", "/pools", "pools")}>
            Pools
          </a>
          <a href="/#stats" onClick={handleNav("swap", "/", "stats")}>
            Stats
          </a>
        </div>
        <span className="footer-copy">© {new Date().getFullYear()} Silverback Labs</span>
      </div>
    </footer>
  );
}

function SwapPage({ wallet, onWalletChange, onNavigate }) {
  const [fromAsset, setFromAsset] = useState("USDC");
  const [toAsset, setToAsset] = useState("kUSD");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [status, setStatus] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [slippageOpen, setSlippageOpen] = useState(false);

  const tokenOptions = TOKENS;

  const heroStats = useMemo(
    () => [
      { label: "24h Volume", value: "₭0" },
      { label: "Total TVL", value: "₭0" },
      { label: "Markets", value: "0" },
    ],
    []
  );

  const prices = useMemo(
    () => ({
      USDC: 1,
      SOL: 150,
      ETH: 3200,
      BTC: 65000,
      kUSD: 1,
    }),
    []
  );

  const balances = useMemo(() => {
    const next = {};
    tokenOptions.forEach((token) => {
      next[token.symbol] = 0;
    });
    return next;
  }, [tokenOptions]);

  useEffect(() => {
    const parsed = parseFloat(fromAmount);
    if (!Number.isNaN(parsed) && prices[fromAsset] && prices[toAsset]) {
      const usdValue = parsed * prices[fromAsset];
      const output = usdValue / prices[toAsset];
      setToAmount(output ? output.toString() : "");
    } else if (fromAmount === "") {
      setToAmount("");
    }
  }, [fromAmount, fromAsset, toAsset, prices]);

  const handleSwap = async () => {
    if (!fromAmount) {
      setStatus("Enter an amount to swap");
      return;
    }
    if (!wallet) {
      setStatus("Enter a wallet address");
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
          amount: fromAmount,
          wallet,
          slippage,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const txHash = data?.tx?.hash || data?.tx?.id || "submitted";
        setStatus(`Swap complete ✅ TX: ${txHash}`);
      } else {
        setStatus(`Error: ${data.error || "Swap failed"}`);
      }
    } catch (err) {
      setStatus(`Request failed: ${err.message}`);
    }
  };

  const flipDirection = () => {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const feeBps = 30;

  const handleHeroNavigate = (target, path, scrollTarget) => {
    if (!onNavigate) return;
    onNavigate(target, path, scrollTarget);
  };

  return (
    <main className="page" id="swap">
      <section className="hero-section">
        <div className="hero-grid">
          <div className="hero-content">
            <span className="eyebrow">Keeta Liquidity Layer</span>
            <h1 className="hero-heading">Swap at apex speed with Silverback.</h1>
            <p className="hero-subtitle">
              Deep liquidity, MEV-aware routing, and a premium trading experience built for
              the Keeta ecosystem.
            </p>
            <div className="hero-actions">
              <button
                type="button"
                className="primary-cta"
                onClick={() => handleHeroNavigate("swap", "/", "swap-panel")}
              >
                Start swapping
              </button>
              <button
                type="button"
                className="ghost-cta"
                onClick={() => handleHeroNavigate("pools", "/pools", "pools")}
              >
                View pools
              </button>
            </div>
            <div className="metric-row" id="stats">
              {heroStats.map((item) => (
                <div className="metric-card" key={item.label}>
                  <span className="metric-label">{item.label}</span>
                  <span className="metric-value">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-panel" id="swap-panel">
            <div className="swap-card">
              <div className="swap-card-header">
                <div className="swap-card-title">
                  <span className="swap-chip">Classic</span>
                  <h2>Swap</h2>
                </div>
                <button
                  type="button"
                  className="slippage-chip"
                  aria-label="Adjust slippage"
                  onClick={() => setSlippageOpen((open) => !open)}
                >
                  {slippage}%
                </button>
              </div>

              {slippageOpen && (
                <div className="slippage-popover">
                  <div className="slip-row">
                    {[0.1, 0.5, 1].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`slip-btn${value === slippage ? " is-active" : ""}`}
                        onClick={() => {
                          setSlippage(value);
                          setSlippageOpen(false);
                        }}
                      >
                        {value}%
                      </button>
                    ))}
                    <div className="slip-custom">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={slippage}
                        onChange={(event) =>
                          setSlippage(parseFloat(event.target.value) || 0)
                        }
                      />
                      <span>%</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="swap-stack">
                <div className="swap-row">
                  <div className="field-group">
                    <label className="field-label" htmlFor="swap-from-token">
                      Sell token
                    </label>
                    <TokenSelect
                      value={fromAsset}
                      onChange={setFromAsset}
                      options={tokenOptions}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="swap-from-amount">
                      Amount
                    </label>
                    <div className="amount-field">
                      <input
                        id="swap-from-amount"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={fromAmount}
                        onChange={(event) => setFromAmount(event.target.value)}
                      />
                      <button
                        type="button"
                        className="small-action"
                        onClick={() => setFromAmount("100")}
                      >
                        MAX
                      </button>
                    </div>
                    <div className="balance-line">
                      Balance: {balances[fromAsset]?.toFixed(2)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="direction-toggle"
                  onClick={flipDirection}
                  aria-label="Switch direction"
                >
                  <SwapIcon />
                </button>

                <div className="swap-row">
                  <div className="field-group">
                    <label className="field-label" htmlFor="swap-to-token">
                      Buy token
                    </label>
                    <TokenSelect
                      value={toAsset}
                      onChange={setToAsset}
                      options={tokenOptions}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="swap-to-amount">
                      Amount
                    </label>
                    <div className="amount-field">
                      <input
                        id="swap-to-amount"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={toAmount}
                        onChange={(event) => setToAmount(event.target.value)}
                      />
                    </div>
                    <div className="balance-line">
                      1 {fromAsset} ≈ {(prices[fromAsset] / prices[toAsset]).toFixed(6)} {toAsset}
                    </div>
                  </div>
                </div>
              </div>

              <div className="info-rows">
                <div className="info-line">Price impact: 0.00%</div>
                <div className="info-line">Est. fees: {(feeBps / 100).toFixed(2)}%</div>
                <div className="route-line">Route: {fromAsset} → {toAsset}</div>
              </div>

              <div className="field-group wallet-group">
                <label className="field-label" htmlFor="wallet-input">
                  Wallet
                </label>
                <input
                  id="wallet-input"
                  type="text"
                  placeholder="wallet address"
                  value={wallet}
                  onChange={(event) => onWalletChange(event.target.value)}
                />
              </div>

              <button type="button" className="primary-cta full" onClick={handleSwap}>
                Swap
              </button>

              {status && <p className="status">{status}</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="market-section">
        <div className="section-header">
          <div>
            <span className="eyebrow">Featured markets</span>
            <h2>Discover deep liquidity pairs</h2>
            <p className="section-subtitle">
              Deploy capital into the highest performing pools backed by Silverback routing.
            </p>
          </div>
          <button
            type="button"
            className="ghost-cta"
            onClick={() => handleHeroNavigate("pools", "/pools", "pools")}
          >
            Explore pools
          </button>
        </div>
        <div className="pool-grid">
          {POOLS.map((pool) => (
            <article className="pool-card" key={pool.id}>
              <div className="pool-card-head">
                <div className="pool-token-icons">
                  <span className="token-icon token-icon-lg">
                    <TokenBadge symbol={pool.tokenA} />
                  </span>
                  <span className="token-icon token-icon-lg">
                    <TokenBadge symbol={pool.tokenB} />
                  </span>
                </div>
                <span className="pool-pair">{pool.tokenA}/{pool.tokenB}</span>
              </div>
              <div className="pool-card-body">
                <div className="pool-metric">
                  <span className="metric-label">APR</span>
                  <span className="metric-value">{pool.apr}</span>
                </div>
                <div className="pool-metric">
                  <span className="metric-label">TVL</span>
                  <span className="metric-value">{pool.tvl}</span>
                </div>
              </div>
              <button
                type="button"
                className="pill-link"
                onClick={() => handleHeroNavigate("pools", "/pools", "pools")}
              >
                Manage position <ArrowTopRight />
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function PoolsPage({ wallet, onWalletChange }) {
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
          body: JSON.stringify({
            tokenA: selectedPool.tokenA,
            tokenB: selectedPool.tokenB,
          }),
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
    <main className="page pools-page" id="pools">
      <section className="pools-hero">
        <div className="hero-content">
          <span className="eyebrow">Liquidity Network</span>
          <h1 className="hero-heading">Deploy liquidity with confidence.</h1>
          <p className="hero-subtitle">
            Choose high performing pools, monitor reserves in real-time, and manage LP
            tokens from a single dashboard.
          </p>
        </div>
      </section>

      <section className="pools-layout-section">
        <div className="pools-layout">
          <aside className="pool-selector">
            <h2 className="section-title">Available Pools</h2>
            <div className="pool-selector-list">
              {POOLS.map((pool) => (
                <button
                  type="button"
                  key={pool.id}
                  className={`pool-selector-card${selectedPoolId === pool.id ? " is-active" : ""}`}
                  onClick={() => setSelectedPoolId(pool.id)}
                >
                  <div className="pool-card-head">
                    <div className="pool-token-icons">
                      <span className="token-icon">
                        <TokenBadge symbol={pool.tokenA} />
                      </span>
                      <span className="token-icon">
                        <TokenBadge symbol={pool.tokenB} />
                      </span>
                    </div>
                    <span className="pool-pair">{pool.tokenA}/{pool.tokenB}</span>
                  </div>
                  <div className="pool-card-body">
                    <div className="pool-metric">
                      <span className="metric-label">APR</span>
                      <span className="metric-value">{pool.apr}</span>
                    </div>
                    <div className="pool-metric">
                      <span className="metric-label">TVL</span>
                      <span className="metric-value">{pool.tvl}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <div className="pool-detail">
            <div className="swap-card pool-overview">
              <div className="swap-card-header">
                <div className="swap-card-title">
                  <h2>{selectedPool.tokenA}/{selectedPool.tokenB}</h2>
                  <span className="swap-chip">Pool overview</span>
                </div>
                <div className="overview-metrics">
                  <div>
                    <span className="metric-label">APR</span>
                    <span className="metric-value">{selectedPool.apr}</span>
                  </div>
                  <div>
                    <span className="metric-label">TVL</span>
                    <span className="metric-value">{selectedPool.tvl}</span>
                  </div>
                </div>
              </div>
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

            <div className="dual-card">
              <div className="swap-card liquidity-card">
                <h3>Add Liquidity</h3>
                <div className="field-group">
                  <span className="field-label">Amount {selectedPool.tokenA}</span>
                  <input
                    value={amountA}
                    onChange={(event) => setAmountA(event.target.value)}
                    placeholder="0.0"
                    type="number"
                  />
                </div>
                <div className="field-group">
                  <span className="field-label">Amount {selectedPool.tokenB}</span>
                  <input
                    value={amountB}
                    onChange={(event) => setAmountB(event.target.value)}
                    placeholder="0.0"
                    type="number"
                  />
                </div>
                <div className="field-group">
                  <span className="field-label">Wallet</span>
                  <input
                    value={wallet}
                    onChange={(event) => onWalletChange(event.target.value)}
                    placeholder="wallet address"
                  />
                </div>
                <button type="button" className="primary-cta full" onClick={handleAddLiquidity}>
                  Supply liquidity
                </button>
                {addStatus && <p className="status">{addStatus}</p>}
              </div>

              <div className="swap-card liquidity-card">
                <h3>Remove Liquidity</h3>
                <div className="field-group">
                  <span className="field-label">LP Tokens to burn</span>
                  <input
                    value={lpAmount}
                    onChange={(event) => setLpAmount(event.target.value)}
                    placeholder="0.0"
                    type="number"
                  />
                </div>
                <div className="field-group">
                  <span className="field-label">Wallet</span>
                  <input
                    value={wallet}
                    onChange={(event) => onWalletChange(event.target.value)}
                    placeholder="wallet address"
                  />
                </div>
                <button type="button" className="ghost-cta full" onClick={handleRemoveLiquidity}>
                  Withdraw liquidity
                </button>
                {removeStatus && <p className="status">{removeStatus}</p>}
              </div>
            </div>
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
  const [wallet, setWallet] = useState("test-wallet");

  const scrollToSection = (id) => {
    if (typeof window === "undefined") return;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    applyBrandTheme(BRAND_LOGO).catch(() => {
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

  const handleNavigate = (target, path, scrollTarget) => {
    if (typeof window !== "undefined") {
      if (window.location.pathname !== path) {
        window.history.pushState({}, "", path);
      }
      setView(target);
      if (scrollTarget) {
        setTimeout(() => {
          scrollToSection(scrollTarget);
        }, 50);
      }
    }
  };

  return (
    <div className="app">
      <div className="site-shell">
        <Header view={view} onNavigate={handleNavigate} />
        {view === "pools" ? (
          <PoolsPage wallet={wallet} onWalletChange={setWallet} />
        ) : (
          <SwapPage wallet={wallet} onWalletChange={setWallet} onNavigate={handleNavigate} />
        )}
        <Footer onNavigate={handleNavigate} />
      </div>
    </div>
  );
}

export default App;
