const { randomUUID } = require("crypto");

const KEETA_CHAIN = "keeta";
const DEFAULT_KEETA_TOKENS = ["KUSD", "KSOL", "KETH", "KBTC"];
const NETWORK = process.env.KEETA_NETWORK || "keeta-mainnet";
const DEFAULT_ANCHOR_ID =
  process.env.KEETA_DEFAULT_ANCHOR_ID || `${NETWORK}-native-anchor`;

let RealKeetaClientCtor = null;
try {
  // Support different export styles from the SDK (CommonJS / ESM default exports).
  const maybeModule = require("@keeta/sdk");
  const candidateCtors = [];
  if (typeof maybeModule === "function") {
    candidateCtors.push(maybeModule);
  }
  if (maybeModule && typeof maybeModule.KeetaClient === "function") {
    candidateCtors.push(maybeModule.KeetaClient);
  }
  if (maybeModule && typeof maybeModule.default === "function") {
    candidateCtors.push(maybeModule.default);
  }

  RealKeetaClientCtor = candidateCtors.find(
    (ctor) => typeof ctor === "function" && ctor.__isKeetaPlaceholder !== true
  );
} catch (err) {
  // The SDK is optional for local development; fall back to a mock client below.
  RealKeetaClientCtor = null;
}

class MockKeetaClient {
  constructor(opts = {}) {
    this.opts = opts;
  }

  async swap({ from, to, amount, user, anchors, slippageBps, feeBps, quoteId, metadata }) {
    return {
      hash: `0xMOCK${randomUUID().replace(/-/g, "")}`,
      network: this.opts.network || NETWORK,
      from,
      to,
      amount,
      user,
      anchors,
      slippageBps,
      feeBps,
      quoteId,
      metadata,
      mock: true,
      timestamp: new Date().toISOString(),
    };
  }
}

let cachedAnchors = null;

function createKeetaClient(anchors) {
  if (RealKeetaClientCtor) {
    const config = { network: NETWORK };
    if (anchors?.length) {
      config.anchors = anchors;
    }
    if (process.env.KEETA_API_KEY) {
      config.apiKey = process.env.KEETA_API_KEY;
    }
    return new RealKeetaClientCtor(config);
  }
  return new MockKeetaClient({ network: NETWORK, anchors });
}

function loadAnchors() {
  if (cachedAnchors) {
    return cachedAnchors;
  }

  const anchors = [];

  if (process.env.KEETA_ANCHORS) {
    try {
      const parsed = JSON.parse(process.env.KEETA_ANCHORS);
      if (Array.isArray(parsed)) {
        parsed.forEach((entry) => {
          const anchor = normalizeKeetaAnchor(entry);
          if (anchor) anchors.push(anchor);
        });
      } else {
        throw new Error("KEETA_ANCHORS must be a JSON array");
      }
    } catch (err) {
      throw new Error(`Unable to parse KEETA_ANCHORS: ${err.message}`);
    }
  }

  const anchorFromEnv = process.env.KEETA_NATIVE_ANCHOR;
  if (anchorFromEnv) {
    try {
      const parsed = JSON.parse(anchorFromEnv);
      if (Array.isArray(parsed)) {
        parsed.forEach((entry) => {
          const anchor = normalizeKeetaAnchor(entry);
          if (anchor) anchors.push(anchor);
        });
      } else {
        const anchor = normalizeKeetaAnchor(parsed);
        if (anchor) {
          anchors.push(anchor);
        }
      }
    } catch (err) {
      const anchor = normalizeKeetaAnchor({
        id: DEFAULT_ANCHOR_ID,
        address: anchorFromEnv,
      });
      if (anchor) {
        anchors.push(anchor);
      }
    }
  }

  const candidateAnchorId = process.env.KEETA_ANCHOR_ID || DEFAULT_ANCHOR_ID;
  const candidateAddress =
    process.env.KEETA_ADDRESS || process.env.KEETA_NATIVE_ADDRESS;
  const candidatePublicKey =
    process.env.KEETA_PUBLIC_KEY || process.env.KEETA_NATIVE_PUBLIC_KEY;
  const candidateEndpoint =
    process.env.KEETA_RPC_ENDPOINT || process.env.KEETA_ENDPOINT;

  if (candidateAddress || candidatePublicKey || candidateEndpoint) {
    const anchor = normalizeKeetaAnchor({
      id: candidateAnchorId,
      address: candidateAddress,
      publicKey: candidatePublicKey,
      endpoint: candidateEndpoint,
    });
    if (anchor) {
      anchors.push(anchor);
    }
  }

  if (!anchors.length) {
    anchors.push(
      normalizeKeetaAnchor({
        id: candidateAnchorId,
        endpoint: candidateEndpoint,
      })
    );
  }

  const deduped = [];
  const seen = new Set();
  anchors.forEach((anchor) => {
    if (!anchor) return;
    const key = anchor.id || JSON.stringify(anchor);
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(anchor);
  });

  cachedAnchors = deduped;

  if (!cachedAnchors.length) {
    throw new Error("No Keeta anchors configured");
  }

  return cachedAnchors;
}

