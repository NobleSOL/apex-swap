const DEFAULT_ALLOWED_ORIGINS = ["https://builder.io"];

function parseEnvOrigins() {
  const value = process.env.CORS_ALLOWED_ORIGINS;
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const ENV_ALLOWED_ORIGINS = parseEnvOrigins();

const FLY_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+\.fly\.dev$/i;

function resolveAllowedOrigin(requestOrigin) {
  if (!requestOrigin) {
    return DEFAULT_ALLOWED_ORIGINS[0];
  }

  if (DEFAULT_ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }

  if (ENV_ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }

  if (FLY_ORIGIN_REGEX.test(requestOrigin)) {
    return requestOrigin;
  }

  return null;
}

function buildCorsHeaders(requestOrigin) {
  const allowedOrigin = resolveAllowedOrigin(requestOrigin);

  if (!allowedOrigin) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
}

export function withCors(handler) {
  return async function corsWrappedHandler(event, context) {
    const originHeader = event?.headers?.origin || event?.headers?.Origin;
    const corsHeaders = buildCorsHeaders(originHeader);

    if (event.httpMethod === "OPTIONS") {
      if (!corsHeaders) {
        return { statusCode: 403, body: "CORS origin not allowed" };
      }

      return {
        statusCode: 204,
        headers: {
          ...corsHeaders,
          "Access-Control-Max-Age": "600",
        },
        body: "",
      };
    }

    const response = await handler(event, context);

    if (!corsHeaders) {
      return response;
    }

    return {
      ...response,
      headers: {
        ...(response.headers || {}),
        ...corsHeaders,
      },
    };
  };
}
