import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import { AppError } from "../../core/result.js";
import { validateGoogleProfile } from "./config.js";
import type {
  GoogleCredentialVault,
  GoogleOAuthClient,
  GoogleOAuthProfile,
} from "./vault.js";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL =
  "https://openidconnect.googleapis.com/v1/userinfo";
const DEFAULT_WEB_REDIRECT_URI =
  "http://localhost:3000/api/auth/callback/google";
export const TRAFFICCLAW_DESKTOP_CLIENT_ID =
  "94795138733-oj8eovhdkgppu5k2j3oifcbhhl3l98lb.apps.googleusercontent.com";
export const TRAFFICCLAW_DESKTOP_REDIRECT_URI = "http://127.0.0.1:0/";
const LOGIN_TIMEOUT_MS = 10 * 60 * 1_000;

export const GOOGLE_READ_ONLY_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
] as const;
const REQUIRED_GOOGLE_SCOPES = new Set([
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
]);
const ALLOWED_GOOGLE_SCOPES = new Set([
  ...GOOGLE_READ_ONLY_SCOPES,
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
]);

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scopes: string[];
  tokenType?: string;
}

interface LoginDependencies {
  fetch?: typeof fetch;
  now?: () => Date;
  receiveAuthorizationCode?: (
    authorizationUrl: string,
    redirectUri: string,
    expectedState: string,
  ) => Promise<string>;
  onInstruction?: (message: string) => void;
}

interface AuthorizationCodeResult {
  code: string;
  redirectUri: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separator = normalized.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = normalized.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
      continue;
    }
    values[key] = unquote(normalized.slice(separator + 1));
  }
  return values;
}

export function validateGoogleRedirectUri(value: string): string {
  let redirect: URL;
  try {
    redirect = new URL(value);
  } catch {
    throw new AppError(
      "INVALID_GOOGLE_REDIRECT_URI",
      "Google redirect URI must be a valid loopback HTTP URL.",
    );
  }
  if (
    redirect.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(redirect.hostname) ||
    redirect.username !== "" ||
    redirect.password !== "" ||
    redirect.search !== "" ||
    redirect.hash !== "" ||
    redirect.port === ""
  ) {
    throw new AppError(
      "INVALID_GOOGLE_REDIRECT_URI",
      "Google redirect URI must use HTTP, a loopback hostname, an explicit port, and no query or fragment.",
    );
  }
  return redirect.toString();
}

export function parseGoogleOAuthClientJson(contents: string): {
  clientId: string;
  clientSecret?: string;
  clientType: "web" | "desktop";
  redirectUri: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new AppError(
      "GOOGLE_CLIENT_JSON_INVALID",
      "Google OAuth client JSON is not valid JSON.",
    );
  }
  if (!isRecord(parsed) || (!isRecord(parsed.web) && !isRecord(parsed.installed))) {
    throw new AppError(
      "GOOGLE_CLIENT_JSON_INVALID",
      "Google OAuth client JSON must contain a Web or Desktop application client.",
    );
  }
  if (isRecord(parsed.installed)) {
    const clientId = parsed.installed.client_id;
    const clientSecret = parsed.installed.client_secret;
    if (typeof clientId !== "string" || clientId.trim() === "") {
      throw new AppError(
        "GOOGLE_CLIENT_JSON_INVALID",
        "Google Desktop OAuth client JSON is missing a client ID.",
      );
    }
    return {
      clientId: clientId.trim(),
      ...(typeof clientSecret === "string" && clientSecret.trim() !== ""
        ? { clientSecret: clientSecret.trim() }
        : {}),
      clientType: "desktop",
      redirectUri: TRAFFICCLAW_DESKTOP_REDIRECT_URI,
    };
  }
  const web = parsed.web as Record<string, unknown>;
  const clientId = web.client_id;
  const clientSecret = web.client_secret;
  const redirectUris = web.redirect_uris;
  if (
    typeof clientId !== "string" ||
    clientId.trim() === "" ||
    typeof clientSecret !== "string" ||
    clientSecret.trim() === "" ||
    !Array.isArray(redirectUris) ||
    !redirectUris.every((value) => typeof value === "string")
  ) {
    throw new AppError(
      "GOOGLE_CLIENT_JSON_INVALID",
      "Google OAuth client JSON is missing required Web application fields.",
    );
  }
  let redirectUri: string | undefined;
  for (const value of redirectUris) {
    try {
      redirectUri = validateGoogleRedirectUri(value);
      break;
    } catch {
      continue;
    }
  }
  if (!redirectUri) {
    throw new AppError(
      "GOOGLE_CLIENT_JSON_INVALID",
      "Google OAuth client JSON must include an authorized loopback redirect URI.",
    );
  }
  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    clientType: "web",
    redirectUri,
  };
}

