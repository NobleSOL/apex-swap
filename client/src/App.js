import { useState } from "react";
import "./App.css";
import logo from "./ApeX-logo.png"; // make sure logo file is here or in /public

export default function App() {
  const [fromAsset, setFromAsset] = useState("USDC");
  const [toAsset, setToAsset] = useState("kUSD");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");

  const handleSwap = async () => {
  setStatus("Processing swap...");

  try {
    const res = await fetch("/.netlify/functions/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAsset,
        to: toAsset,
        amount,
        wallet: "user-wallet-address", // TODO: replace with connected wallet
      }),
    });

    const data = await res.json();

    if (res.ok) {
      setStatus(`Swap complete ✅ TX: ${data.tx.hash}, Output: ${data.outputAmount} ${toAsset}`);
    } else {
      setStatus(`Error: ${data.error}`);
    }
  } catch (err) {
    setStatus(`Request failed: ${err.message}`);
  }
};


  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <img src={logo} alt="ApeX Logo" className="logo" />
        <h1>ApeX Swap</h1>
      </header>

      {/* Swap Box */}
      <div className="swap-box">
        <h2>Cross-Chain Swap</h2>

        <label>
          From:
          <select value={fromAsset} onChange={(e) => setFromAsset(e.target.value)}>
            <option value="USDC">USDC</option>
            <option value="SOL">SOL</option>
            <option value="ETH">ETH</option>
          </select>
        </label>

        <label>
          To:
          <select value={toAsset} onChange={(e) => setToAsset(e.target.value)}>
            <option value="kUSD">kUSD</option>
            <option value="BTC">BTC</option>
            <option value="SOL">SOL</option>
          </select>
        </label>

        <input
          type="text"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <button onClick={handleSwap}>Swap</button>

        {status && <p className="status">{status}</p>}
      </div>
    </div>
  );
}
