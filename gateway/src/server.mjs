import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

import {
  encryptHandoff,
  signState,
  validateClientPublicKey,
  validateLocalState,
  validateLoopbackCallback,
  verifyState,
} from "./protocol.mjs";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];
const MAX_BODY_BYTES = 64 * 1024;
const STATE_TTL_MS = 10 * 60_000;

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function loadConfig() {
  const publicBaseUrl = new URL(requiredEnvironment("PUBLIC_BASE_URL"));
  if (publicBaseUrl.protocol !== "https:" || publicBaseUrl.search || publicBaseUrl.hash) {
    throw new Error("PUBLIC_BASE_URL must be an HTTPS URL without a query or fragment");
  }
  return {
    port: Number(process.env.PORT ?? "3000"),
    publicBaseUrl: publicBaseUrl.toString().replace(/\/$/u, ""),
    clientId: requiredEnvironment("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: requiredEnvironment("GOOGLE_OAUTH_CLIENT_SECRET"),
    stateSecret: requiredEnvironment("OAUTH_STATE_SECRET"),
  };
}

function headers() {
  return {
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
}

function respondJson(response, status, payload) {
  response.writeHead(status, { ...headers(), "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function respondHtml(response, status, title, detail) {
  response.writeHead(status, { ...headers(), "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><title>${title}</title><h1>${title}</h1><p>${detail}</p>`);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error("request body is too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("request body must be JSON"));
      }
    });
    request.on("error", reject);
  });
}

async function exchangeToken(form) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form),
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok || !body || typeof body !== "object") {
      throw new Error("Google token exchange failed");
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function isTokenResponse(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.access_token === "string" &&
    typeof value.expires_in === "number"
  );
}

function createAuthorizationUrl(config, signedState) {
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", `${config.publicBaseUrl}/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", signedState);
  return url.toString();
}

function startGoogleLogin(requestUrl, response, config) {
  try {
    const callback = validateLoopbackCallback(requestUrl.searchParams.get("callback") ?? "");
    const localState = validateLocalState(requestUrl.searchParams.get("state") ?? "");
    const publicKey = validateClientPublicKey(requestUrl.searchParams.get("public_key") ?? "");
    const signedState = signState(
      {
        v: 1,
        exp: Date.now() + STATE_TTL_MS,
        nonce: randomBytes(16).toString("base64url"),
        callback,
        localState,
        publicKey,
      },
      config.stateSecret,
    );
    response.writeHead(302, { ...headers(), location: createAuthorizationUrl(config, signedState) });
    response.end();
  } catch {
    respondJson(response, 400, { error: "invalid_start_request" });
  }
}

async function completeGoogleLogin(requestUrl, response, config) {
  const signedState = requestUrl.searchParams.get("state");
  const claims = signedState ? verifyState(signedState, config.stateSecret) : null;
  if (!claims) {
    respondHtml(response, 400, "AItraffic authorization failed", "This sign-in link expired or is invalid. Return to the terminal and try again.");
    return;
  }
  if (requestUrl.searchParams.has("error")) {
    respondHtml(response, 400, "AItraffic authorization was not completed", "Return to the terminal and try again when ready.");
    return;
  }
  const code = requestUrl.searchParams.get("code");
  if (!code || code.length > 4_096) {
    respondHtml(response, 400, "AItraffic authorization failed", "Google did not return a usable authorization response.");
    return;
  }
  try {
    const token = await exchangeToken({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${config.publicBaseUrl}/google/callback`,
    });
    if (!isTokenResponse(token)) throw new Error("invalid Google token response");
    const encrypted = encryptHandoff(
      {
        accessToken: token.access_token,
        ...(typeof token.refresh_token === "string" ? { refreshToken: token.refresh_token } : {}),
        expiresIn: token.expires_in,
        scopes: typeof token.scope === "string" ? token.scope.split(/\s+/u).filter(Boolean) : [],
        ...(typeof token.token_type === "string" ? { tokenType: token.token_type } : {}),
      },
      claims.publicKey,
      claims.localState,
    );
    const callback = new URL(claims.callback);
    callback.searchParams.set("state", claims.localState);
    callback.searchParams.set("handoff", encrypted);
    response.writeHead(302, { ...headers(), location: callback.toString() });
    response.end();
  } catch {
    respondHtml(response, 502, "AItraffic authorization failed", "Google could not complete the secure connection. Return to the terminal and try again.");
  }
}

async function refreshGoogleToken(request, response, config) {
  let body;
  try {
    body = await readJson(request);
  } catch {
    respondJson(response, 400, { error: "invalid_request" });
    return;
  }
  if (!body || typeof body !== "object" || typeof body.refreshToken !== "string" || body.refreshToken.length > 4_096) {
    respondJson(response, 400, { error: "invalid_request" });
    return;
  }
  try {
    const token = await exchangeToken({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: body.refreshToken,
      grant_type: "refresh_token",
    });
    if (!isTokenResponse(token)) throw new Error("invalid Google token response");
    respondJson(response, 200, {
      accessToken: token.access_token,
      expiresIn: token.expires_in,
      scopes: typeof token.scope === "string" ? token.scope.split(/\s+/u).filter(Boolean) : [],
      ...(typeof token.token_type === "string" ? { tokenType: token.token_type } : {}),
    });
  } catch {
    respondJson(response, 502, { error: "token_refresh_failed" });
  }
}

export function createGatewayServer(config) {
  const basePath = new URL(config.publicBaseUrl).pathname.replace(/\/$/u, "");
  return createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", config.publicBaseUrl);
    if (request.method === "GET" && requestUrl.pathname === `${basePath}/health`) {
      respondJson(response, 200, { ok: true });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === `${basePath}/google/start`) {
      startGoogleLogin(requestUrl, response, config);
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === `${basePath}/google/callback`) {
      await completeGoogleLogin(requestUrl, response, config);
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === `${basePath}/google/refresh`) {
      await refreshGoogleToken(request, response, config);
      return;
    }
    respondJson(response, 404, { error: "not_found" });
  });
}

const config = loadConfig();
const server = createGatewayServer(config);
server.listen(config.port, "0.0.0.0", () => {
  process.stdout.write(`AItraffic OAuth gateway listening on port ${config.port}\n`);
});
