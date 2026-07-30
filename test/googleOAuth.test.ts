import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { LocalGoogleDataProvider } from "../src/connectors/google/localProvider.js";
import {
  GOOGLE_READ_ONLY_SCOPES,
  buildGoogleAuthorizationUrl,
  configureGoogleOAuthClient,
  getGoogleOAuthStatus,
  googleOAuthClientKey,
  loginGoogleOAuthProfile,
  parseEnvFile,
  parseGoogleOAuthClientJson,
  revokeGoogleOAuthProfile,
  validateGoogleRedirectUri,
} from "../src/connectors/google/oauth.js";
import {
  SecureGoogleVault,
  type GoogleOAuthClient,
  type GoogleOAuthProfile,
} from "../src/connectors/google/vault.js";

class MemorySecretStore {
  readonly id = "native-macos";
  readonly name = "Test Keychain";
  readonly values = new Map<string, string>();

  private key(service: string, account: string): string {
    return `${service}:${account}`;
  }

  async getPassword(service: string, account: string): Promise<string | null> {
    return this.values.get(this.key(service, account)) ?? null;
  }

  async setPassword(
    service: string,
    account: string,
    password: string,
  ): Promise<void> {
    this.values.set(this.key(service, account), password);
  }

  async deletePassword(service: string, account: string): Promise<void> {
    this.values.delete(this.key(service, account));
  }
}

function oauthClient(): GoogleOAuthClient {
  return {
    schemaVersion: "0.2.0",
    clientId: "client-id.apps.googleusercontent.com",
    clientSecret: "client-secret",
    clientType: "web",
    redirectUri: "http://localhost:3000/api/auth/callback/google",
    configuredAt: "2026-07-30T00:00:00.000Z",
  };
}

function oauthProfile(overrides: Partial<GoogleOAuthProfile> = {}) {
  return {
    schemaVersion: "0.2.0" as const,
    profile: "work",
    clientKey: googleOAuthClientKey(
      "client-id.apps.googleusercontent.com",
    ),
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: Date.now() + 3_600_000,
    scopes: [...GOOGLE_READ_ONLY_SCOPES],
    subject: "google-user-work",
    tokenType: "Bearer",
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("parses OAuth environment files without accepting malformed keys", () => {
  assert.deepEqual(
    parseEnvFile(`
      # local secret
      export GOOGLE_CLIENT_ID="client-id"
      GOOGLE_CLIENT_SECRET='client-secret'
      GOOGLE_REDIRECT_URI=http://localhost:4100/callback
      broken line
      BAD-KEY=value
    `),
    {
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_REDIRECT_URI: "http://localhost:4100/callback",
    },
  );
});

test("accepts only exact loopback HTTP redirect URIs", () => {
  assert.equal(
    validateGoogleRedirectUri("http://localhost:3000/callback"),
    "http://localhost:3000/callback",
  );
  assert.throws(() =>
    validateGoogleRedirectUri("https://example.com/callback"),
  );
  assert.throws(() =>
    validateGoogleRedirectUri("http://localhost/callback"),
  );
  assert.throws(() =>
    validateGoogleRedirectUri("http://localhost:3000/callback?code=test"),
  );
});

test("builds a PKCE authorization request with read-only scopes", () => {
  const authorizationUrl = buildGoogleAuthorizationUrl({
    clientId: "client-id",
    redirectUri: "http://localhost:3000/callback",
    state: "state-value",
    codeChallenge: "challenge-value",
  });
  const parsed = new URL(authorizationUrl);
  const scopes = parsed.searchParams.get("scope")?.split(" ") ?? [];

  assert.equal(parsed.origin, "https://accounts.google.com");
  assert.equal(parsed.searchParams.get("state"), "state-value");
  assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
  assert.equal(parsed.searchParams.has("include_granted_scopes"), false);
  assert.deepEqual(scopes, [...GOOGLE_READ_ONLY_SCOPES]);
  assert.equal(scopes.some((scope) => scope.includes("edit")), false);
});

test("stores OAuth client configuration only in the credential vault", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "aitraffic-oauth-"));
  const envFile = path.join(directory, ".env.google");
  await writeFile(
    envFile,
    [
      "GOOGLE_CLIENT_ID=client-id.apps.googleusercontent.com",
      "GOOGLE_CLIENT_SECRET=client-secret",
      "GOOGLE_REDIRECT_URI=http://localhost:4100/callback",
      "",
    ].join("\n"),
    "utf8",
  );
  const store = new MemorySecretStore();
  const vault = new SecureGoogleVault(store);
  const result = await configureGoogleOAuthClient({
    envFile,
    vault,
    now: new Date("2026-07-30T00:00:00.000Z"),
  });

  assert.equal(result.configured, true);
  assert.equal(result.vaultBackend.id, "native-macos");
  assert.equal(JSON.stringify(result).includes("client-secret"), false);
  assert.equal((await vault.getClient())?.clientSecret, "client-secret");
  assert.equal((await vault.getClient())?.clientType, "web");
});

