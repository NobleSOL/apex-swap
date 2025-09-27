import React, { useMemo, useState } from "react";
import { TOKENS } from "../config/tokens";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}
function getTokenLogo(token) {
  if (token?.logo) {
    return token.logo;
  }
  const symbol = token?.symbol || token;
  const key = String(symbol || "");
  const config = TOKENS[key.toUpperCase()];
  if (config?.logo) {
    return config.logo;
  }
  const known = new Set(["kta", "kusd", "btc", "eth", "usdc", "sol"]);
  const lower = key.toLowerCase();
  return known.has(lower) ? `/tokens/${lower}.svg` : "/tokens/default.svg";
}

export default function LiquidityCard({
  mode: initialMode = "add", // "add" | "remove"
  onModeChange,
  // token selection
  tokenA,
  tokenB,
  lpToken,
  onSelectTokenA,
  onSelectTokenB,
  // token address override fields
  tokenAAddress,
  tokenBAddress,
  onChangeTokenAAddress,
  onChangeTokenBAddress,
  onApplyTokenAddresses,
  // amounts
  amountA,
  amountB,
  onChangeAmountA,
  onChangeAmountB,
  lpAmount,
  onChangeLpAmount,
  // balances (strings, e.g. "Balance: 1.23 KTA")
  balanceA,
  balanceB,
  // previews
  mintPreview, // { formatted, share }
  withdrawPreview, // { formattedA, formattedB }
  // status + actions
  addStatus,
  removeStatus,
  canAdd = false,
  canRemove = false,
  onAddLiquidity,
  onRemoveLiquidity,
}) {
  const [mode, setMode] = useState(initialMode);
  const setTab = (m) => {
    setMode(m);
    onModeChange && onModeChange(m);
  };

  const displayTokenA = useMemo(() => {
    if (tokenA?.symbol) {
      const config = TOKENS[tokenA.symbol.toUpperCase()];
      if (config?.logo && tokenA.logo !== config.logo) {
        return { ...tokenA, logo: config.logo };
      }
      return tokenA;
    }
    return TOKENS.KTA;
  }, [tokenA]);

  const displayTokenB = useMemo(() => {
    if (tokenB?.symbol) {
      const config = TOKENS[tokenB.symbol.toUpperCase()];
      if (config?.logo && tokenB.logo !== config.logo) {
        return { ...tokenB, logo: config.logo };
      }
      return tokenB;
    }
    return tokenB;
  }, [tokenB]);

  return (
    <div className={cx("swap-card", "swap-card--panel", "liquidity-card")}>
      <div className="swap-card__header">
        <div>
          <div className="swap-card__tabs" role="tablist" aria-label="Liquidity tabs">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "add"}
              className={cx("swap-card__tab", mode === "add" && "is-active")}
              onClick={() => setTab("add")}
            >
              Add
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "remove"}
              className={cx("swap-card__tab", mode === "remove" && "is-active")}
              onClick={() => setTab("remove")}
            >
              Remove
            </button>
          </div>
          <div className="swap-card__subtitle">
            {mode === "add"
              ? `Provide assets to mint ${lpToken?.symbol || "LP"} tokens.`
              : `Burn ${lpToken?.symbol || "LP"} to withdraw underlying tokens.`}
          </div>
        </div>
      </div>

      <div className="swap-card__body">
        {mode === "add" ? (
          <>
            <div className="field-group">
              <span className="field-label">Token A contract</span>
              <input
                value={tokenAAddress || ""}
                onChange={(e) => onChangeTokenAAddress && onChangeTokenAAddress(e.target.value)}
                placeholder="Enter token A contract"
                type="text"
                spellCheck={false}
              />
            </div>

            <div className="field-group">
              <span className="field-label">Token B contract</span>
              <input
                value={tokenBAddress || ""}
                onChange={(e) => onChangeTokenBAddress && onChangeTokenBAddress(e.target.value)}
                placeholder="Enter token B contract"
                type="text"
                spellCheck={false}
              />
            </div>

            <div className="field-group">
              <button
                type="button"
                className="ghost-cta full"
                onClick={onApplyTokenAddresses}
              >
                Apply token addresses
              </button>
            </div>

            <div className="swap-input-block">
              <div className="swap-input-block__top">
                <span className="swap-input-block__label">Amount {displayTokenA?.symbol || "Token A"}</span>
                <span className="swap-input-block__balance">{balanceA || ""}</span>
              </div>
              <div className="swap-input">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.0"
                  value={amountA || ""}
                  onChange={(e) => onChangeAmountA && onChangeAmountA(e.target.value)}
                />
                <div className="token-select">
                  <button type="button" className="token-trigger" onClick={onSelectTokenA}>
                    <img
                      className="token-trigger-icon"
                      src={getTokenLogo(displayTokenA)}
                      alt={displayTokenA?.symbol || "Token A"}
                      onError={(e) => {
                        if (e && e.target && e.target.src) {
                          e.target.src = "/tokens/default.svg";
                        }
                      }}
                    />
                    <span className="token-trigger-symbol">{displayTokenA?.symbol || "—"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="swap-input-block">
              <div className="swap-input-block__top">
                <span className="swap-input-block__label">Amount {tokenB?.symbol || "Token B"}</span>
                <span className="swap-input-block__balance">{balanceB || ""}</span>
              </div>
              <div className="swap-input">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.0"
                  value={amountB || ""}
                  onChange={(e) => onChangeAmountB && onChangeAmountB(e.target.value)}
                />
                <div className="token-select">
                  <button type="button" className="token-trigger" onClick={onSelectTokenB}>
                    <img
                      className="token-trigger-icon"
                      src={getTokenLogo(displayTokenB)}
                      alt={displayTokenB?.symbol || "Token B"}
                      onError={(e) => {
                        if (e && e.target && e.target.src) {
                          e.target.src = "/tokens/default.svg";
                        }
                      }}
                    />
                    <span className="token-trigger-symbol">{displayTokenB?.symbol || "—"}</span>
                  </button>
                </div>
              </div>
            </div>

            {mintPreview && (
              <div className="swap-summary">
                <div className="swap-summary__row">
                  <span>Est. mint</span>
                  <span>{mintPreview.formatted} {lpToken?.symbol || "LP"}</span>
                </div>
                <div className="swap-summary__row">
                  <span>Pool share</span>
                  <span>{((mintPreview.share || 0) * 100).toFixed(4)}%</span>
                </div>
              </div>
            )}

            <button
              type="button"
              className="primary-cta full"
              onClick={onAddLiquidity}
              disabled={!canAdd}
            >
              Add liquidity
            </button>
            {addStatus && <p className="status">{addStatus}</p>}
          </>
        ) : (
          <>
            <div className="field-group">
              <span className="field-label">LP amount</span>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0.0"
                value={lpAmount || ""}
                onChange={(e) => onChangeLpAmount && onChangeLpAmount(e.target.value)}
              />
            </div>

            {withdrawPreview && (
              <div className="swap-summary">
                <div className="swap-summary__row">
                  <span>Est. withdraw</span>
                  <span>{withdrawPreview.formattedA} {tokenA?.symbol}</span>
                </div>
                <div className="swap-summary__row">
                  <span>+</span>
                  <span>{withdrawPreview.formattedB} {tokenB?.symbol}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              className="ghost-cta full"
              onClick={onRemoveLiquidity}
              disabled={!canRemove}
            >
              Remove liquidity
            </button>
            {removeStatus && <p className="status">{removeStatus}</p>}
          </>
        )}
      </div>
    </div>
  );
}
