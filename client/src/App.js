/* global BigInt */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { lib as KeetaLib, UserClient as KeetaUserClient } from "@keetanetwork/keetanet-client";
import { applyBrandTheme } from "./theme";
import {
  calculateLiquidityQuote,
  calculateSwapQuote,
  calculateWithdrawalQuote,
  formatAmount,
  toRawAmount,
} from "./utils/tokenMath";

const BRAND_LOGO =
  "https://cdn.builder.io/api/v1/image/assets%2Fd70091a6f5494e0195b033a72f7e79ae%2F116ddd439df04721809dcdc66245e3fa?format=webp&width=800";

const TOKEN_ICON_PATHS = {
  usdc: "/tokens/usdc.svg",
  sol: "/tokens/sol.svg",
  eth: "/tokens/eth.svg",
  btc: "/tokens/btc.svg",
  kusd: "/tokens/kusd.svg",
  kta: "/tokens/kta.svg",
  test: "/tokens/default.svg",
};

const KEETA_NETWORK_PREFERENCES = ["testnet", "test"];

async function createKeetaClient(account) {
  let lastError = null;
  for (const network of KEETA_NETWORK_PREFERENCES) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await KeetaUserClient.fromNetwork(network, account || undefined);
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    throw lastError;
  }
  throw new Error("Unable to initialize Keeta client");
}

function formatKeetaBalance(rawBalance) {
  try {
    const balance = BigInt(rawBalance ?? 0);
    const divisor = 1_000_000_000n;
    const negative = balance < 0n;
    const absolute = negative ? -balance : balance;
    const whole = absolute / divisor;
    const fraction = (absolute % divisor).toString().padStart(9, "0");
    const trimmedFraction = fraction.replace(/0+$/, "");
    const prefix = negative ? "-" : "";
    return trimmedFraction ? `${prefix}${whole}.${trimmedFraction}` : `${prefix}${whole}`;
  } catch (error) {
    return "0";
  }
}

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

