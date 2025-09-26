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

function extractAccountAddress(value, seen = new Set()) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed;
  }

  if (typeof value !== "object") {
    return "";
  }

  if (seen.has(value)) {
    return "";
  }
  seen.add(value);

  if (typeof value.publicKeyString === "string") {
    const trimmed = value.publicKeyString.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  if (value.publicKeyString && typeof value.publicKeyString.get === "function") {
    try {
      const resolved = value.publicKeyString.get();
      if (typeof resolved === "string" && resolved.trim()) {
        return resolved.trim();
      }
    } catch (error) {
      /* ignore getter errors */
    }
  }

  if (typeof value.address === "string" && value.address.trim()) {
    return value.address.trim();
  }

  if (value.address && typeof value.address.get === "function") {
    try {
      const resolved = value.address.get();
      if (typeof resolved === "string" && resolved.trim()) {
        return resolved.trim();
      }
    } catch (error) {
      /* ignore getter errors */
    }
  }

  const candidateKeys = [
    "address",
    "account",
    "accountAddress",
    "publicKey",
    "public_key",
    "publicKeyString",
    "tokenAccount",
    "token",
    "id",
    "value",
  ];

  for (const key of candidateKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      continue;
    }
    const nested = value[key];
    const resolved = extractAccountAddress(nested, seen);
    if (resolved) {
      return resolved;
    }
  }

  return "";
}