test("imports Google Web application JSON without returning its secret", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "aitraffic-oauth-json-"));
  const clientJsonFile = path.join(directory, "client.json");
  await writeFile(
    clientJsonFile,
    JSON.stringify({
      web: {
        client_id: "json-client.apps.googleusercontent.com",
        client_secret: "json-client-secret",
        redirect_uris: [
          "https://example.com/not-allowed",
          "http://localhost:3000/api/auth/callback/google",
        ],
      },
    }),
    "utf8",
  );
  const store = new MemorySecretStore();
  const vault = new SecureGoogleVault(store);
  const result = await configureGoogleOAuthClient({
    clientJsonFile,
    vault,
    now: new Date("2026-07-30T00:00:00.000Z"),
  });

  assert.equal(result.configured, true);
  assert.equal(result.redirectUri, "http://localhost:3000/api/auth/callback/google");
  assert.equal(
    JSON.stringify(result).includes("json-client-secret"),
    false,
  );
  assert.equal((await vault.getClient())?.clientId, "json-client.apps.googleusercontent.com");
  assert.equal((await vault.getClient())?.clientSecret, "json-client-secret");
});

test("rejects installed-app JSON and non-loopback web redirects", () => {
  assert.throws(() =>
    parseGoogleOAuthClientJson(
      JSON.stringify({
        installed: {
          client_id: "desktop-client",
          client_secret: "desktop-secret",
          redirect_uris: ["http://localhost"],
        },
      }),
    ),
  );
  assert.throws(() =>
    parseGoogleOAuthClientJson(
      JSON.stringify({
        web: {
          client_id: "web-client",
          client_secret: "web-secret",
          redirect_uris: ["https://example.com/callback"],
        },
      }),
    ),
  );
});

test("completes login without returning tokens or authorization codes", async () => {
  const store = new MemorySecretStore();
  const vault = new SecureGoogleVault(store);
  await vault.setClient(oauthClient());
  let authorizationUrl = "";
  const fetchImplementation = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    if (
      String(input) ===
      "https://openidconnect.googleapis.com/v1/userinfo"
    ) {
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer new-access-token",
      );
      return jsonResponse({ sub: "google-user-work" });
    }
    assert.equal(String(input), "https://oauth2.googleapis.com/token");
    assert.equal(init?.method, "POST");
    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.get("code"), "one-time-code");
    assert.ok(body.get("code_verifier"));
    return jsonResponse({
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
      scope: GOOGLE_READ_ONLY_SCOPES.join(" "),
    });
  }) as typeof fetch;

  const result = await loginGoogleOAuthProfile("Work", vault, {
    fetch: fetchImplementation,
    now: () => new Date("2026-07-30T00:00:00.000Z"),
    receiveAuthorizationCode: async (url, redirectUri, expectedState) => {
      authorizationUrl = url;
      const parsed = new URL(url);
      assert.equal(
        redirectUri,
        "http://localhost:3000/api/auth/callback/google",
      );
      assert.equal(parsed.searchParams.get("state"), expectedState);
      return "one-time-code";
    },
  });

  assert.equal(result.profile, "work");
  assert.equal(result.connected, true);
  const rendered = JSON.stringify(result);
  assert.equal(rendered.includes("new-access-token"), false);
  assert.equal(rendered.includes("new-refresh-token"), false);
  assert.equal(rendered.includes("one-time-code"), false);
  assert.equal(new URL(authorizationUrl).searchParams.has("client_secret"), false);

  const stored = await vault.getProfile("work");
  assert.equal(stored?.accessToken, "new-access-token");
  assert.equal(stored?.refreshToken, "new-refresh-token");
  assert.equal(stored?.subject, "google-user-work");
});