function formatAddress(address) {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

function WalletControls({ wallet, onWalletChange }) {
  const [seedInput, setSeedInput] = useState(wallet.seed || "");
  const [indexInput, setIndexInput] = useState(wallet.index || 0);
  const [status, setStatus] = useState("");
  const balances = wallet.balances || [];
  const balanceLoading = Boolean(wallet.balanceLoading);
  const balanceError = wallet.balanceError || "";

  useEffect(() => {
    setSeedInput(wallet.seed || "");
    setIndexInput(wallet.index || 0);
  }, [wallet.seed, wallet.index]);

  const handleGenerate = () => {
    const generated = KeetaLib.Account.generateRandomSeed({ asString: true });
    setSeedInput(generated);
    setIndexInput(0);
    setStatus("Generated random seed (not saved)");
  };

  const handleConnect = () => {
    try {
      const trimmed = seedInput.trim();
      if (!trimmed) {
        throw new Error("Provide a 64-character hex seed");
      }
      const index = Number(indexInput) || 0;
      const account = KeetaLib.Account.fromSeed(trimmed, index);
      const address = account.publicKeyString.get();
      onWalletChange({
        seed: trimmed,
        index,
        address,
        account,
        balanceError: "",
        balances: [],
      });
      setStatus(`Connected ${formatAddress(address)}`);
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <div className="swap-card wallet-card" id="wallet-panel">
      <div className="swap-card-header">
        <div className="swap-card-title">
          <span className="swap-chip">Keeta testnet</span>
          <h2>Wallet</h2>
        </div>
      </div>
      <p className="wallet-copy">
        Use a testnet seed to sign swaps and liquidity transactions. Keep this value private when you deploy.
      </p>
      <div className="field-group">
        <label className="field-label" htmlFor="wallet-seed">
          Seed
        </label>
        <input
          id="wallet-seed"
          type="text"
          value={seedInput}
          onChange={(event) => setSeedInput(event.target.value)}
          placeholder="64-character hex seed"
          spellCheck="false"
          autoComplete="off"
        />
      </div>
      <div className="field-group">
        <label className="field-label" htmlFor="wallet-index">
          Account index
        </label>
        <input
          id="wallet-index"
          type="number"
          min="0"
          value={indexInput}
          onChange={(event) => setIndexInput(Number(event.target.value) || 0)}
        />
      </div>
      <div className="field-group">
        <label className="field-label">Actions</label>
        <div className="hero-actions">
          <button type="button" className="ghost-cta" onClick={handleGenerate}>
            Generate seed
          </button>
          <button type="button" className="primary-cta" onClick={handleConnect}>
            {wallet.address ? "Reconnect" : "Connect"}
          </button>
        </div>
      </div>
      {wallet.address && (
        <div className="info-line">
          Connected address: <code className="wallet-address">{wallet.address}</code>
        </div>
      )}
      {balanceLoading && <p className="status">Loading balances…</p>}
      {balanceError && <p className="status">{balanceError}</p>}
      {wallet.address && !balanceLoading && !balanceError && (
        <div className="wallet-balances">
          <h3>Balances</h3>
          {balances.length === 0 ? (
            <p className="empty">No balances found</p>
          ) : (
            <ul>
              {balances.map((entry) => (
                <li key={entry.accountId || entry.address}>
                  <span className="token-id">{entry.accountId || entry.address}</span>
                  <span className="token-value">{entry.formatted}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {status && <p className="status">{status}</p>}
    </div>
  );
}

function usePoolState() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [overrideSnapshot, setOverrideSnapshot] = useState({});
  const overridesRef = useRef({});

  const mergeOverrides = useCallback((current, updates = {}) => {
    if (!updates) {
      return current || {};
    }
    const next = { ...(current || {}) };
    if (updates.poolAccount) {
      next.poolAccount = updates.poolAccount;
    }
    if (updates.lpTokenAccount) {
      next.lpTokenAccount = updates.lpTokenAccount;
    }
    if (updates.tokenAddresses) {
      next.tokenAddresses = {
        ...(current?.tokenAddresses || {}),
        ...updates.tokenAddresses,
      };
    }
    return next;
  }, []);

  const fetchPool = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/.netlify/functions/getpool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overridesRef.current || {}),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load pool");
      }
      setData(payload);
      setOverrideSnapshot(overridesRef.current || {});
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(
    async (nextOverrides) => {
      overridesRef.current = mergeOverrides(overridesRef.current, nextOverrides);
      setOverrideSnapshot(overridesRef.current || {});
      return fetchPool();
    },
    [fetchPool, mergeOverrides]
  );

  const setOverrides = useCallback(
    async (nextOverrides = {}) => {
      overridesRef.current = nextOverrides || {};
      setOverrideSnapshot(overridesRef.current);
      return fetchPool();
    },
    [fetchPool]
  );

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  return { data, loading, error, refresh, setOverrides, overrides: overrideSnapshot };
}

function Header({ view, onNavigate, wallet, onConnectClick }) {
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
          <button className="connect-button" type="button" onClick={onConnectClick}>
            {wallet?.address ? formatAddress(wallet.address) : "Connect"}
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

function SwapPage({ wallet, onWalletChange, onNavigate, poolState }) {
  const {
    data: poolData,
    loading: poolLoading,
    error: poolError,
    refresh,
    overrides: poolOverrides,
  } = poolState;
  const tokenOptions = useMemo(() => {
    if (!poolData?.tokens?.length) return [];
    return poolData.tokens.map((token) => ({
      symbol: token.symbol,
      name: token.info?.name || token.metadata?.name || token.symbol,
    }));
  }, [poolData]);

  const tokenMap = useMemo(() => {
    const map = {};
    if (poolData?.tokens) {
      poolData.tokens.forEach((token) => {
        map[token.symbol] = token;
        map[token.address] = token;
      });
    }
    return map;
  }, [poolData]);

  const [fromAsset, setFromAsset] = useState(tokenOptions[0]?.symbol || "");
  const [toAsset, setToAsset] = useState(tokenOptions[1]?.symbol || "");

  useEffect(() => {
    if (!tokenOptions.length) {
      setFromAsset("");
      setToAsset("");
      return;
    }
    setFromAsset((prev) =>
      tokenOptions.some((option) => option.symbol === prev)
        ? prev
        : tokenOptions[0].symbol
    );
  }, [tokenOptions]);

  useEffect(() => {
    if (!tokenOptions.length) return;
    const defaultTo = tokenOptions.find((token) => token.symbol !== fromAsset) || tokenOptions[0];
    setToAsset((prev) =>
      prev && prev !== fromAsset && tokenOptions.some((option) => option.symbol === prev)
        ? prev
        : defaultTo.symbol
    );
  }, [tokenOptions, fromAsset]);

  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [status, setStatus] = useState("");
  const [quoteDetails, setQuoteDetails] = useState(null);
  const [slippage, setSlippage] = useState(0.5);
  const [slippageOpen, setSlippageOpen] = useState(false);

  useEffect(() => {
    if (!poolData) {
      setToAmount("");
      return;
    }
    const tokenIn = tokenMap[fromAsset];
    const tokenOut = tokenMap[toAsset];
    if (!tokenIn || !tokenOut) {
      setToAmount("");
      return;
    }
    try {
      const amountInRaw = toRawAmount(fromAmount, tokenIn.decimals);
      if (amountInRaw <= 0n) {
        setToAmount("");
        return;
      }
      const reserveIn = BigInt(tokenIn.reserveRaw);
      const reserveOut = BigInt(tokenOut.reserveRaw);
      const { amountOut } = calculateSwapQuote(
        amountInRaw,
        reserveIn,
        reserveOut,
        poolData.pool.feeBps
      );
      if (amountOut <= 0n) {
        setToAmount("");
        return;
      }
      setToAmount(formatAmount(amountOut, tokenOut.decimals));
    } catch (error) {
      setToAmount("");
    }
  }, [fromAmount, fromAsset, toAsset, poolData, tokenMap]);

  const flipDirection = () => {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
    setQuoteDetails(null);
  };

  const handleSwap = async () => {
    if (!fromAmount) {
      setStatus("Enter an amount to swap");
      return;
    }
    if (!wallet?.seed) {
      setStatus("Connect a testnet wallet seed first");
      return;
    }

    setStatus("Preparing swap...");
    setQuoteDetails(null);

    try {
      const tokenOverrides = poolOverrides?.tokenAddresses
        ? { ...poolOverrides.tokenAddresses }
        : {};
      const response = await fetch("/.netlify/functions/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAsset,
          to: toAsset,
          amount: fromAmount,
          seed: wallet.seed,
          accountIndex: wallet.index || 0,
          slippageBps: Math.max(0, Math.round(Number(slippage) * 100)),
          tokenAddresses: tokenOverrides,
          fromAddress: tokenOverrides[fromAsset],
          toAddress: tokenOverrides[toAsset],
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Swap failed");
      }
      setQuoteDetails(payload);
      setToAmount(payload.tokens?.to?.expectedFormatted || toAmount);
      setStatus(payload.message || "Swap prepared");
      refresh();
    } catch (error) {
      setStatus(`Swap failed: ${error.message}`);
    }
  };

  const poolStatusMessage = poolError
    ? `Failed to load pool: ${poolError}`
    : poolLoading
    ? "Fetching pool state..."
    : "";

  const heroStats = useMemo(() => {
    if (!poolData?.tokens?.length) {
      return [
        { label: "Fee tier", value: "0 bps" },
        { label: "LP supply", value: "—" },
        { label: "Updated", value: "—" },
      ];
    }
    const [tokenA, tokenB] = poolData.tokens;
    return [
      { label: "Fee tier", value: `${poolData.pool.feeBps} bps` },
      {
        label: `${tokenA.symbol} reserve`,
        value: `${tokenA.reserveFormatted} ${tokenA.symbol}`,
      },
      {
        label: `${tokenB.symbol} reserve`,
        value: `${tokenB.reserveFormatted} ${tokenB.symbol}`,
      },
    ];
  }, [poolData]);

  const featuredPools = useMemo(() => {
    if (!poolData?.tokens?.length) {
      return [];
    }
    const [tokenA, tokenB] = poolData.tokens;
    return [
      {
        id: poolData.pool.address,
        tokenA: tokenA.symbol,
        tokenB: tokenB.symbol,
        fee: poolData.pool.feeBps,
        reserves: `${tokenA.reserveFormatted} ${tokenA.symbol} / ${tokenB.reserveFormatted} ${tokenB.symbol}`,
      },
    ];
  }, [poolData]);
  return (
    <main className="page" id="swap">
      <section className="hero-section">
        <div className="hero-grid">
          <div className="hero-content">
            <span className="eyebrow">Keeta Liquidity Layer</span>
            <h1 className="hero-heading">Swap at apex speed with Silverback.</h1>
            <p className="hero-subtitle">
              Deep liquidity, MEV-aware routing, and a premium trading experience built for the Keeta ecosystem.
            </p>
            <div className="hero-actions">
              <button
                type="button"
                className="primary-cta"
                onClick={() => onNavigate("swap", "/", "swap-panel")}
              >
                Start swapping
              </button>
              <button
                type="button"
                className="ghost-cta"
                onClick={() => onNavigate("pools", "/pools", "pools")}
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
            <WalletControls wallet={wallet} onWalletChange={onWalletChange} />
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
                        onChange={(event) => setSlippage(parseFloat(event.target.value) || 0)}
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
                        onClick={() => setFromAmount("")}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="balance-line">Balance: —</div>
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
                    <div className="balance-line">Pool price updates automatically</div>
                  </div>
                </div>
              </div>

              <div className="info-rows">
                <div className="info-line">
                  Expected output: {quoteDetails?.tokens?.to?.expectedFormatted || "—"} {" "}
                  {quoteDetails?.tokens?.to?.symbol || toAsset}
                </div>
                <div className="info-line">
                  Minimum received ({slippage}% slippage): {quoteDetails?.tokens?.to?.minimumFormatted || "—"}
                </div>
                <div className="info-line">
                  Fee: {quoteDetails?.tokens?.from?.feePaidFormatted || `${(poolData?.pool?.feeBps ?? 0) / 100}%`} {" "}
                  {quoteDetails?.tokens?.from?.symbol || fromAsset}
                </div>
                <div className="info-line">
                  Price impact: {quoteDetails ? `${quoteDetails.priceImpact} %` : "—"}
                </div>
                <div className="route-line">
                  Pool: {poolData?.pool?.address ? formatAddress(poolData.pool.address) : "—"}
                </div>
              </div>

              {poolStatusMessage && <p className="status">{poolStatusMessage}</p>}

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
            onClick={() => onNavigate("pools", "/pools", "pools")}
          >
            Explore pools
          </button>
        </div>
        <div className="pool-grid">
          {featuredPools.length === 0 && (
            <article className="pool-card" key="placeholder">
              <div className="pool-card-head">
                <div className="pool-token-icons">
                  <span className="token-icon token-icon-lg">
                    <TokenBadge symbol="KTA" />
                  </span>
                  <span className="token-icon token-icon-lg">
                    <TokenBadge symbol="TEST" />
                  </span>
                </div>
                <span className="pool-pair">KTA/TEST</span>
              </div>
              <div className="pool-card-body">
                <div className="pool-metric">
                  <span className="metric-label">Fee</span>
                  <span className="metric-value">—</span>
                </div>
                <div className="pool-metric">
                  <span className="metric-label">Reserves</span>
                  <span className="metric-value">—</span>
                </div>
              </div>
              <button
                type="button"
                className="pill-link"
                onClick={() => onNavigate("pools", "/pools", "pools")}
              >
                Manage position <ArrowTopRight />
              </button>
            </article>
          )}
          {featuredPools.map((pool) => (
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
                  <span className="metric-label">Fee</span>
                  <span className="metric-value">{pool.fee} bps</span>
                </div>
                <div className="pool-metric">
                  <span className="metric-label">Reserves</span>
                  <span className="metric-value">{pool.reserves}</span>
                </div>
              </div>
              <button
                type="button"
                className="pill-link"
                onClick={() => onNavigate("pools", "/pools", "pools")}
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
function PoolsPage({ wallet, onWalletChange, poolState }) {
  const {
    data: poolData,
    loading: poolLoading,
    error: poolError,
    refresh,
    overrides: poolOverrides,
  } = poolState;

  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [lpAmount, setLpAmount] = useState("");
  const [addStatus, setAddStatus] = useState("");
  const [removeStatus, setRemoveStatus] = useState("");
  const [mintPreview, setMintPreview] = useState(null);
  const [withdrawPreview, setWithdrawPreview] = useState(null);
  const [tokenAAddressInput, setTokenAAddressInput] = useState("");
  const [tokenBAddressInput, setTokenBAddressInput] = useState("");
  const [tokenBSelection, setTokenBSelection] = useState("");
  const [tokenConfigStatus, setTokenConfigStatus] = useState("");

  const tokensInPool = useMemo(() => poolData?.tokens || [], [poolData]);
  const tokenA = tokensInPool[0];
  const defaultTokenB = tokensInPool[1];
  const tokenB = useMemo(() => {
    if (!tokensInPool.length) {
      return undefined;
    }
    if (!tokenBSelection) {
      return defaultTokenB;
    }
    return tokensInPool.find((token) => token.symbol === tokenBSelection) || defaultTokenB;
  }, [tokensInPool, tokenBSelection, defaultTokenB]);
  const lpToken = poolData?.lpToken;

  useEffect(() => {
    setTokenAAddressInput(tokenA?.address || "");
  }, [tokenA?.address]);

  const baseToken = poolData?.baseToken;

  const tokenConfigOptions = useMemo(() => {
    if (!poolData) {
      return [];
    }
    const seen = new Set();
    const tokens = [];
    for (const token of poolData.tokens || []) {
      if (!token?.symbol) continue;
      const key = token.symbol.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tokens.push(token);
    }
    if (poolData.baseToken?.symbol) {
      const key = poolData.baseToken.symbol.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        tokens.push(poolData.baseToken);
      }
    }
    return tokens.map((token) => ({
      symbol: token.symbol,
      name: formatAddress(token.address),
      address: token.address,
    }));
  }, [poolData]);

  useEffect(() => {
    const fallbackSymbol = tokenB?.symbol || tokenBSelection || baseToken?.symbol || "";
    const fallbackOption = tokenConfigOptions.find((item) => item.symbol === fallbackSymbol);
    const fallbackAddress =
      tokenB?.address || fallbackOption?.address || baseToken?.address || "";
    setTokenBAddressInput(fallbackAddress);
    setTokenBSelection((prev) => (prev ? prev : fallbackSymbol));
  }, [
    tokenB?.address,
    tokenB?.symbol,
    tokenConfigOptions,
    tokenBSelection,
    baseToken?.address,
    baseToken?.symbol,
  ]);

  const handleTokenBSelect = useCallback(
    (symbol) => {
      setTokenBSelection(symbol);
      const option = tokenConfigOptions.find((item) => item.symbol === symbol);
      if (option?.address) {
        setTokenBAddressInput(option.address);
      }
      setTokenConfigStatus("");
    },
    [tokenConfigOptions]
  );

  const handleApplyTokenConfig = useCallback(async () => {
    if (!tokenA && !tokenB && !tokenBSelection) {
      setTokenConfigStatus("Load pool data before configuring tokens");
      return;
    }
    const overrides = {};
    if (tokenA?.symbol && tokenAAddressInput.trim()) {
      overrides[tokenA.symbol] = tokenAAddressInput.trim();
    }
    const selectionSymbol = (tokenBSelection || tokenB?.symbol || "").trim();
    if (selectionSymbol && tokenBAddressInput.trim()) {
      overrides[selectionSymbol] = tokenBAddressInput.trim();
    }
    if (!Object.keys(overrides).length) {
      setTokenConfigStatus("Enter token contract addresses to update the pool mapping");
      return;
    }
    setTokenConfigStatus("Updating token mapping...");
    const success = await refresh({ tokenAddresses: overrides });
    if (success === false) {
      setTokenConfigStatus("Failed to update tokens. Check the contract addresses and try again.");
    } else {
      setTokenConfigStatus("Token mapping updated");
    }
  }, [refresh, tokenA, tokenB, tokenAAddressInput, tokenBAddressInput, tokenBSelection]);

  useEffect(() => {
    if (!poolData || !tokenA || !tokenB) {
      setMintPreview(null);
      return;
    }
    try {
      const rawA = toRawAmount(amountA, tokenA.decimals);
      const rawB = toRawAmount(amountB, tokenB.decimals);
      if (rawA <= 0n || rawB <= 0n) {
        setMintPreview(null);
        return;
      }
      const preview = calculateLiquidityQuote(
        rawA,
        rawB,
        BigInt(tokenA.reserveRaw),
        BigInt(tokenB.reserveRaw),
        BigInt(lpToken.supplyRaw)
      );
      setMintPreview({
        minted: preview.minted,
        share: preview.share,
        formatted: formatAmount(preview.minted, lpToken.decimals),
      });
    } catch (error) {
      setMintPreview(null);
    }
  }, [amountA, amountB, poolData, tokenA, tokenB, lpToken]);

  useEffect(() => {
    if (!poolData || !tokenA || !tokenB) {
      setWithdrawPreview(null);
      return;
    }
    try {
      const rawLp = toRawAmount(lpAmount, lpToken.decimals);
      if (rawLp <= 0n) {
        setWithdrawPreview(null);
        return;
      }
      const preview = calculateWithdrawalQuote(
        rawLp,
        BigInt(tokenA.reserveRaw),
        BigInt(tokenB.reserveRaw),
        BigInt(lpToken.supplyRaw)
      );
      setWithdrawPreview({
        amountA: preview.amountA,
        amountB: preview.amountB,
        share: preview.share,
        formattedA: formatAmount(preview.amountA, tokenA.decimals),
        formattedB: formatAmount(preview.amountB, tokenB.decimals),
      });
    } catch (error) {
      setWithdrawPreview(null);
    }
  }, [lpAmount, poolData, tokenA, tokenB, lpToken]);

  const handleAddLiquidity = async () => {
    if (!wallet?.seed) {
      setAddStatus("Connect a testnet wallet seed first");
      return;
    }
    if (!amountA || !amountB) {
      setAddStatus("Enter both token amounts");
      return;
    }
    setAddStatus("Submitting liquidity...");
    try {
      const tokenOverrides = poolOverrides?.tokenAddresses
        ? { ...poolOverrides.tokenAddresses }
        : {};
      const tokenAAddressValue = (tokenAAddressInput || tokenA?.address || "").trim();
      const tokenBAddressValue = (tokenBAddressInput || tokenB?.address || "").trim();
      if (tokenA?.symbol && tokenAAddressValue) {
        tokenOverrides[tokenA.symbol] = tokenAAddressValue;
      }
      if (tokenB?.symbol && tokenBAddressValue) {
        tokenOverrides[tokenB.symbol] = tokenBAddressValue;
      }
      const response = await fetch("/.netlify/functions/addLiquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenA: tokenA.symbol,
          tokenB: tokenB.symbol,
          amountA,
          amountB,
          seed: wallet.seed,
          accountIndex: wallet.index || 0,
          tokenAddresses: tokenOverrides,
          tokenAAddress: tokenAAddressValue,
          tokenBAddress: tokenBAddressValue,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Add liquidity failed");
      }
      setAddStatus(
        `Liquidity prepared: mint ${payload.minted.formatted} ${lpToken.symbol}. ${payload.message}`
      );
      refresh();
    } catch (error) {
      setAddStatus(`Add liquidity failed: ${error.message}`);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!wallet?.seed) {
      setRemoveStatus("Connect a testnet wallet seed first");
      return;
    }
    if (!lpAmount) {
      setRemoveStatus("Enter an LP amount to burn");
      return;
    }
    setRemoveStatus("Submitting withdrawal...");
    try {
      const tokenOverrides = poolOverrides?.tokenAddresses
        ? { ...poolOverrides.tokenAddresses }
        : {};
      const tokenAAddressValue = (tokenAAddressInput || tokenA?.address || "").trim();
      const tokenBAddressValue = (tokenBAddressInput || tokenB?.address || "").trim();
      if (tokenA?.symbol && tokenAAddressValue) {
        tokenOverrides[tokenA.symbol] = tokenAAddressValue;
      }
      if (tokenB?.symbol && tokenBAddressValue) {
        tokenOverrides[tokenB.symbol] = tokenBAddressValue;
      }
      const response = await fetch("/.netlify/functions/removeLiquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenA: tokenA.symbol,
          tokenB: tokenB.symbol,
          lpAmount,
          seed: wallet.seed,
          accountIndex: wallet.index || 0,
          tokenAddresses: tokenOverrides,
          tokenAAddress: tokenAAddressValue,
          tokenBAddress: tokenBAddressValue,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Remove liquidity failed");
      }
      setRemoveStatus(
        `Withdrawal prepared: ${payload.withdrawals.tokenA.amountFormatted} ${tokenA.symbol} + ${payload.withdrawals.tokenB.amountFormatted} ${tokenB.symbol}. ${payload.message}`
      );
      refresh();
    } catch (error) {
      setRemoveStatus(`Remove liquidity failed: ${error.message}`);
    }
  };
  return (
    <main className="page pools-page" id="pools">
      <section className="pools-hero">
        <div className="hero-content">
          <span className="eyebrow">Liquidity Network</span>
          <h1 className="hero-heading">Deploy liquidity with confidence.</h1>
          <p className="hero-subtitle">
            Choose high performing pools, monitor reserves in real-time, and manage LP tokens from a single dashboard.
          </p>
        </div>
      </section>

      <section className="pools-layout-section">
        <div className="pools-layout">
          <aside className="pool-selector">
            <h2 className="section-title">Available Pools</h2>
            {poolLoading && <p className="status">Fetching pool data...</p>}
            {poolError && <p className="status">Failed to load pool: {poolError}</p>}
            {!poolLoading && !poolError && tokenA && tokenB && (
              <div className="pool-selector-list">
                <button type="button" className="pool-selector-card is-active">
                  <div className="pool-card-head">
                    <div className="pool-token-icons">
                      <span className="token-icon">
                        <TokenBadge symbol={tokenA.symbol} />
                      </span>
                      <span className="token-icon">
                        <TokenBadge symbol={tokenB.symbol} />
                      </span>
                    </div>
                    <span className="pool-pair">{tokenA.symbol}/{tokenB.symbol}</span>
                  </div>
                  <div className="pool-card-body">
                    <div className="pool-metric">
                      <span className="metric-label">Fee tier</span>
                      <span className="metric-value">{poolData.pool.feeBps} bps</span>
                    </div>
                    <div className="pool-metric">
                      <span className="metric-label">LP supply</span>
                      <span className="metric-value">{lpToken.supplyFormatted}</span>
                    </div>
                  </div>
                </button>
              </div>
            )}
          </aside>

          <div className="pool-detail">
            <div className="swap-card pool-overview">
              <div className="swap-card-header">
                <div className="swap-card-title">
                  <h2>
                    {tokenA?.symbol}/{tokenB?.symbol}
                  </h2>
                  <span className="swap-chip">Pool overview</span>
                </div>
              </div>
              {poolLoading ? (
                <p className="status">Fetching reserves...</p>
              ) : poolError ? (
                <p className="status">{poolError}</p>
              ) : tokenA && tokenB ? (
                <div className="info-rows">
                  <div className="info-line">
                    Reserves: {tokenA.reserveFormatted} {tokenA.symbol} / {tokenB.reserveFormatted} {tokenB.symbol}
                  </div>
                  <div className="info-line">
                    LP supply: {lpToken.supplyFormatted} {lpToken.symbol}
                  </div>
                  <div className="info-line">
                    Pool address: {formatAddress(poolData.pool.address)}
                  </div>
                  <div className="info-line">
                    Fee tier: {poolData.pool.feeBps} bps
                  </div>
                </div>
              ) : (
                <p className="status">Pool unavailable</p>
              )}
            </div>

            <div className="dual-card">
              <div className="swap-card liquidity-card">
                <h3>Add Liquidity</h3>
                <p className="wallet-copy">
                  Provide both assets to receive {lpToken?.symbol || "LP"} tokens. Quotes are computed before broadcasting.
                </p>
                <div className="field-group">
                  <span className="field-label">Token A contract</span>
                  <input
                    value={tokenAAddressInput}
                    onChange={(event) => {
                      setTokenAAddressInput(event.target.value);
                      setTokenConfigStatus("");
                    }}
                    placeholder="Enter token A contract"
                    type="text"
                    spellCheck={false}
                  />
                </div>
                <div className="field-group">
                  <span className="field-label">Token B</span>
                  {tokenConfigOptions.length > 0 && (
                    <TokenSelect
                      value={tokenBSelection || tokenB?.symbol || ""}
                      onChange={handleTokenBSelect}
                      options={tokenConfigOptions}
                    />
                  )}
                  <input
                    value={tokenBAddressInput}
                    onChange={(event) => {
                      setTokenBAddressInput(event.target.value);
                      setTokenConfigStatus("");
                    }}
                    placeholder="Enter token B contract"
                    type="text"
                    spellCheck={false}
                  />
                </div>
                <div className="field-group">
                  <button type="button" className="ghost-cta full" onClick={handleApplyTokenConfig}>
                    Apply token addresses
                  </button>
                </div>
                {tokenConfigStatus && <p className="status">{tokenConfigStatus}</p>}
                <div className="field-group">
                  <span className="field-label">Amount {tokenA?.symbol || "Token A"}</span>
                  <input
                    value={amountA}
                    onChange={(event) => setAmountA(event.target.value)}
                    placeholder="0.0"
                    type="number"
                    min="0"
                    step="any"
                  />
                </div>
                <div className="field-group">
                  <span className="field-label">Amount {tokenB?.symbol || "Token B"}</span>
                  <input
                    value={amountB}
                    onChange={(event) => setAmountB(event.target.value)}
                    placeholder="0.0"
                    type="number"
                    min="0"
                    step="any"
                  />
                </div>
                {mintPreview && (
                  <div className="info-rows">
                    <div className="info-line">
                      Est. mint: {mintPreview.formatted} {lpToken.symbol}
                    </div>
                    <div className="info-line">
                      Pool share: {(mintPreview.share * 100).toFixed(4)}%
                    </div>
                  </div>
                )}
                <button type="button" className="primary-cta full" onClick={handleAddLiquidity}>
                  Supply liquidity
                </button>
                {addStatus && <p className="status">{addStatus}</p>}
              </div>

              <div className="swap-card liquidity-card">
                <h3>Remove Liquidity</h3>
                <p className="wallet-copy">
                  Withdraw {lpToken?.symbol || "LP"} tokens to receive the underlying assets.
                </p>
                <div className="field-group">
                  <span className="field-label">LP Tokens to burn</span>
                  <input
                    value={lpAmount}
                    onChange={(event) => setLpAmount(event.target.value)}
                    placeholder="0.0"
                    type="number"
                    min="0"
                    step="any"
                  />
                </div>
                {withdrawPreview && (
                  <div className="info-rows">
                    <div className="info-line">
                      Est. return: {withdrawPreview.formattedA} {tokenA.symbol} & {withdrawPreview.formattedB} {tokenB.symbol}
                    </div>
                    <div className="info-line">
                      Pool share: {(withdrawPreview.share * 100).toFixed(4)}%
                    </div>
                  </div>
                )}
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
  const [wallet, setWallet] = useState({
    seed: "",
    index: 0,
    address: "",
    account: null,
    balances: [],
    balanceLoading: false,
    balanceError: "",
  });
  const poolState = usePoolState();
  const walletSeed = wallet.seed;
  const walletIndex = wallet.index;
  const walletAddress = wallet.address;
  const walletAccount = wallet.account;
  const walletAccountKey = (() => {
    try {
      return walletAccount?.publicKeyString?.get?.() || null;
    } catch (error) {
      return null;
    }
  })();

  const scrollToSection = useCallback((id) => {
    if (typeof window === "undefined") return;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

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

  const handleNavigate = useCallback(
    (target, path, scrollTarget) => {
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
    },
    [scrollToSection]
  );

  const handleWalletChange = useCallback(
    (next) => {
      setWallet((prev) => ({ ...prev, ...next }));
    },
    []
  );

  const handleConnectClick = useCallback(() => {
    scrollToSection("wallet-panel");
  }, [scrollToSection]);

  useEffect(() => {
    let cancelled = false;
    const loadBalances = async () => {
      if (!walletSeed || !walletAddress) {
        setWallet((prev) => {
          if (
            (!prev.balances || prev.balances.length === 0) &&
            !prev.balanceLoading &&
            !prev.balanceError
          ) {
            return prev;
          }
          return {
            ...prev,
            balances: [],
            balanceError: "",
            balanceLoading: false,
          };
        });
        return;
      }
      setWallet((prev) => ({
        ...prev,
        balanceLoading: true,
        balanceError: "",
      }));
      try {
        let account = walletAccount;
        if (!account) {
          account = KeetaLib.Account.fromSeed(walletSeed, walletIndex || 0);
        }
        const client = await createKeetaClient(account);
        let accountInfo;
        try {
          accountInfo = await client.getAccountInfo(account.publicKeyString.get());
        } catch (infoError) {
          accountInfo = await client.getAccountInfo(account);
        }
        const balances = Array.isArray(accountInfo?.balances) ? accountInfo.balances : [];
        const normalized = balances
          .map((entry) => {
            const raw = entry?.balance ?? entry?.amount ?? entry?.raw ?? 0;
            const accountId =
              entry?.accountId ||
              entry?.account ||
              entry?.tokenAccount ||
              entry?.token ||
              (entry?.address ? entry.address : "");
            return {
              ...entry,
              accountId,
              formatted: formatKeetaBalance(raw),
            };
          })
          .filter((entry) => entry.accountId);
        if (!cancelled) {
          setWallet((prev) => ({
            ...prev,
            account,
            balances: normalized,
            balanceLoading: false,
            balanceError: "",
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setWallet((prev) => ({
            ...prev,
            balances: [],
            balanceLoading: false,
            balanceError: error?.message || "Failed to load balances",
          }));
        }
      }
    };

    loadBalances();

    return () => {
      cancelled = true;
    };
  }, [walletSeed, walletIndex, walletAddress, walletAccountKey]);

  return (
    <div className="app">
      <div className="site-shell">
        <Header view={view} onNavigate={handleNavigate} wallet={wallet} onConnectClick={handleConnectClick} />
        {view === "pools" ? (
          <PoolsPage wallet={wallet} onWalletChange={handleWalletChange} poolState={poolState} />
        ) : (
          <SwapPage
            wallet={wallet}
            onWalletChange={handleWalletChange}
            onNavigate={handleNavigate}
            poolState={poolState}
          />
        )}
        <Footer onNavigate={handleNavigate} />
      </div>
    </div>
  );
}

export default App;