export async function configureTrafficClawDesktopOAuthClient(options: {
  vault: GoogleCredentialVault;
  now?: Date;
  replaceExisting?: boolean;
}): Promise<{
  configured: true;
  redirectUri: string;
  vaultBackend: { id: string; name: string };
}> {
  const existing = await options.vault.getClient();
  if (
    existing !== null &&
    existing.clientId !== TRAFFICCLAW_DESKTOP_CLIENT_ID &&
    options.replaceExisting !== true
  ) {
    throw new AppError(
      "GOOGLE_OAUTH_CLIENT_REPLACEMENT_REQUIRES_CONFIRMATION",
      "A different local Google OAuth client is already configured. Re-run with --replace only if you intend to reconnect existing profiles with TrafficClaw.",
    );
  }
  await options.vault.setClient({
    schemaVersion: "0.2.0",
    clientId: TRAFFICCLAW_DESKTOP_CLIENT_ID,
    clientType: "desktop",
    redirectUri: TRAFFICCLAW_DESKTOP_REDIRECT_URI,
    configuredAt: (options.now ?? new Date()).toISOString(),
  });
  return {
    configured: true,
    redirectUri: TRAFFICCLAW_DESKTOP_REDIRECT_URI,
    vaultBackend: options.vault.backendInfo(),
  };
}

export async function configureGoogleOAuthClient(options: {
  envFile?: string;
  clientJsonFile?: string;
  vault: GoogleCredentialVault;
  now?: Date;
}): Promise<{
  configured: true;
  redirectUri: string;
  vaultBackend: { id: string; name: string };
}> {
  if (Boolean(options.envFile) === Boolean(options.clientJsonFile)) {
    throw new AppError(
      "GOOGLE_OAUTH_CLIENT_SOURCE_INVALID",
      "Provide exactly one Google OAuth client source.",
    );
  }
  let clientId: string;
  let clientSecret: string | undefined;
  let clientType: "web" | "desktop";
  let redirectUri: string;
  if (options.envFile) {
    const envFile = path.resolve(options.envFile);
    let values: Record<string, string>;
    try {
      values = parseEnvFile(await readFile(envFile, "utf8"));
    } catch {
      throw new AppError(
        "GOOGLE_ENV_FILE_UNREADABLE",
        `Cannot read Google OAuth environment file: ${envFile}`,
      );
    }
    clientId = values.GOOGLE_CLIENT_ID?.trim() ?? "";
    clientSecret = values.GOOGLE_CLIENT_SECRET?.trim() ?? "";
    clientType = values.GOOGLE_CLIENT_TYPE?.trim() === "desktop" ? "desktop" : "web";
    if (!clientId || (clientType === "web" && !clientSecret)) {
      throw new AppError(
        "GOOGLE_OAUTH_CLIENT_MISSING",
        clientType === "desktop"
          ? "Environment file must define GOOGLE_CLIENT_ID."
          : "Environment file must define GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      );
    }
    redirectUri = validateGoogleRedirectUri(
      values.GOOGLE_REDIRECT_URI?.trim() ||
        (clientType === "desktop"
          ? TRAFFICCLAW_DESKTOP_REDIRECT_URI
          : DEFAULT_WEB_REDIRECT_URI),
    );
  } else {
    const clientJsonFile = path.resolve(options.clientJsonFile ?? "");
    let contents: string;
    try {
      contents = await readFile(clientJsonFile, "utf8");
    } catch {
      throw new AppError(
        "GOOGLE_CLIENT_JSON_UNREADABLE",
        `Cannot read Google OAuth client JSON: ${clientJsonFile}`,
      );
    }
    ({ clientId, clientSecret, clientType, redirectUri } =
      parseGoogleOAuthClientJson(contents));
  }
  const client: GoogleOAuthClient = {
    schemaVersion: "0.2.0",
    clientId,
    ...(clientSecret ? { clientSecret } : {}),
    clientType,
    redirectUri,
    configuredAt: (options.now ?? new Date()).toISOString(),
  };
  await options.vault.setClient(client);
  return {
    configured: true,
    redirectUri,
    vaultBackend: options.vault.backendInfo(),
  };
}

function base64Url(value: Buffer): string {
  return value.toString("base64url");
}

export function createPkcePair(): {
  verifier: string;
  challenge: string;
} {
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(
    createHash("sha256").update(verifier).digest(),
  );
  return { verifier, challenge };
}

export function buildGoogleAuthorizationUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_READ_ONLY_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge", options.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function googleOAuthClientKey(clientId: string): string {
  return createHash("sha256").update(clientId).digest("base64url");
}