test("reports named profile status without exposing credentials", async () => {
  const store = new MemorySecretStore();
  const vault = new SecureGoogleVault(store);
  await vault.setClient(oauthClient());
  await vault.setProfile(oauthProfile());

  const status = await getGoogleOAuthStatus(vault);
  assert.equal(status.clientConfigured, true);
  assert.equal(status.profileCount, 1);
  assert.equal(status.profiles[0]?.profile, "work");
  const rendered = JSON.stringify(status);
  assert.equal(rendered.includes("access-token"), false);
  assert.equal(rendered.includes("refresh-token"), false);
  assert.equal(rendered.includes("client-secret"), false);

  await vault.setClient({
    ...oauthClient(),
    clientId: "replacement.apps.googleusercontent.com",
  });
  const afterClientChange = await getGoogleOAuthStatus(vault, "work");
  assert.equal(afterClientChange.profiles[0]?.connected, false);

  await vault.setClient(oauthClient());
  await vault.setProfile(
    oauthProfile({
      scopes: [
        ...GOOGLE_READ_ONLY_SCOPES,
        "https://www.googleapis.com/auth/analytics.edit",
      ],
    }),
  );
  const unsafeStoredScope = await getGoogleOAuthStatus(vault, "work");
  assert.equal(unsafeStoredScope.profiles[0]?.connected, false);
});

test("rejects and revokes a Google token with a write scope", async () => {
  const store = new MemorySecretStore();
  const vault = new SecureGoogleVault(store);
  await vault.setClient(oauthClient());
  const urls: string[] = [];
  const fetchImplementation = (async (
    input: string | URL | Request,
  ) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith("/token")) {
      return jsonResponse({
        access_token: "unsafe-access-token",
        refresh_token: "unsafe-refresh-token",
        expires_in: 3600,
        scope: [
          "https://www.googleapis.com/auth/analytics.readonly",
          "https://www.googleapis.com/auth/webmasters.readonly",
          "https://www.googleapis.com/auth/analytics.edit",
        ].join(" "),
      });
    }
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  await assert.rejects(
    loginGoogleOAuthProfile("unsafe", vault, {
      fetch: fetchImplementation,
      receiveAuthorizationCode: async () => "one-time-code",
    }),
    /read-only allowlist/,
  );
  assert.deepEqual(urls, [
    "https://oauth2.googleapis.com/token",
    "https://oauth2.googleapis.com/revoke",
  ]);
  assert.equal(await vault.getProfile("unsafe"), null);
});

test("does not reuse a refresh token across Google accounts", async () => {
  const store = new MemorySecretStore();
  const vault = new SecureGoogleVault(store);
  await vault.setClient(oauthClient());
  await vault.setProfile(oauthProfile({ profile: "switching" }));
  const urls: string[] = [];
  const fetchImplementation = (async (
    input: string | URL | Request,
  ) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith("/token")) {
      return jsonResponse({
        access_token: "account-b-access",
        expires_in: 3600,
        scope: GOOGLE_READ_ONLY_SCOPES.join(" "),
      });
    }
    if (url.endsWith("/userinfo")) {
      return jsonResponse({ sub: "google-user-b" });
    }
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  await assert.rejects(
    loginGoogleOAuthProfile("switching", vault, {
      fetch: fetchImplementation,
      receiveAuthorizationCode: async () => "one-time-code",
    }),
    /did not return a refresh token/,
  );
  assert.deepEqual(urls, [
    "https://oauth2.googleapis.com/token",
    "https://openidconnect.googleapis.com/v1/userinfo",
    "https://oauth2.googleapis.com/revoke",
  ]);
  assert.equal(
    (await vault.getProfile("switching"))?.subject,
    "google-user-work",
  );
});

