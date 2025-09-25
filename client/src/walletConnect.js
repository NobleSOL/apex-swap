import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Reads WC project id from env or window for flexibility
function getProjectId() {
  return (
    process.env.REACT_APP_WC_PROJECT_ID ||
    window.WALLETCONNECT_PROJECT_ID ||
    ""
  );
}

function getChains() {
  const raw = process.env.REACT_APP_WC_CHAINS || window.WALLETCONNECT_CHAINS || "eip155:1";
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getSolanaChains() {
  const raw = process.env.REACT_APP_WC_SOLANA_CHAINS || window.WALLETCONNECT_SOLANA_CHAINS || "";
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function useWalletConnect() {
  const [ready, setReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const providerRef = useRef(null);

  const projectId = useMemo(getProjectId, []);
  const chains = useMemo(getChains, []);
  const solChains = useMemo(getSolanaChains, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { default: UniversalProvider } = await import("@walletconnect/universal-provider");
        if (!mounted) return;
        const provider = await UniversalProvider.init({ projectId, logger: "error" });
        providerRef.current = provider;

        // When provider wants user to open a URI, open in new tab/window.
        provider.on("display_uri", (uri) => {
          try {
            // Try opening a deep-link which wallet apps can catch, fallback to new tab.
            window.open(uri, "_blank");
          } catch (_) {
            // no-op
          }
        });

        provider.on("session_delete", () => {
          setIsConnected(false);
          setAddress("");
        });

        setReady(true);
      } catch (e) {
        setError(e?.message || String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [projectId, chains, solChains]);

  const connect = useCallback(async () => {
    setError("");
    if (!providerRef.current) throw new Error("WalletConnect provider not ready");
    if (!projectId) throw new Error("WalletConnect projectId is missing");
    setIsConnecting(true);
    try {
      const provider = providerRef.current;
      const ns = {};
      if (chains.length) {
        ns.eip155 = {
          methods: [
            "eth_sendTransaction",
            "personal_sign",
            "eth_signTypedData",
            "eth_sign",
            "eth_requestAccounts",
          ],
          events: ["chainChanged", "accountsChanged"],
          chains,
        };
      }
      if (solChains.length) {
        ns.solana = {
          methods: [
            "solana_signMessage",
            "solana_signTransaction",
            "solana_signAndSendTransaction"
          ],
          events: ["chainChanged", "accountsChanged"],
          chains: solChains,
        };
      }
      const session = await provider.connect({ namespaces: ns });
      const evmAccounts = session?.namespaces?.eip155?.accounts || [];
      const solAccounts = session?.namespaces?.solana?.accounts || [];
      const first = (evmAccounts[0] || solAccounts[0]) || "";
      const addr = first ? first.split(":").pop() : "";
      setAddress(addr || "");
      setIsConnected(Boolean(addr));
      return addr;
    } catch (e) {
      setError(e?.message || String(e));
      throw e;
    } finally {
      setIsConnecting(false);
    }
  }, [chains, solChains, projectId]);

  const disconnect = useCallback(async () => {
    setError("");
    try {
      const provider = providerRef.current;
      if (provider && provider.session) {
        await provider.disconnect();
      }
    } catch (e) {
      // ignore
    } finally {
      setIsConnected(false);
      setAddress("");
    }
  }, []);

  return { ready, isConnecting, isConnected, address, error, connect, disconnect };
}