function normalizeAnchor(anchor) {
  if (!anchor || typeof anchor !== "object") {
    return null;
  }

  const tokens = extractAnchorTokens(anchor);
  const normalized = {
    id: String(anchor.id || anchor.anchorId || anchor.name || ""),
    chain: anchor.chain ? String(anchor.chain) : undefined,
    address: anchor.address || anchor.contractAddress || undefined,
    publicKey: anchor.publicKey || anchor.mint || undefined,
    endpoint: anchor.endpoint || anchor.rpc || undefined,
    tokens,
    decimals: typeof anchor.decimals === "number" ? anchor.decimals : undefined,
  };

  if (!normalized.id) {
    return null;
  }

  return compactObject(normalized);
}

function normalizeKeetaAnchor(anchor) {
  if (!anchor) {
    return null;
  }

  if (Array.isArray(anchor)) {
    return null;
  }

  const base =
    anchor && typeof anchor === "object"
      ? { ...anchor }
      : { address: anchor };

  if (!base.id && !base.anchorId && !base.name) {
    base.id = DEFAULT_ANCHOR_ID;
  }

  if (!base.tokens || (Array.isArray(base.tokens) && base.tokens.length === 0)) {
    base.tokens = DEFAULT_KEETA_TOKENS;
  }

  base.chain = KEETA_CHAIN;

  const normalized = normalizeAnchor(base);
  if (!normalized) {
    return null;
  }

  const tokens =
    normalized.tokens && normalized.tokens.length
      ? normalized.tokens
      : DEFAULT_KEETA_TOKENS;

  return compactObject({
    ...normalized,
    chain: KEETA_CHAIN,
    tokens,
  });
}

function extractAnchorTokens(anchor) {
  if (!anchor) return [];
  const raw = anchor.tokens || anchor.assets || anchor.currencies || [];
  if (Array.isArray(raw)) {
    return raw
      .map((token) => (typeof token === "string" ? token : token?.symbol))
      .filter(Boolean)
      .map((token) => token.toUpperCase());
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => token.toUpperCase());
  }
  return [];
}