function resolveBalanceMetadata(entry, index) {
  const seen = new Set();
  const candidates = [
    entry?.accountId,
    entry?.account,
    entry?.tokenAccount,
    entry?.token,
    entry?.address,
  ];

  for (const candidate of candidates) {
    const resolved = extractAccountAddress(candidate, seen);
    if (resolved) {
      return { address: resolved, label: resolved };
    }
  }

  const labelCandidates = [
    entry?.symbol,
    entry?.tokenSymbol,
    entry?.tokenName,
    entry?.name,
  ];
  for (const label of labelCandidates) {
    if (typeof label === "string" && label.trim()) {
      return { address: "", label: label.trim() };
    }
  }

  return { address: "", label: `Balance ${index + 1}` };
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

function symbolsEqual(a, b) {
  if (!a || !b) return false;
  return String(a).toUpperCase() === String(b).toUpperCase();
}

function resolveBaseTokenBalance(baseToken) {
  if (!baseToken) return null;
  if (baseToken.balanceFormatted != null) {
    return baseToken.balanceFormatted;
  }
  if (baseToken.balanceRaw != null && baseToken.decimals != null) {
    try {
      return formatAmount(baseToken.balanceRaw, baseToken.decimals);
    } catch (error) {
      return null;
    }
  }
  return null;
}

const INITIAL_WALLET_STATE = {
  seed: "",
  index: 0,
  address: "",
  identifier: "",
  network: "",
  baseToken: null,
  loading: false,
  error: "",
  balances: [],
  balanceLoading: false,
  balanceError: "",
  account: null,
};

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

function sanitizeBaseToken(token) {
  if (!token || typeof token !== "object") {
    return null;
  }
  const symbol = typeof token.symbol === "string" ? token.symbol : "";
  const address = typeof token.address === "string" ? token.address : "";
  const decimalsRaw = token.decimals;
  const decimals = Number.isFinite(Number(decimalsRaw)) ? Number(decimalsRaw) : null;
  const balanceRaw =
    token.balanceRaw != null && typeof token.balanceRaw.toString === "function"
      ? token.balanceRaw.toString()
      : null;
  const balanceFormatted =
    typeof token.balanceFormatted === "string" ? token.balanceFormatted : null;
  const metadata = token.metadata && typeof token.metadata === "object" ? token.metadata : {};

  return {
    symbol,
    address,
    decimals,
    balanceRaw,
    balanceFormatted,
    metadata,
  };
}

function sanitizeWalletPayload(payload, fallbackAddress) {
  if (!payload || typeof payload !== "object") {
    return {
      address: fallbackAddress,
      identifier: "",
      network: "",
      baseToken: null,
    };
  }

  const normalizedAddress =
    typeof payload.address === "string" && payload.address.trim()
      ? payload.address.trim()
      : fallbackAddress;

  const identifier =
    typeof payload.identifier === "string" && payload.identifier.trim()
      ? payload.identifier.trim()
      : "";

  const network = typeof payload.network === "string" ? payload.network : "";

  return {
    address: normalizedAddress,
    identifier,
    network,
    baseToken: sanitizeBaseToken(payload.baseToken),
  };
}

function parseWalletResponse(text) {
  if (!text) {
    return {};
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return {};
  }

  const candidates = new Set([trimmed]);

  const objectStart = trimmed.indexOf("{");
  const arrayStart = trimmed.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  const objectEnd = trimmed.lastIndexOf("}");
  const arrayEnd = trimmed.lastIndexOf("]");
  const ends = [objectEnd, arrayEnd].filter((index) => index >= 0);

  if (starts.length && ends.length) {
    const envelopeStart = Math.min(...starts);
    const envelopeEnd = Math.max(...ends);
    if (envelopeStart < envelopeEnd) {
      candidates.add(trimmed.slice(envelopeStart, envelopeEnd + 1));
    }
  }

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    try {
      return JSON.parse(candidate);
    } catch (error) {
      /* try next candidate */
    }
  }

  throw new Error("Invalid wallet response");
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

  const baseTokenBalance = resolveBaseTokenBalance(wallet.baseToken);
  const walletLoading = Boolean(wallet.loading);

  const requestWalletDetails = useCallback(async (seedValue, accountIndexValue) => {
    const response = await fetch("/.netlify/functions/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: seedValue, accountIndex: accountIndexValue }),
    });

    const text = await response.text();
    let payload = {};
    if (text) {
      try {
        payload = parseWalletResponse(text);
      } catch (error) {
        throw new Error(error.message || "Invalid wallet response");
      }
    }

    if (!response.ok) {
      throw new Error(payload.error || "Failed to load wallet details");
    }

    return payload;
  }, []);

  const handleGenerate = () => {
    const generated = KeetaLib.Account.generateRandomSeed({ asString: true });
    setSeedInput(generated);
    setIndexInput(0);
    setStatus("Generated random seed (not saved)");
  };

  const handleConnect = async () => {
    const trimmed = seedInput.trim();
    const index = Number(indexInput) || 0;
    try {
      if (!trimmed) {
        throw new Error("Provide a 64-character hex seed");
      }
      if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
        throw new Error("Provide a 64-character hexadecimal seed");
      }
      const account = KeetaLib.Account.fromSeed(trimmed, index);
      const address = account.publicKeyString.get();

      setStatus(`Connecting ${formatAddress(address)}...`);
      onWalletChange({
        ...INITIAL_WALLET_STATE,
        seed: trimmed,
        index,
        loading: true,
        error: "",
        balanceError: "",
        balances: [],
        balanceLoading: false,
        address: "",
        identifier: "",
        network: "",
        baseToken: null,
        account: null,
      });

      let payload;
      try {
        payload = await requestWalletDetails(trimmed, index);
      } catch (requestError) {
        onWalletChange({
          ...INITIAL_WALLET_STATE,
          seed: trimmed,
          index,
          loading: false,
          error: requestError.message,
          balanceLoading: false,
          address: "",
          identifier: "",
          network: "",
          baseToken: null,
          balances: [],
          account: null,
        });
        setStatus(`Failed to load wallet details: ${requestError.message}`);
        return;
      }

      const sanitized = sanitizeWalletPayload(payload, address);
      onWalletChange({
        ...INITIAL_WALLET_STATE,
        seed: trimmed,
        index,
        address: sanitized.address,
        identifier: sanitized.identifier,
        network: sanitized.network,
        baseToken: sanitized.baseToken,
        balances: [],
        balanceError: "",
        loading: false,
        balanceLoading: false,
        error: "",
        account,
      });
      setStatus(`Connected ${formatAddress(sanitized.address)}`);
    } catch (error) {
      onWalletChange({
        ...INITIAL_WALLET_STATE,
        seed: trimmed,
        index,
        loading: false,
        error: error.message,
        balanceLoading: false,
        address: "",
        identifier: "",
        network: "",
        baseToken: null,
        balances: [],
        account: null,
      });
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
        <p className="field-caption">
          Derives alternate wallet addresses from the same seed (advanced). Use 0 for the primary account.
        </p>
      </div>
      <div className="field-group">
        <label className="field-label">Actions</label>
        <div className="hero-actions">
          <button type="button" className="ghost-cta" onClick={handleGenerate}>
            Generate seed
          </button>
          <button
            type="button"
            className="primary-cta"
            onClick={handleConnect}
            disabled={walletLoading}
          >
            {walletLoading
              ? "Connecting..."
              : wallet.address
              ? "Reconnect"
              : "Connect"}
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
              {balances.map((entry, index) => {
                const label = entry.accountLabel || entry.accountId || `Balance ${index + 1}`;
                const key = entry.balanceKey || entry.accountId || `${label}-${index}`;
                return (
                  <li key={key}>
                    <span className="token-id">{label}</span>
                    <span className="token-value">{entry.formatted}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {wallet.baseToken && (
        <div className="info-line">
          Balance: {walletLoading
            ? "Loading..."
            : baseTokenBalance != null
            ? `${baseTokenBalance} ${wallet.baseToken.symbol || ""}`.trim()
            : "—"}
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
    if (!poolData) return [];
    const seen = new Set();
    const options = [];

    const addOption = (token) => {
      if (!token?.symbol) return;
      const key = token.symbol.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push({
        symbol: token.symbol,
        name: token.info?.name || token.metadata?.name || token.symbol,
      });
    };

    if (poolData.baseToken) {
      addOption(poolData.baseToken);
    }

    (poolData.tokens || []).forEach(addOption);

    return options;
  }, [poolData]);

  const tokenMap = useMemo(() => {
    const map = {};
    const registerToken = (token) => {
      if (!token?.symbol) return;
      const entry = { ...token };
      map[token.symbol] = entry;
      if (token.address) {
        map[token.address] = entry;
      }
    };

    (poolData?.tokens || []).forEach(registerToken);

    if (poolData?.baseToken?.symbol) {
      const key = poolData.baseToken.symbol;
      if (!map[key]) {
        const reserve = poolData?.reserves?.[key];
        registerToken({
          ...poolData.baseToken,
          reserveRaw: reserve?.reserveRaw || poolData.baseToken.reserveRaw || "0",
          reserveFormatted:
            reserve?.reserveFormatted || poolData.baseToken.reserveFormatted || "0",
        });
      }
    }

    return map;
  }, [poolData]);

  const walletBaseToken = wallet?.baseToken || null;
  const walletLoading = Boolean(wallet?.loading);
  const walletBaseTokenBalance = resolveBaseTokenBalance(walletBaseToken);

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
    <main className="swap-screen" id="swap">
      <section className="swap-hero">
        <div className="swap-hero__content">
          <span className="eyebrow">Keeta Liquidity Layer</span>
          <h1 className="swap-title">Swap at apex speed with Silverback.</h1>
          <p className="swap-subtitle">
            Deep liquidity, MEV-aware routing, and a premium trading experience built for the Keeta ecosystem.
          </p>
          <div className="swap-cta-row">
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
          <div className="swap-metrics" id="stats">
            {heroStats.map((item) => (
              <div className="metric-card" key={item.label}>
                <span className="metric-label">{item.label}</span>
                <span className="metric-value">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="swap-hero__panels" id="swap-panel">
          <div className="swap-panel swap-panel--primary">
            <div className="swap-card swap-card--panel">
              <div className="swap-card__tabs">
                <button type="button" className="swap-card__tab is-active">
                  Swap
                </button>
                <button type="button" className="swap-card__tab" disabled>
                  Limit
                </button>
                <button type="button" className="swap-card__tab" disabled>
                  Liquidity
                </button>
              </div>
              <div className="swap-card__header">
                <div>
                  <h2>Swap tokens</h2>
                  <p className="swap-card__subtitle">Live Keeta pricing with one-tap execution.</p>
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
                <div className="slippage-popover swap-card__popover">
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
              <div className="swap-card__body">
                <div className="swap-input-block">
                  <div className="swap-input-block__top">
                    <span className="swap-input-block__label">You pay</span>
                    {walletBaseToken && symbolsEqual(fromAsset, walletBaseToken.symbol) && (
                      <span className="swap-input-block__balance">
                        {walletLoading
                          ? "Loading..."
                          : walletBaseTokenBalance != null
                          ? `${walletBaseTokenBalance} ${walletBaseToken.symbol}`
                          : "—"}
                      </span>
                    )}
                  </div>
                  <div className="swap-input">
                    <input
                      id="swap-from-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={fromAmount}
                      onChange={(event) => setFromAmount(event.target.value)}
                    />
                    <TokenSelect value={fromAsset} onChange={setFromAsset} options={tokenOptions} />
                  </div>
                </div>
                <button
                  type="button"
                  className="swap-flip"
                  onClick={flipDirection}
                  aria-label="Switch direction"
                >
                  <SwapIcon />
                </button>
                <div className="swap-input-block">
                  <div className="swap-input-block__top">
                    <span className="swap-input-block__label">You receive</span>
                    {walletBaseToken && symbolsEqual(toAsset, walletBaseToken.symbol) && (
                      <span className="swap-input-block__balance">
                        {walletLoading
                          ? "Loading..."
                          : walletBaseTokenBalance != null
                          ? `${walletBaseTokenBalance} ${walletBaseToken.symbol}`
                          : "—"}
                      </span>
                    )}
                  </div>
                  <div className="swap-input">
                    <input
                      id="swap-to-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={toAmount}
                      onChange={(event) => setToAmount(event.target.value)}
                    />
                    <TokenSelect value={toAsset} onChange={setToAsset} options={tokenOptions} />
                  </div>
                  <div className="swap-input__caption">Pool price updates automatically</div>
                </div>
                <div className="swap-summary">
                  <div className="swap-summary__row">
                    <span>Expected output</span>
                    <span>
                      {quoteDetails?.tokens?.to?.expectedFormatted || "—"}{" "}
                      {quoteDetails?.tokens?.to?.symbol || toAsset}
                    </span>
                  </div>
                  <div className="swap-summary__row">
                    <span>Minimum received ({slippage}%)</span>
                    <span>{quoteDetails?.tokens?.to?.minimumFormatted || "—"}</span>
                  </div>
                  <div className="swap-summary__row">
                    <span>Fee</span>
                    <span>
                      {quoteDetails?.tokens?.from?.feePaidFormatted || `${(poolData?.pool?.feeBps ?? 0) / 100}%`}{" "}
                      {quoteDetails?.tokens?.from?.symbol || fromAsset}
                    </span>
                  </div>
                  <div className="swap-summary__row">
                    <span>Price impact</span>
                    <span>{quoteDetails ? `${quoteDetails.priceImpact} %` : "—"}</span>
                  </div>
                  <div className="swap-summary__row">
                    <span>Route</span>
                    <span>{poolData?.pool?.address ? formatAddress(poolData.pool.address) : "—"}</span>
                  </div>
                </div>
                {poolStatusMessage && <div className="swap-alert">{poolStatusMessage}</div>}
                <button type="button" className="primary-cta full swap-submit" onClick={handleSwap}>
                  Swap
                </button>
                {status && <p className="status">{status}</p>}
              </div>
            </div>
          </div>
          <div className="swap-panel swap-panel--wallet">
            <WalletControls wallet={wallet} onWalletChange={onWalletChange} />
          </div>
        </div>
      </section>
      <section className="swap-featured" id="pools">
        <div className="swap-featured__head">
          <h2>Featured pools</h2>
          <button type="button" className="pill-link" onClick={() => onNavigate("pools", "/pools", "pools")}>
            Manage positions <ArrowTopRight />
          </button>
        </div>
        <div className="swap-featured__grid">
          {poolLoading && (
            <article className="pool-card">
              <div className="pool-card-head">
                <div className="pool-token-icons">
                  <span className="token-icon token-icon-lg" />
                  <span className="token-icon token-icon-lg" />
                </div>
                <span className="pool-pair">Loading pools...</span>
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
            </article>
          ))}
          {!poolLoading && featuredPools.length === 0 && (
            <article className="pool-card">
              <div className="pool-card-head">
                <span className="pool-pair">No pools available</span>
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
            </article>
          )}
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

  const walletBaseToken = wallet?.baseToken || null;
  const walletLoading = Boolean(wallet?.loading);
  const walletBaseTokenBalance = resolveBaseTokenBalance(walletBaseToken);

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
  const [poolSearch, setPoolSearch] = useState("");

  const tokensInPool = useMemo(() => {
    if (!poolData) {
      return [];
    }
    const tokens = [...(poolData.tokens || [])];
    if (poolData.baseToken?.symbol) {
      const key = poolData.baseToken.symbol;
      const exists = tokens.some((token) => token.symbol === key);
      if (!exists) {
        const reserve = poolData.reserves?.[key];
        tokens.unshift({
          ...poolData.baseToken,
          reserveRaw: reserve?.reserveRaw || poolData.baseToken.reserveRaw || "0",
          reserveFormatted:
            reserve?.reserveFormatted || poolData.baseToken.reserveFormatted || "0",
        });
      }
    }
    return tokens;
  }, [poolData]);
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

  const availablePools = useMemo(() => {
    if (!poolData?.pool || tokensInPool.length < 2) {
      return [];
    }
    const [primary, secondary] = tokensInPool;
    return [
      {
        id: poolData.pool.address,
        address: poolData.pool.address,
        symbolA: primary?.symbol || "Token A",
        symbolB: secondary?.symbol || "Token B",
        reserveA: primary?.reserveFormatted,
        reserveB: secondary?.reserveFormatted,
        feeBps: poolData.pool.feeBps,
        lpSupply: lpToken?.supplyFormatted || "—",
      },
    ];
  }, [poolData, tokensInPool, lpToken?.supplyFormatted]);

  const filteredPools = useMemo(() => {
    const query = poolSearch.trim().toLowerCase();
    if (!query) {
      return availablePools;
    }
    return availablePools.filter((pool) => {
      const pairLabel = `${pool.symbolA}/${pool.symbolB}`.toLowerCase();
      return pairLabel.includes(query) || pool.address.toLowerCase().includes(query);
    });
  }, [availablePools, poolSearch]);

  const heroMetrics = useMemo(() => {
    const metrics = [
      {
        label: "Active pools",
        value: poolLoading ? "—" : String(availablePools.length || 0),
      },
    ];
    if (lpToken?.symbol) {
      metrics.push({
        label: `${lpToken.symbol} supply`,
        value: lpToken?.supplyFormatted || "—",
      });
    }
    if (tokenA?.symbol) {
      metrics.push({
        label: `${tokenA.symbol} reserves`,
        value: tokenA?.reserveFormatted ? `${tokenA.reserveFormatted} ${tokenA.symbol}` : "—",
      });
    }
    if (tokenB?.symbol) {
      metrics.push({
        label: `${tokenB.symbol} reserves`,
        value: tokenB?.reserveFormatted ? `${tokenB.reserveFormatted} ${tokenB.symbol}` : "—",
      });
    }
    metrics.push({
      label: "Fee tier",
      value: poolData?.pool?.feeBps ? `${poolData.pool.feeBps} bps` : "—",
    });
    return metrics;
  }, [
    availablePools.length,
    lpToken?.symbol,
    lpToken?.supplyFormatted,
    poolData?.pool?.feeBps,
    poolLoading,
    tokenA?.reserveFormatted,
    tokenA?.symbol,
    tokenB?.reserveFormatted,
    tokenB?.symbol,
  ]);

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
      setRemoveStatus("Enter an LP amount to withdraw");
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
        <div className="pools-hero__inner">
          <div className="pools-hero__copy">
            <span className="eyebrow pools-hero__eyebrow">Sonus Liquidity Hub</span>
            <h1 className="pools-hero__title">Deploy liquidity with confidence.</h1>
            <p className="pools-hero__subtitle">
              Track depth, fee tiers, and live reserves for every Silverback-enabled pool. Precision controls and instant
              refresh keep you aligned with Sonus design aesthetics.
            </p>
            <div className="pools-hero__actions">
              <button type="button" className="primary-cta">
                Create position
              </button>
              <button type="button" className="ghost-cta" onClick={refresh}>
                Refresh data
              </button>
            </div>
          </div>
          <div className="pools-hero__stats">
            {heroMetrics.map((metric) => (
              <div className="hero-stat" key={metric.label}>
                <span className="hero-stat__label">{metric.label}</span>
                <span className="hero-stat__value">{metric.value || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pools-featured">
        <div className="pools-featured__head">
          <div>
            <h2>Trending pools</h2>
            <p>Live Keeta pairs styled like Sonus.</p>
          </div>
          <button type="button" className="pill-link" onClick={refresh}>
            Refresh <ArrowTopRight />
          </button>
        </div>
        <div className="pools-featured__grid">
          {poolLoading && (
            <article className="pool-card">
              <div className="pool-card-head">
                <div className="pool-token-icons">
                  <span className="token-icon token-icon-lg" />
                  <span className="token-icon token-icon-lg" />
                </div>
                <span className="pool-pair">Loading pools...</span>
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
            </article>
          )}
          {!poolLoading && filteredPools.length === 0 && (
            <article className="pool-card">
              <div className="pool-card-head">
                <span className="pool-pair">No pools match your search</span>
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
            </article>
          )}
          {filteredPools.map((pool) => (
            <article className="pool-card" key={pool.id}>
              <div className="pool-card-head">
                <div className="pool-token-icons">
                  <span className="token-icon token-icon-lg">
                    <TokenBadge symbol={pool.symbolA} />
                  </span>
                  <span className="token-icon token-icon-lg">
                    <TokenBadge symbol={pool.symbolB} />
                  </span>
                </div>
                <span className="pool-pair">
                  {pool.symbolA}/{pool.symbolB}
                </span>
              </div>
              <div className="pool-card-body">
                <div className="pool-metric">
                  <span className="metric-label">Fee</span>
                  <span className="metric-value">{pool.feeBps} bps</span>
                </div>
                <div className="pool-metric">
                  <span className="metric-label">Reserves</span>
                  <span className="metric-value">
                    {pool.reserveA || "—"} {pool.symbolA} / {pool.reserveB || "—"} {pool.symbolB}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="pools-content">
        <div className="pools-grid">
          <div className="pools-grid__left">
            <div className="pools-card pools-card--list">
              <div className="pools-card__head">
                <div>
                  <h2>All pools</h2>
                  <p>Monitor depth, LP supply, and routing endpoints.</p>
                </div>
                <div className="pools-card__filters">
                  <div className="search-field">
                    <svg
                      className="search-field__icon"
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                    >
                      <path
                        d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398l3.387 3.387a1 1 0 001.415-1.414l-3.405-3.371zM6.5 11a4.5 4.5 0 110-9 4.5 4.5 0 010 9z"
                        fill="currentColor"
                        fillRule="evenodd"
                      />
                    </svg>
                    <input
                      type="search"
                      placeholder="Search pools"
                      value={poolSearch}
                      onChange={(event) => setPoolSearch(event.target.value)}
                    />
                  </div>
                  <button type="button" className="ghost-cta ghost-cta--compact" onClick={refresh}>
                    Sync
                  </button>
                </div>
              </div>
              <div className="pools-table">
                <div className="pools-table__header">
                  <span>Pair</span>
                  <span>Reserves</span>
                  <span>LP supply</span>
                  <span>Fee</span>
                  <span>Address</span>
                </div>
                {poolLoading && <div className="pools-table__empty">Fetching pool data...</div>}
                {poolError && !poolLoading && (
                  <div className="pools-table__empty">Failed to load pool: {poolError}</div>
                )}
                {!poolLoading && !poolError && filteredPools.length === 0 && (
                  <div className="pools-table__empty">No pools found.</div>
                )}
                {!poolLoading && !poolError && filteredPools.length > 0 && (
                  <div className="pools-table__body">
                    {filteredPools.map((pool) => (
                      <div className="pools-table__row" key={pool.id}>
                        <span className="pools-table__pair">
                          <span className="pool-token-icons">
                            <span className="token-icon">
                              <TokenBadge symbol={pool.symbolA} />
                            </span>
                            <span className="token-icon">
                              <TokenBadge symbol={pool.symbolB} />
                            </span>
                          </span>
                          <span>
                            {pool.symbolA}/{pool.symbolB}
                          </span>
                        </span>
                        <span className="pools-table__reserves">
                          <span>{pool.reserveA || "—"}</span>
                          <span>{pool.reserveB || "—"}</span>
                        </span>
                        <span>{pool.lpSupply}</span>
                        <span>{pool.feeBps} bps</span>
                        <span className="pools-table__address">{formatAddress(pool.address)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="pools-grid__right">
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
                  <div className="info-line">Pool address: {formatAddress(poolData.pool.address)}</div>
                  <div className="info-line">Fee tier: {poolData.pool.feeBps} bps</div>
                </div>
              ) : (
                <p className="status">Pool unavailable</p>
              )}
            </div>

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
                {walletBaseToken && symbolsEqual(tokenA?.symbol, walletBaseToken.symbol) && (
                  <div className="balance-line">
                    {walletLoading
                      ? "Balance: Loading..."
                      : walletBaseTokenBalance != null
                      ? `Balance: ${walletBaseTokenBalance} ${walletBaseToken.symbol}`
                      : "Balance: —"}
                  </div>
                )}
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
                {walletBaseToken && symbolsEqual(tokenB?.symbol, walletBaseToken.symbol) && (
                  <div className="balance-line">
                    {walletLoading
                      ? "Balance: Loading..."
                      : walletBaseTokenBalance != null
                      ? `Balance: ${walletBaseTokenBalance} ${walletBaseToken.symbol}`
                      : "Balance: —"}
                  </div>
                )}
              </div>
              {mintPreview && (
                <div className="info-rows">
                  <div className="info-line">
                    Est. mint: {mintPreview.formatted} {lpToken.symbol}
                  </div>
                  <div className="info-line">Pool share: {(mintPreview.share * 100).toFixed(4)}%</div>
                </div>
              )}
              <button type="button" className="primary-cta full" onClick={handleAddLiquidity}>
                Add liquidity
              </button>
              {addStatus && <p className="status">{addStatus}</p>}
            </div>

            <div className="swap-card liquidity-card">
              <h3>Remove Liquidity</h3>
              <p className="wallet-copy">
                Burn {lpToken?.symbol || "LP"} to withdraw the underlying assets. Withdrawals are prepared before signing.
              </p>
              <div className="field-group">
                <span className="field-label">LP amount</span>
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
                    Est. withdraw: {withdrawPreview.formattedA} {tokenA.symbol}
                  </div>
                  <div className="info-line">+ {withdrawPreview.formattedB} {tokenB.symbol}</div>
                </div>
              )}
              <button type="button" className="ghost-cta full" onClick={handleRemoveLiquidity}>
                Remove liquidity
              </button>
              {removeStatus && <p className="status">{removeStatus}</p>}
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

  const [wallet, setWallet] = useState(() => ({ ...INITIAL_WALLET_STATE }));
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
      let client;
      try {
        let account = walletAccount;
        if (!account) {
          account = KeetaLib.Account.fromSeed(walletSeed, walletIndex || 0);
        }
        client = await createKeetaClient(account);
        let accountInfo;
        try {
          accountInfo = await client.client.getAccountInfo(
            account.publicKeyString.get()
          );
        } catch (infoError) {
          accountInfo = await client.client.getAccountInfo(account);
        }
        const balances = Array.isArray(accountInfo?.balances) ? accountInfo.balances : [];
        const normalized = balances.map((entry, index) => {
          const raw = entry?.balance ?? entry?.amount ?? entry?.raw ?? 0;
          const { address, label } = resolveBalanceMetadata(entry, index);
          const uniqueKey = address || `${label}-${index}`;
          return {
            ...entry,
            accountId: address,
            accountLabel: label,
            balanceKey: uniqueKey,
            formatted: formatKeetaBalance(raw),
          };
        });
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
      } finally {
        if (client && typeof client.destroy === "function") {
          try {
            await client.destroy();
          } catch (destroyError) {
            // eslint-disable-next-line no-console
            console.warn("Failed to destroy wallet client", destroyError);
          }
        }
      }
    };

    loadBalances();

    return () => {
      cancelled = true;
    };
  }, [walletSeed, walletIndex, walletAddress, walletAccountKey, walletAccount]);

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
