export const allowedOrigins = [
  "https://builder.io",
  "https://dff096f353004955abe084143b09882c-32447fa1-2fa9-4a55-838e-4a32bc.fly.dev",
  "http://localhost:3000"
];

export function withCors(handler) {
  return async (event, context) => {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || "";
    const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Origin": allowOrigin,
          Vary: "Origin",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        },
        body: ""
      };
    }

    const response = await handler(event, context);
    return {
      ...response,
      headers: {
        "Access-Control-Allow-Origin": allowOrigin,
        Vary: "Origin",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        ...(response && response.headers ? response.headers : {})
      }
    };
  };
}
