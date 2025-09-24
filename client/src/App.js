import { useEffect, useMemo, useState } from "react";
import "./App.css";
import logo from "./ApeX-logo.png";
import { applyBrandTheme } from "./theme";

function SwapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 7h11M7 7l3-3M7 7l3 3M17 17H6m11 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TokenIcon({ symbol }) {
  switch (symbol) {
    case "USDC":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#2775C9" />
          <text x="12" y="16" textAnchor="middle" fontSize="10" fill="#fff" fontFamily="system-ui">$</text>
        </svg>
      );
    case "SOL":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#00FFA3" />
          <circle cx="12" cy="12" r="6" fill="#9945FF" opacity="0.8" />
        </svg>
      );
    case "ETH":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#3C3C3D" />
          <path d="M12 5l4 7-4 2-4-2 4-7zm0 14l4-6-4 2-4-2 4 6z" fill="#fff" />
        </svg>
      );
    case "BTC":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#F2A900" />
          <text x="12" y="16" textAnchor="middle" fontSize="10" fill="#000" fontFamily="system-ui">₿</text>
        </svg>
      );
    case "kUSD":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#14B8A6" />
          <text x="12" y="16" textAnchor="middle" fontSize="9" fill="#001" fontFamily="system-ui">k$</text>
        </svg>
      );
    default:
      return null;
  }
}

function TokenSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  );
  return (
    <div className="token-select-wrap">
      <button type="button" className="token-pill" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="token-icon"><TokenIcon symbol={value} /></span>
        <span className="token-symbol">{value}</span>
      </button>
      {open && (
        <div className="token-popover" role="listbox">
          <input className="token-search" placeholder="Search token" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="token-list">
            {filtered.map((sym) => (
              <button key={sym} type="button" className={`token-item${sym === value ? " is-active" : ""}`} onClick={() => { onChange(sym); setOpen(false); }}>
                <span className="token-icon"><TokenIcon symbol={sym} /></span>
                <span className="token-symbol">{sym}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [fromAsset, setFromAsset] = useState("USDC");
  const [toAsset, setToAsset] = useState("kUSD");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    applyBrandTheme(logo).catch(() => {
      /* no-op */
    });
  }, []);

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

  const balances = useMemo(
    () => ({ USDC: 0, SOL: 0, ETH: 0, BTC: 0, kUSD: 0 }),
    []
  );

  useEffect(() => {
    const a = parseFloat(fromAmount);
    if (!isNaN(a) && prices[fromAsset] && prices[toAsset]) {
      const usd = a * prices[fromAsset];
      const out = usd / prices[toAsset];
      setToAmount(out ? String(out) : "");
    } else if (fromAmount === "") {
      setToAmount("");
    }
  }, [fromAmount, fromAsset, toAsset, prices]);

  const pools = useMemo(
    () => [
      { pair: "USDC / SOL", volume24h: "$1.2M", tvl: "$8.4M" },
      { pair: "ETH / BTC", volume24h: "$980k", tvl: "$6.1M" },
      { pair: "kUSD / SOL", volume24h: "$520k", tvl: "$2.7M" },
      { pair: "USDC / kUSD", volume24h: "$410k", tvl: "$1.9M" },
    ],
    []
  );

  const handleSwap = async () => {
    setStatus("Processing swap...");

    try {
      const res = await fetch("/.netlify/functions/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAsset,
          to: toAsset,
          amount: fromAmount,
          wallet: "user-wallet-address",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus(`Swap complete ✅ TX Hash: ${data.tx.hash}`);
      } else {
        setStatus(`Error: ${data.error}`);
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

  return (
    <div className="app">
      <div className="site-shell">
        <nav className="top-nav">
          <div className="brand-wrap">
            <img src={logo} alt="ApeX Logo" className="logo" />
            <span className="brand-name">ApeX</span>
          </div>
          <div className="nav-right">
            <div className="nav-links">
              <a href="#swap" className="nav-link">Swap</a>
              <a href="#pools" className="nav-link">Pools</a>
              <a href="#stats" className="nav-link">Stats</a>
            </div>
            <button className="connect-button">Connect</button>
          </div>
        </nav>

        <header className="hero-banner" id="stats">
          <h1 className="hero-title">Trade digital assets seamlessly</h1>
          <p className="hero-subtitle">Low slippage. Deep liquidity. Multi-chain.</p>
          <div className="stats-strip">
            <div className="stat-item">
              <div className="stat-label">24h Volume</div>
              <div className="stat-value">$0</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Total TVL</div>
              <div className="stat-value">$0</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Markets</div>
              <div className="stat-value">0</div>
            </div>
          </div>
        </header>

        <main className="content-container">
          <section className="swap-section" id="swap">
            <div className="swap-box">
              <div className="swap-header">
                <h2 className="swap-title">Swap</h2>
                <div className="swap-controls">
                  <button type="button" className="icon-button" aria-label="Settings">⚙</button>
                  <div className="slippage-chip" aria-label="Slippage">0.5%</div>
                </div>
              </div>

              <div className="pair-stack">
                <div className="row-header">Sell</div>
                <div className="pair-row">
                  <div className="token-col">
                    <label className="field-group">
                      <span className="field-label">Token</span>
                      <div className="token-select">
                        <span className="token-icon"><TokenIcon symbol={fromAsset} /></span>
                        <select value={fromAsset} onChange={(e) => setFromAsset(e.target.value)}>
                          <option value="USDC">USDC</option>
                          <option value="SOL">SOL</option>
                          <option value="ETH">ETH</option>
                        </select>
                      </div>
                    </label>
                  </div>
                  <div className="amount-col">
                    <label className="field-group">
                      <span className="field-label">Amount</span>
                      <div className="amount-field">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.0"
                          value={fromAmount}
                          onChange={(e) => setFromAmount(e.target.value)}
                        />
                      </div>
                      <div className="balance-line">Balance: {balances[fromAsset]?.toFixed(2)}</div>
                    </label>
                  </div>
                </div>

                <div className="toggle-row">
                  <div className="hr-line" />
                  <button type="button" className="direction-toggle" onClick={flipDirection} aria-label="Switch direction">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 7h11M7 7l3-3M7 7l3 3M17 17H6m11 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <div className="hr-line" />
                </div>

                <div className="row-header">Buy</div>
                <div className="pair-row">
                  <div className="token-col">
                    <label className="field-group">
                      <span className="field-label">Token</span>
                      <div className="token-select">
                        <span className="token-icon"><TokenIcon symbol={toAsset} /></span>
                        <select value={toAsset} onChange={(e) => setToAsset(e.target.value)}>
                          <option value="kUSD">kUSD</option>
                          <option value="BTC">BTC</option>
                          <option value="SOL">SOL</option>
                        </select>
                      </div>
                    </label>
                  </div>
                  <div className="amount-col">
                    <label className="field-group">
                      <span className="field-label">Amount</span>
                      <div className="amount-field">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.0"
                          value={toAmount}
                          onChange={(e) => setToAmount(e.target.value)}
                        />
                      </div>
                      <div className="balance-line">1 {fromAsset} ≈ {(prices[fromAsset] / prices[toAsset]).toFixed(6)} {toAsset}</div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="route-line">Route: {fromAsset} → {toAsset}</div>
              <div className="submit-row">
                <button className="primary-cta" onClick={handleSwap}>Swap</button>
              </div>

              {status && <p className="status">{status}</p>}
            </div>
          </section>

          <section className="pools-section" id="pools">
            <h3 className="section-title">Top Pools</h3>
            <div className="pools-grid">
              {pools.map((p) => (
                <div key={p.pair} className="pool-card">
                  <div className="pool-pair">{p.pair}</div>
                  <div className="pool-metrics">
                    <span className="metric"><span className="metric-label">24h:</span> {p.volume24h}</span>
                    <span className="metric"><span className="metric-label">TVL:</span> {p.tvl}</span>
                  </div>
                  <button className="pool-cta">Trade</button>
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="site-footer">
          <div className="footer-inner">
            <span>© {new Date().getFullYear()} ApeX</span>
            <div className="footer-links">
              <a href="#swap">Swap</a>
              <a href="#pools">Pools</a>
              <a href="#stats">Stats</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
