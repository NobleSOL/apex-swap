import { withCors, allowedOrigins } from "./utils/cors.js";

const allowedHosts = new Set([
  "builder.io",
  "www.builder.io",
  "api.builder.io",
  "cdn.builder.io"
]);

function buildTargetFromParams(params) {
  const url = params && params.url;
  const path = params && params.path;
  if (url) {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:") throw new Error("Only https is allowed");
      if (!allowedHosts.has(u.hostname)) throw new Error("Host not allowed");
      return u.toString();
    } catch (e) {
      throw new Error("Invalid or disallowed url parameter");
    }
  }
  if (path) {
    const clean = path.replace(/^\/+/, "");
    if (clean.startsWith("api/")) return `https://api.builder.io/${clean.slice(4)}`;
    if (clean.startsWith("cdn/")) return `https://cdn.builder.io/${clean.slice(4)}`;
    return `https://builder.io/${clean}`;
  }
  throw new Error("Missing url or path query param");
}

const hopByHop = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length"
]);

const proxy = async (event) => {
  try {
    const target = buildTargetFromParams(event.queryStringParameters || {});

    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: {}, body: "" };
    }

    const headers = {};
    for (const [key, value] of Object.entries(event.headers || {})) {
      const k = key.toLowerCase();
      if (!hopByHop.has(k)) headers[k] = value;
    }

    const method = event.httpMethod || "GET";
    let body;
    if (method !== "GET" && method !== "HEAD") {
      body = event.isBase64Encoded ? Buffer.from(event.body || "", "base64") : event.body;
    }

    const resp = await fetch(target, { method, headers, body });

    const respHeaders = {};
    resp.headers.forEach((v, k) => {
      if (!hopByHop.has(k.toLowerCase())) respHeaders[k] = v;
    });

    const contentType = resp.headers.get("content-type") || "";
    const isBinary = !/(application\/json|text\/|application\/javascript|application\/xml|image\/svg\+xml)/i.test(contentType);

    if (isBinary) {
      const arrayBuf = await resp.arrayBuffer();
      const b64 = Buffer.from(arrayBuf).toString("base64");
      return {
        statusCode: resp.status,
        headers: respHeaders,
        isBase64Encoded: true,
        body: b64
      };
    } else {
      const text = await resp.text();
      return {
        statusCode: resp.status,
        headers: respHeaders,
        body: text
      };
    }
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err.message })
    };
  }
};

export const handler = withCors(proxy);