test("lists resources and runs direct read-only Google reports", async () => {
  const store = new MemorySecretStore();
  const vault = new SecureGoogleVault(store);
  await vault.setClient(oauthClient());
  await vault.setProfile(oauthProfile());
  const requests: Array<{
    url: string;
    authorization: string | null;
    body: unknown;
  }> = [];
  const fetchImplementation = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    requests.push({
      url,
      authorization: new Headers(init?.headers).get("authorization"),
      body:
        typeof init?.body === "string"
          ? JSON.parse(init.body) as unknown
          : null,
    });
    if (url.includes("accountSummaries")) {
      return jsonResponse({
        accountSummaries: [
          {
            account: "accounts/10",
            displayName: "Acme",
            propertySummaries: [
              {
                property: "properties/20",
                displayName: "Website",
              },
            ],
          },
        ],
      });
    }
    if (url.endsWith("/sites")) {
      return jsonResponse({
        siteEntry: [
          {
            siteUrl: "sc-domain:example.com",
            permissionLevel: "siteOwner",
          },
        ],
      });
    }
    if (url.includes(":runReport")) {
      return jsonResponse({
        dimensionHeaders: [{ name: "date" }],
        metricHeaders: [{ name: "sessions" }],
        rows: [
          {
            dimensionValues: [{ value: "20260730" }],
            metricValues: [{ value: "5" }],
          },
        ],
      });
    }
    return jsonResponse({
      rows: [
        {
          keys: ["ai traffic"],
          clicks: 2,
          impressions: 20,
          ctr: 0.1,
          position: 4,
        },
      ],
    });
  }) as typeof fetch;
  const provider = new LocalGoogleDataProvider(
    {
      schemaVersion: "0.1.0",
      adapter: "local-oauth",
      profile: "work",
    },
    vault,
    fetchImplementation,
  );

  const inventory = await provider.inventory();
  const ga4 = await provider.ga4Report("20", {
    start: "28daysAgo",
    end: "yesterday",
    dimensions: ["date"],
    metrics: ["sessions"],
    dimensionFilter: {
      filter: {
        fieldName: "sessionDefaultChannelGroup",
        stringFilter: {
          matchType: "EXACT",
          value: "Organic Search",
          caseSensitive: false,
        },
      },
    },
  });
  const gsc = await provider.gscReport("sc-domain:example.com", {
    start: "2026-07-01",
    end: "2026-07-28",
    dimensions: ["query"],
    offset: 25_000,
    dataState: "hourly_all",
    aggregationType: "byPage",
    dimensionFilterGroups: [
      {
        groupType: "and",
        filters: [
          {
            dimension: "query",
            operator: "contains",
            expression: "ai traffic",
          },
        ],
      },
    ],
  });

  assert.equal(inventory.ga4Properties[0]?.property, "properties/20");
  assert.match(
    requests[0]?.url ?? "",
    /^https:\/\/analyticsadmin\.googleapis\.com\/v1beta\/accountSummaries/u,
  );
  assert.equal(
    inventory.searchConsoleSites[0]?.siteUrl,
    "sc-domain:example.com",
  );
  assert.equal(ga4.rows?.[0]?.metricValues?.[0]?.value, "5");
  assert.deepEqual(requests[2]?.body, {
    dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }],
    limit: "10000",
    offset: "0",
    dimensionFilter: {
      filter: {
        fieldName: "sessionDefaultChannelGroup",
        stringFilter: {
          matchType: "EXACT",
          value: "Organic Search",
          caseSensitive: false,
        },
      },
    },
    returnPropertyQuota: true,
  });
  assert.equal(gsc.rows?.[0]?.clicks, 2);
  assert.deepEqual(requests[3]?.body, {
    startDate: "2026-07-01",
    endDate: "2026-07-28",
    dimensions: ["query"],
    rowLimit: 1000,
    startRow: 25000,
    type: "web",
    dataState: "hourly_all",
    aggregationType: "byPage",
    dimensionFilterGroups: [
      {
        groupType: "and",
        filters: [
          {
            dimension: "query",
            operator: "contains",
            expression: "ai traffic",
          },
        ],
      },
    ],
  });
  assert.equal(requests.length, 4);
  assert.equal(
    requests.every(
      (request) => request.authorization === "Bearer access-token",
    ),
    true,
  );
});