export async function resolveGoogleOAuthClient(
  vault: GoogleCredentialVault,
): Promise<GoogleOAuthClient | null> {
  return vault.getClient();
}

export function hasRequiredGoogleScopes(scopes: string[]): boolean {
  const granted = new Set(scopes);
  return [...REQUIRED_GOOGLE_SCOPES].every((scope) => granted.has(scope));
}

export function hasSafeGoogleScopes(scopes: string[]): boolean {
  return (
    hasRequiredGoogleScopes(scopes) &&
    scopes.every((scope) => ALLOWED_GOOGLE_SCOPES.has(scope))
  );
}

function validateGrantedGoogleScopes(scopes: string[]): void {
  if (scopes.some((scope) => !ALLOWED_GOOGLE_SCOPES.has(scope))) {
    throw new AppError(
      "GOOGLE_SCOPE_BOUNDARY_VIOLATION",
      "Google returned a scope outside AItraffic's read-only allowlist. The grant was not stored.",
      1,
    );
  }
  if (!hasSafeGoogleScopes(scopes)) {
    throw new AppError(
      "GOOGLE_REQUIRED_SCOPE_MISSING",
      "Google Analytics or Search Console read-only consent was not granted. The profile was not stored.",
    );
  }
}

function openAuthorizationUrl(url: string): void {
  const command =
    process.platform === "darwin"
      ? { executable: "open", args: [url] }
      : process.platform === "win32"
        ? {
            executable: "rundll32",
            args: ["url.dll,FileProtocolHandler", url],
          }
        : { executable: "xdg-open", args: [url] };
  try {
    const child = spawn(command.executable, command.args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("error", () => undefined);
    child.unref();
  } catch {
    return;
  }
}

async function receiveLocalAuthorizationCode(
  options: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
  },
  expectedState: string,
  onInstruction?: (message: string) => void,
): Promise<AuthorizationCodeResult> {
  const redirect = new URL(options.redirectUri);
  const port = Number(redirect.port);
  const host = redirect.hostname === "[::1]" ? "::1" : redirect.hostname;

  return new Promise<AuthorizationCodeResult>((resolve, reject) => {
    const browserHeaders = {
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'",
      "content-type": "text/html; charset=utf-8",
      "x-content-type-options": "nosniff",
    };
    let settled = false;
    let activeRedirect = new URL(redirect);
    const finish = (error: Error | null, code?: string) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      server.close();
      if (error) {
        reject(error);
      } else if (code !== undefined) {
        resolve({ code, redirectUri: activeRedirect.toString() });
      }
    };
    const server = createServer((request, response) => {
      const requestUrl = new URL(
        request.url ?? "/",
        `${activeRedirect.protocol}//${activeRedirect.host}`,
      );
      if (
        request.method !== "GET" ||
        requestUrl.pathname !== activeRedirect.pathname
      ) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      const state = requestUrl.searchParams.get("state");
      const code = requestUrl.searchParams.get("code");
      const oauthError = requestUrl.searchParams.get("error");
      if (state !== expectedState) {
        response.writeHead(400, browserHeaders);
        response.end(
          "<h1>AItraffic authorization failed</h1><p>State validation failed. Return to the terminal.</p>",
        );
        finish(
          new AppError(
            "GOOGLE_OAUTH_STATE_MISMATCH",
            "Google OAuth state validation failed.",
            1,
          ),
        );
        return;
      }
      if (oauthError || !code) {
        response.writeHead(400, browserHeaders);
        response.end(
          "<h1>AItraffic authorization was not completed</h1><p>Return to the terminal.</p>",
        );
        finish(
          new AppError(
            "GOOGLE_OAUTH_DENIED",
            "Google authorization was denied or cancelled.",
          ),
        );
        return;
      }
      response.writeHead(200, browserHeaders);
      response.end(
        "<h1>AItraffic is connected</h1><p>You can close this tab and return to the terminal.</p>",
      );
      finish(null, code);
    });
    server.once("error", () => {
      finish(
        new AppError(
          "GOOGLE_CALLBACK_UNAVAILABLE",
          `Cannot listen on ${redirect.origin}. Close the process using that port or configure another exact redirect URI.`,
          1,
        ),
      );
    });
    server.listen(port, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        finish(
          new AppError(
            "GOOGLE_CALLBACK_UNAVAILABLE",
            "Cannot determine the local Google OAuth callback address.",
            1,
          ),
        );
        return;
      }
      activeRedirect = new URL(redirect);
      activeRedirect.port = String(address.port);
      const authorizationUrl = buildGoogleAuthorizationUrl({
        clientId: options.clientId,
        redirectUri: activeRedirect.toString(),
        state: options.state,
        codeChallenge: options.codeChallenge,
      });
      openAuthorizationUrl(authorizationUrl);
      onInstruction?.(
        `Complete Google consent in your browser. If a tab did not open, use:\n${authorizationUrl}`,
      );
    });
    const timeout = setTimeout(() => {
      finish(
        new AppError(
          "GOOGLE_OAUTH_TIMEOUT",
          "Google authorization timed out before the callback was received.",
        ),
      );
    }, LOGIN_TIMEOUT_MS);
    timeout.unref();
  });
}