function compactObject(obj) {
  return Object.keys(obj).reduce((acc, key) => {
    if (obj[key] !== undefined && obj[key] !== null) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
}

function resolveAnchorForToken(symbol, anchors) {
  const normalizedSymbol = symbol.toUpperCase();
  const anchor = anchors.find((entry) => {
    if (entry.tokens?.some((token) => token.toUpperCase() === normalizedSymbol)) {
      return true;
    }
    if (entry.id && entry.id.toUpperCase().includes(normalizedSymbol)) {
      return true;
    }
    return false;
  });

  if (!anchor) {
    throw new Error(`No anchor configured for asset ${normalizedSymbol}`);
  }

  return anchor;
}

function parseRequestBody(body) {
  if (!body) {
    throw new Error("Request body is empty");
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch (err) {
    throw new Error("Request body must be valid JSON");
  }

  const { from, to, amount, wallet, slippage, feeBps, quoteId } = payload || {};

  if (!from || typeof from !== "string") {
    throw new Error("Missing 'from' asset symbol");
  }
  if (!to || typeof to !== "string") {
    throw new Error("Missing 'to' asset symbol");
  }
  if (!wallet || typeof wallet !== "string") {
    throw new Error("Missing 'wallet' identifier");
  }

  const normalizedAmount = normalizeAmount(amount);
  const slippageBps = normalizeOptionalNumber(slippage, "slippage");
  const normalizedFeeBps = normalizeOptionalNumber(feeBps, "feeBps");

  const parsedQuoteId = typeof quoteId === "string" && quoteId.trim() ? quoteId.trim() : undefined;

  return {
    from: from.toUpperCase(),
    to: to.toUpperCase(),
    amount: normalizedAmount,
    wallet: wallet.trim(),
    slippageBps: slippageBps != null ? Math.round(slippageBps * 100) : undefined,
    feeBps: normalizedFeeBps != null ? Math.round(normalizedFeeBps) : undefined,
    quoteId: parsedQuoteId,
  };
}

function normalizeAmount(value) {
  if (value === undefined || value === null) {
    throw new Error("Missing 'amount'");
  }

  const numeric = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("'amount' must be a positive number");
  }
  return numeric.toString();
}

function normalizeOptionalNumber(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const numeric = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`'${fieldName}' must be a non-negative number`);
  }
  return numeric;
}

function buildSwapPayload(parsedInput, fromAnchor, toAnchor, requestId) {
  const anchorsPayload = {
    from: compactObject({
      id: fromAnchor.id,
      chain: fromAnchor.chain,
      address: fromAnchor.address,
      publicKey: fromAnchor.publicKey,
      tokens: fromAnchor.tokens,
    }),
    to: compactObject({
      id: toAnchor.id,
      chain: toAnchor.chain,
      address: toAnchor.address,
      publicKey: toAnchor.publicKey,
      tokens: toAnchor.tokens,
    }),
  };

  const payload = {
    from: parsedInput.from,
    to: parsedInput.to,
    amount: parsedInput.amount,
    user: parsedInput.wallet,
    anchors: anchorsPayload,
    metadata: { requestId },
  };

  if (parsedInput.slippageBps !== undefined) {
    payload.slippageBps = parsedInput.slippageBps;
  }
  if (parsedInput.feeBps !== undefined) {
    payload.feeBps = parsedInput.feeBps;
  }
  if (parsedInput.quoteId) {
    payload.quoteId = parsedInput.quoteId;
  }

  return payload;
}

exports.handler = async (event) => {
  if (event.httpMethod && event.httpMethod.toUpperCase() !== "POST") {
    return {
      statusCode: 405,
      headers: { Allow: "POST" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  let parsedInput;
  try {
    parsedInput = parseRequestBody(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err.message }),
    };
  }

  try {
    const anchors = loadAnchors();
    const fromAnchor = resolveAnchorForToken(parsedInput.from, anchors);
    const toAnchor = resolveAnchorForToken(parsedInput.to, anchors);
    const client = createKeetaClient(anchors);
    const requestId = randomUUID();

    const swapPayload = buildSwapPayload(parsedInput, fromAnchor, toAnchor, requestId);
    const tx = await client.swap(swapPayload);

    return {
      statusCode: 200,
      body: JSON.stringify({
        tx,
        anchors: {
          from: swapPayload.anchors.from,
          to: swapPayload.anchors.to,
        },
        network: NETWORK,
        requestId,
        usingMockSdk: !RealKeetaClientCtor,
      }),
    };
  } catch (err) {
    console.error("Keeta swap failed", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