test("refreshes an expired access token before a Google API request", async () => {
  const store = new MemorySecretStore();
  const vault = new SecureGoogleVault(store);
  await vault.setClient(oauthClient());
  await vault.setProfile(oauthProfile({ expiresAt: 0 }));
  const authorizations: Array<string | null> = [];
  const fetchImplementation = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    if (String(input) === "https://oauth2.googleapis.com/token") {
      return jsonResponse({
        access_token: "refreshed-access-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: GOOGLE_READ_ONLY_SCOPES.join(" "),
      });
    }
    authorizations.push(new Headers(init?.headers).get("authorization"));
    return jsonResponse({
      metricHeaders: [{ name: "sessions" }],
      rows: [{ metricValues: [{ value: "1" }] }],
    });
  }) as typeof fetch;
  const provider = new LocalGoogleDataProvider(
    {
      schemaVersion: "0.1.0",
      adapter: "local-oauth",
      profile: "work",
    },
    vault,
    fetchImplementation,
  );

  await provider.ga4Report("20", {
    start: "yesterday",
    end: "yesterday",
    dimensions: [],
    metrics: ["sessions"],
  });

  assert.deepEqual(authorizations, ["Bearer refreshed-access-token"]);
  assert.equal(
    (await vault.getProfile("work"))?.accessToken,
    "refreshed-access-token",
  );
});

test("supports dry-run and confirmed Google profile revocation", async () => {
  const store = new MemorySecretStore();
  const vault = new SecureGoogleVault(store);
  await vault.setProfile(oauthProfile());
  await vault.setProfile(oauthProfile({ profile: "work-alias" }));
  await vault.setProfile(
    oauthProfile({
      profile: "different-client",
      clientKey: "different-client-key",
    }),
  );
  await vault.setProfile(
    oauthProfile({ profile: "other-account", subject: "google-user-other" }),
  );
  let revokeCalls = 0;
  const fetchImplementation = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    revokeCalls += 1;
    assert.equal(String(input), "https://oauth2.googleapis.com/revoke");
    assert.equal(
      new URLSearchParams(String(init?.body)).get("token"),
      "refresh-token",
    );
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  const dryRun = await revokeGoogleOAuthProfile({
    profile: "work",
    vault,
    dryRun: true,
    fetch: fetchImplementation,
  });
  assert.equal(dryRun.revoked, false);
  assert.equal(revokeCalls, 0);
  assert.ok(await vault.getProfile("work"));

  const revoked = await revokeGoogleOAuthProfile({
    profile: "work",
    vault,
    fetch: fetchImplementation,
  });
  assert.equal(revoked.revoked, true);
  assert.equal(revoked.deletedLocally, true);
  assert.deepEqual(revoked.deletedProfiles, ["work", "work-alias"]);
  assert.equal(revokeCalls, 1);
  assert.equal(await vault.getProfile("work"), null);
  assert.equal(await vault.getProfile("work-alias"), null);
  assert.ok(await vault.getProfile("different-client"));
  assert.ok(await vault.getProfile("other-account"));

  await vault.setProfile(oauthProfile({ profile: "stale" }));
  await vault.setProfile(oauthProfile({ profile: "stale-alias" }));
  const localOnly = await revokeGoogleOAuthProfile({
    profile: "stale",
    vault,
    localOnly: true,
    fetch: fetchImplementation,
  });
  assert.equal(localOnly.revoked, false);
  assert.equal(localOnly.localOnly, true);
  assert.equal(await vault.getProfile("stale"), null);
  assert.ok(await vault.getProfile("stale-alias"));
  assert.equal(revokeCalls, 1);
});

test("forgets an already-invalid Google token after a 400 response", async () => {
  const store = new MemorySecretStore();
  const vault = new SecureGoogleVault(store);
  await vault.setProfile(oauthProfile({ profile: "invalid" }));
  await vault.setProfile(oauthProfile({ profile: "invalid-alias" }));
  const result = await revokeGoogleOAuthProfile({
    profile: "invalid",
    vault,
    fetch: (async () => new Response(null, { status: 400 })) as typeof fetch,
  });

  assert.equal(result.revoked, false);
  assert.equal(result.alreadyInvalid, true);
  assert.equal(result.deletedLocally, true);
  assert.equal(await vault.getProfile("invalid"), null);
  assert.ok(await vault.getProfile("invalid-alias"));
});