async function parseTokenResponse(response: Response): Promise<TokenResponse> {
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  if (
    !response.ok ||
    !isRecord(parsed) ||
    typeof parsed.access_token !== "string" ||
    typeof parsed.expires_in !== "number"
  ) {
    const reason =
      isRecord(parsed) &&
      typeof parsed.error === "string" &&
      /^[a-z_]{1,64}$/u.test(parsed.error)
        ? parsed.error
        : undefined;
    throw new AppError(
      "GOOGLE_TOKEN_EXCHANGE_FAILED",
      "Google did not issue a usable OAuth token.",
      1,
      reason === undefined
        ? { status: response.status }
        : { status: response.status, reason },
    );
  }
  const token: TokenResponse = {
    accessToken: parsed.access_token,
    expiresIn: parsed.expires_in,
    scopes:
      typeof parsed.scope === "string"
        ? parsed.scope.split(/\s+/u).filter(Boolean)
        : [],
  };
  if (typeof parsed.refresh_token === "string") {
    token.refreshToken = parsed.refresh_token;
  }
  if (typeof parsed.token_type === "string") {
    token.tokenType = parsed.token_type;
  }
  return token;
}

async function exchangeAuthorizationCode(options: {
  fetch: typeof fetch;
  client: GoogleOAuthClient;
  code: string;
  verifier: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: options.client.clientId,
    code: options.code,
    code_verifier: options.verifier,
    grant_type: "authorization_code",
    redirect_uri: options.redirectUri,
  });
  if (options.client.clientSecret) {
    body.set("client_secret", options.client.clientSecret);
  }
  const response = await options.fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  return parseTokenResponse(response);
}

