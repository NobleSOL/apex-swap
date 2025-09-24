import { useEffect, useMemo, useState } from "react";
import "./App.css";

const BRAND_LOGO = "https://cdn.builder.io/api/v1/image/assets%2Fd70091a6f5494e0195b033a72f7e79ae%2Fbcf60e97978040f8b093caea61156022?format=webp&width=800";

function SwapIcon() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
      <path d="M7 7h11M7 7l3-3M7 7l3 3M17 17H6m11 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const TOKEN_ICON_PATHS = {
  kusd: "/tokens/kusd.svg",
  ksol: "/tokens/sol.svg",
  keth: "/tokens/eth.svg",
  kbtc: "/tokens/btc.svg",
};

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
  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  );

  const closePopover = () => {
    setOpen(false);
    setQuery("");
  };

  const handleSelect = (sym) => {
    onChange(sym);
    closePopover();
  };

  return (
    <div className="token-select-wrap">
      <button
        type="button"
        className="token-pill"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="token-icon"><TokenBadge symbol={value} /></span>
        <span className="token-symbol">{value}</span>
      </button>
      {open && (
        <div className="token-popover" role="listbox">
          <input
            className="token-search"
            placeholder="Search token"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="token-list">
            {filtered.map((sym) => (
              <button
                key={sym}
                type="button"
                className={`token-item${sym === value ? " is-active" : ""}`}
                onClick={() => handleSelect(sym)}
              >
                <span className="token-icon"><TokenBadge symbol={sym} /></span>
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
  const [fromAsset, setFromAsset] = useState("kUSD");
  const [toAsset, setToAsset] = useState("kSOL");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [status, setStatus] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [slippageOpen, setSlippageOpen] = useState(false);
  const tokenOptions = useMemo(() => ["kUSD", "kSOL", "kETH", "kBTC"], []);


  const prices = useMemo(
    () => ({
      kUSD: 1,
      kSOL: 24,
      kETH: 320,
      kBTC: 6200,
    }),
    []
  );

  const feeBps = 30;

  const balances = useMemo(
    () => ({ kUSD: 0, kSOL: 0, kETH: 0, kBTC: 0 }),
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
      { pair: "kUSD / kSOL", volume24h: "₭1.2M", tvl: "₭7.8M" },
      { pair: "kUSD / kETH", volume24h: "₭880k", tvl: "₭5.2M" },
      { pair: "kUSD / kBTC", volume24h: "₭640k", tvl: "₭3.6M" },
      { pair: "kSOL / kETH", volume24h: "₭420k", tvl: "₭2.1M" },
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
          slippage,
          feeBps,
          wallet: "user-wallet-address",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus(`Swap complete ✅ Keeta TX: ${data.tx.hash}`);
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
            <img src={BRAND_LOGO} alt="SILVERBACK Logo" className="logo" />
            <span className="brand-name">SILVERBACK</span>
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
          <p className="hero-subtitle">Low slippage. Deep liquidity. Native to Keeta.</p>
          <div className="stats-strip">
            <div className="stat-item">
              <div className="stat-label">24h Volume</div>
              <div className="stat-value">₭0</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Total TVL</div>
              <div className="stat-value">₭0</div>
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
                <div className="swap-controls">
                  <button type="button" className="slippage-chip" aria-label="Slippage" onClick={() => setSlippageOpen((v) => !v)}>{slippage}%</button>
                </div>
              </div>
              {slippageOpen && (
                <div className="slippage-popover">
                  <div className="slip-row">
                    {[0.1, 0.5, 1].map((v) => (
                      <button key={v} className={`slip-btn${v === slippage ? " is-active" : ""}`} onClick={() => { setSlippage(v); setSlippageOpen(false); }}>{v}%</button>
                    ))}
                    <div className="slip-custom">
                      <input type="number" min="0" step="0.1" value={slippage} onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)} />
                      <span>%</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pair-stack">
                <div className="row-header sell-label">Sell</div>
                <div className="pair-row">
                  <div className="token-col">
                    <label className="field-group">
                      <span className="field-label">Token</span>
                      <TokenSelect value={fromAsset} onChange={setFromAsset} options={tokenOptions} />
                    </label>
                  </div>
                  <div className="amount-col">
                    <label className="field-group">
                      <span className="field-label">Amount</span>
                      <div className="amount-field">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
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
                    <SwapIcon />
                  </button>
                  <div className="hr-line" />
                </div>

                <div className="row-header">Buy</div>
                <div className="pair-row">
                  <div className="token-col">
                    <label className="field-group">
                      <span className="field-label">Token</span>
                      <TokenSelect value={toAsset} onChange={setToAsset} options={tokenOptions} />
                    </label>
                  </div>
                  <div className="amount-col">
                    <label className="field-group">
                      <span className="field-label">Amount</span>
                      <div className="amount-field">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={toAmount}
                          onChange={(e) => setToAmount(e.target.value)}
                        />
                      </div>
                      <div className="balance-line">1 {fromAsset} ≈ {(prices[fromAsset] / prices[toAsset]).toFixed(6)} {toAsset}</div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="info-rows">
                <div className="info-line">Price impact: 0.00%</div>
                <div className="info-line">Est. fees: {(feeBps / 100).toFixed(2)}%</div>
                <div className="route-line">Route: {fromAsset} → {toAsset}</div>
              </div>
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
            <span>© {new Date().getFullYear()} SILVERBACK</span>
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
