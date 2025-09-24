import React, { useState } from "react";

function App() {
  const [fromAsset, setFromAsset] = useState("APE");
  const [toAsset, setToAsset] = useState("USDC");
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
        setStatus(
          `Swap complete ✅ TX: ${data.tx.hash}, Output: ${data.outputAmount} ${toAsset}`
        );
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatus(`Request failed: ${err.message}`);
    }
  };

  return (
    <div className="App">
      <h1>ApeX Swap</h1>

      <div>
        <label>From Asset:</label>
        <input
          value={fromAsset}
          onChange={(e) => setFromAsset(e.target.value)}
        />
      </div>

      <div>
        <label>To Asset:</label>
        <input value={toAsset} onChange={(e) => setToAsset(e.target.value)} />
      </div>

      <div>
        <label>Amount:</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      <button onClick={handleSwap}>Swap</button>

      <p>{status}</p>
    </div>
  );
}

export default App;