async function bestEffortRevoke(
  fetchImplementation: typeof fetch,
  token: string,
): Promise<void> {
  try {
    await fetchImplementation(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch {
    return;
  }
}

async function fetchGoogleSubject(
  fetchImplementation: typeof fetch,
  accessToken: string,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchImplementation(GOOGLE_USERINFO_URL, {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });
  } catch {
    throw new AppError(
      "GOOGLE_IDENTITY_UNAVAILABLE",
      "Google account identity could not be verified. The profile was not stored.",
      1,
    );
  }
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  if (
    !response.ok ||
    !isRecord(parsed) ||
    typeof parsed.sub !== "string" ||
    parsed.sub === ""
  ) {
    throw new AppError(
      "GOOGLE_IDENTITY_UNAVAILABLE",
      "Google account identity could not be verified. The profile was not stored.",
      1,
      { status: response.status },
    );
  }
  return parsed.sub;
}

export async function loginGoogleOAuthProfile(
  profileName: string,
  vault: GoogleCredentialVault,
  dependencies: LoginDependencies = {},
): Promise<{
  profile: string;
  connected: true;
  scopes: string[];
  expiresAt: string;
  vaultBackend: { id: string; name: string };
}> {
  const profile = validateGoogleProfile(profileName);
  const client = await resolveGoogleOAuthClient(vault);
  if (!client) {
    throw new AppError(
      "GOOGLE_OAUTH_CLIENT_NOT_CONFIGURED",
      "Google OAuth client is unavailable. Run aitraffic auth google configure to use your own client.",
    );
  }
  const state = base64Url(randomBytes(32));
  const pkce = createPkcePair();
  let authorization: AuthorizationCodeResult;
  if (dependencies.receiveAuthorizationCode) {
    const redirectUri =
      client.clientType === "desktop"
        ? "http://127.0.0.1:3000/"
        : client.redirectUri;
    const authorizationUrl = buildGoogleAuthorizationUrl({
      clientId: client.clientId,
      redirectUri,
      state,
      codeChallenge: pkce.challenge,
    });
    authorization = {
      code: await dependencies.receiveAuthorizationCode(
        authorizationUrl,
        redirectUri,
        state,
      ),
      redirectUri,
    };
  } else {
    authorization = await receiveLocalAuthorizationCode(
      {
        clientId: client.clientId,
        redirectUri: client.redirectUri,
        state,
        codeChallenge: pkce.challenge,
      },
      state,
      dependencies.onInstruction,
    );
  }
  const token = await exchangeAuthorizationCode({
    fetch: dependencies.fetch ?? fetch,
    client,
    code: authorization.code,
    verifier: pkce.verifier,
    redirectUri: authorization.redirectUri,
  });
  const grantedScopes =
    token.scopes.length > 0
      ? token.scopes
      : [...GOOGLE_READ_ONLY_SCOPES];
  try {
    validateGrantedGoogleScopes(grantedScopes);
  } catch (error) {
    await bestEffortRevoke(
      dependencies.fetch ?? fetch,
      token.refreshToken ?? token.accessToken,
    );
    throw error;
  }
  let subject: string;
  try {
    subject = await fetchGoogleSubject(
      dependencies.fetch ?? fetch,
      token.accessToken,
    );
  } catch (error) {
    await bestEffortRevoke(
      dependencies.fetch ?? fetch,
      token.refreshToken ?? token.accessToken,
    );
    throw error;
  }
  const existing = await vault.getProfile(profile);
  const clientKey = googleOAuthClientKey(client.clientId);
  const sameIdentity =
    existing?.clientKey === clientKey && existing.subject === subject;
  const refreshToken =
    token.refreshToken ?? (sameIdentity ? existing.refreshToken : undefined);
  if (!refreshToken) {
    await bestEffortRevoke(
      dependencies.fetch ?? fetch,
      token.accessToken,
    );
    throw new AppError(
      "GOOGLE_REFRESH_TOKEN_MISSING",
      "Google did not return a refresh token. Revoke the app in your Google Account and run login again.",
      1,
    );
  }
  const now = (dependencies.now ?? (() => new Date()))();
  const expiresAt = now.getTime() + token.expiresIn * 1_000;
  const stored: GoogleOAuthProfile = {
    schemaVersion: "0.2.0",
    profile,
    clientKey,
    accessToken: token.accessToken,
    refreshToken,
    expiresAt,
    scopes: grantedScopes,
    subject,
    createdAt: sameIdentity ? existing.createdAt : now.toISOString(),
    updatedAt: now.toISOString(),
  };
  if (token.tokenType !== undefined) {
    stored.tokenType = token.tokenType;
  }
  await vault.setProfile(stored);
  return {
    profile,
    connected: true,
    scopes: stored.scopes,
    expiresAt: new Date(expiresAt).toISOString(),
    vaultBackend: vault.backendInfo(),
  };
}

export async function getGoogleOAuthStatus(
  vault: GoogleCredentialVault,
  profileName?: string,
): Promise<{
  clientConfigured: boolean;
  vaultBackend: { id: string; name: string };
  profileCount: number;
  profiles: Array<{
    profile: string;
    connected: boolean;
    scopes: string[];
    expiresAt: string | null;
  }>;
}> {
  const client = await resolveGoogleOAuthClient(vault);
  const knownProfiles = await vault.listProfiles();
  const requested =
    profileName === undefined
      ? knownProfiles
      : [validateGoogleProfile(profileName)];
  const profiles = await Promise.all(
    requested.map(async (profile) => {
      const stored = await vault.getProfile(profile);
      const connected =
        stored !== null &&
        client !== null &&
        stored.clientKey === googleOAuthClientKey(client.clientId) &&
        hasSafeGoogleScopes(stored.scopes);
      return {
        profile,
        connected,
        scopes: stored?.scopes ?? [],
        expiresAt:
          stored === null ? null : new Date(stored.expiresAt).toISOString(),
      };
    }),
  );
  return {
    clientConfigured: client !== null,
    vaultBackend: vault.backendInfo(),
    profileCount: knownProfiles.length,
    profiles,
  };
}

export async function refreshGoogleOAuthProfile(options: {
  profile: GoogleOAuthProfile;
  vault: GoogleCredentialVault;
  fetch?: typeof fetch;
  now?: Date;
}): Promise<GoogleOAuthProfile> {
  if (!options.profile.refreshToken) {
    throw new AppError(
      "GOOGLE_REFRESH_TOKEN_MISSING",
      `Google profile ${options.profile.profile} cannot be refreshed. Run auth google login again.`,
      1,
    );
  }
  const client = await resolveGoogleOAuthClient(options.vault);
  if (!client) {
    throw new AppError(
      "GOOGLE_OAUTH_CLIENT_NOT_CONFIGURED",
      "Google OAuth client is not configured.",
      1,
    );
  }
  if (options.profile.clientKey !== googleOAuthClientKey(client.clientId)) {
    throw new AppError(
      "GOOGLE_PROFILE_CLIENT_MISMATCH",
      `Google profile ${options.profile.profile} belongs to a different OAuth client. Run auth google login again.`,
      1,
    );
  }
  const body = new URLSearchParams({
    client_id: client.clientId,
    refresh_token: options.profile.refreshToken,
    grant_type: "refresh_token",
  });
  if (client.clientSecret) {
    body.set("client_secret", client.clientSecret);
  }
  const response = await (options.fetch ?? fetch)(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const token = await parseTokenResponse(response);
  const now = options.now ?? new Date();
  const scopes =
    token.scopes.length > 0 ? token.scopes : options.profile.scopes;
  try {
    validateGrantedGoogleScopes(scopes);
  } catch (error) {
    await bestEffortRevoke(
      options.fetch ?? fetch,
      options.profile.refreshToken,
    );
    await options.vault.deleteProfile(options.profile.profile);
    throw error;
  }
  const refreshed: GoogleOAuthProfile = {
    ...options.profile,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken ?? options.profile.refreshToken,
    expiresAt: now.getTime() + token.expiresIn * 1_000,
    scopes,
    updatedAt: now.toISOString(),
  };
  if (token.tokenType !== undefined) {
    refreshed.tokenType = token.tokenType;
  }
  await options.vault.setProfile(refreshed);
  return refreshed;
}

export async function revokeGoogleOAuthProfile(options: {
  profile: string;
  vault: GoogleCredentialVault;
  dryRun?: boolean;
  localOnly?: boolean;
  fetch?: typeof fetch;
}): Promise<{
  profile: string;
  revoked: boolean;
  alreadyInvalid: boolean;
  deletedLocally: boolean;
  deletedProfiles: string[];
  dryRun: boolean;
  localOnly: boolean;
}> {
  const profile = validateGoogleProfile(options.profile);
  const stored = await options.vault.getProfile(profile);
  if (!stored) {
    throw new AppError(
      "GOOGLE_PROFILE_NOT_FOUND",
      `Google profile is not connected: ${profile}`,
    );
  }
  if (options.dryRun) {
    return {
      profile,
      revoked: false,
      alreadyInvalid: false,
      deletedLocally: false,
      deletedProfiles: [],
      dryRun: true,
      localOnly: options.localOnly === true,
    };
  }
  let revoked = false;
  let alreadyInvalid = false;
  if (!options.localOnly) {
    const token = stored.refreshToken ?? stored.accessToken;
    const response = await (options.fetch ?? fetch)(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
    revoked = response.ok;
    alreadyInvalid = response.status === 400;
    if (!revoked && !alreadyInvalid) {
      throw new AppError(
        "GOOGLE_REVOKE_FAILED",
        "Google did not confirm token revocation; the local profile was retained. Use --local-only only if you intentionally want to forget it locally.",
        1,
        { status: response.status },
      );
    }
  }
  const candidates = await options.vault.listProfiles();
  const deletedProfiles: string[] = [];
  for (const candidate of candidates) {
    const candidateProfile = await options.vault.getProfile(candidate);
    if (
      candidate === profile ||
      (revoked &&
        candidateProfile?.subject === stored.subject &&
        candidateProfile.clientKey === stored.clientKey)
    ) {
      if (await options.vault.deleteProfile(candidate)) {
        deletedProfiles.push(candidate);
      }
    }
  }
  return {
    profile,
    revoked,
    alreadyInvalid,
    deletedLocally: deletedProfiles.includes(profile),
    deletedProfiles,
    dryRun: false,
    localOnly: options.localOnly === true,
  };
}
