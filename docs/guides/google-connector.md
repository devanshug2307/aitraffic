# Google connector

AItraffic supports two compatible read-only providers:

1. **Native local OAuth** — the packaged CLI owns the browser consent flow and calls GA4 and Search Console directly.
2. **External command adapter** — an existing TrafficClaw or other local profile owns OAuth and returns typed JSON to AItraffic.

Both providers implement the same `GoogleDataProvider` contract, so GA4, Search Console, acquisition reports, and MCP tools keep the same output shape.

## Native OAuth: Google Cloud setup

In a Google Cloud project:

1. Enable the **Google Analytics Data API**, **Google Analytics Admin API**, and **Google Search Console API**.
2. Configure the Google OAuth consent screen. If the app is in testing, add the Google accounts that will connect as test users.
3. Create an OAuth 2.0 client with application type **Web application**.
4. Add this authorized redirect URI exactly:

   ```text
   http://localhost:3000/api/auth/callback/google
   ```

You can choose another loopback port or path, but the Google Cloud value and `GOOGLE_REDIRECT_URI` must be identical. AItraffic accepts only an HTTP loopback URI with an explicit port, no query, and no fragment.

Google’s references:

- [OAuth 2.0 for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Analytics Data API quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart)
- [Search Console OAuth authorization](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing)

The Google account completing consent must already have access to the relevant GA4 property and Search Console site.

Google Cloud projects whose external consent screen remains in **Testing**
typically receive refresh tokens that expire after seven days for these data
scopes. Add test users while developing, then follow Google’s production and
verification requirements before distributing one shared OAuth client. BYO
client users control their own project and consent configuration.

## Store the OAuth client securely

Create a private file outside source control:

```dotenv
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google
```

Import it:

```bash
npx -y aitraffic@latest auth google configure \
  --from-env-file /absolute/path/to/.env.google \
  --format json
```

AItraffic copies the client configuration into macOS Keychain, Windows Credential Manager, or Linux Secret Service through native bindings. It rejects command-line fallback, file, and null credential backends. The client secret is never accepted as a CLI argument, written to `.aitraffic/google.json`, or returned in output.

Delete the source environment file afterward if you do not need it for recovery. The file remains under your control; AItraffic does not modify it.

## Connect named Google accounts

Run:

```bash
npx -y aitraffic@latest auth google login --profile work
```

AItraffic starts the exact loopback callback, generates random state and a PKCE challenge, and opens Google in the browser. You personally choose the Google account and approve consent. The CLI requests only:

```text
openid
email
profile
https://www.googleapis.com/auth/analytics.readonly
https://www.googleapis.com/auth/webmasters.readonly
```

The access and refresh tokens remain in the operating-system credential store. They are not printed and are not exposed through MCP.

Use a second label to connect another Google account:

```bash
npx -y aitraffic@latest auth google login --profile client-two
npx -y aitraffic@latest auth google status --format json
npx -y aitraffic@latest auth google status --profile client-two --format json
```

Profile labels contain letters, numbers, underscores, or hyphens and are normalized to lowercase. AItraffic does not return account email addresses in agent-facing status results.

## Discover and select resources

Inventory a connected profile:

```bash
npx -y aitraffic@latest google inventory \
  --profile work \
  --format json
```

This lists the GA4 properties and Search Console sites the connected Google account can access. AItraffic never silently chooses the first result.

Create a project-local selection:

```bash
npx -y aitraffic@latest google select \
  --profile work \
  --ga4-property 123456789 \
  --gsc-site sc-domain:example.com \
  --dry-run \
  --format json
```

Review the dry run, then repeat without `--dry-run`. The resulting `.aitraffic/google.json` contains labels only:

```json
{
  "schemaVersion": "0.1.0",
  "adapter": "local-oauth",
  "profile": "work",
  "ga4Property": "123456789",
  "gscSite": "sc-domain:example.com"
}
```

The file is mode `0600` and ignored by Git.

## Read-only reports

```bash
npx -y aitraffic@latest google status --format json

npx -y aitraffic@latest ga4 report \
  --start 28daysAgo \
  --end yesterday \
  --dimensions sessionSource,sessionMedium,landingPagePlusQueryString \
  --metrics sessions,totalUsers,engagedSessions,keyEvents,totalRevenue \
  --limit 10000 \
  --format json

npx -y aitraffic@latest gsc report \
  --start 2026-06-30 \
  --end 2026-07-27 \
  --dimensions query,page \
  --limit 25000 \
  --format json

npx -y aitraffic@latest report acquisition --days 28 --format json
```

The unified report uses yesterday as the GA4 end date and three days ago as the Search Console end date. It compares equal inclusive periods and reports:

- all observable GA4 traffic;
- traffic classified by GA4’s native `AI Assistants` channel or a disclosed source-domain registry;
- AI sessions, users, engagement, key events, revenue, sources, and landing pages;
- Search Console clicks, impressions, CTR, and impression-weighted position;
- current-versus-previous changes;
- deterministic query/page opportunities for returned rows in positions 4–20 with at least 10 impressions.

The report does not claim that a Search Console query caused a GA4 session, that a crawler visit created a citation, or that an AI referral caused revenue. Search Console can omit anonymized or low-volume queries, and GA4 can be affected by consent, thresholding, retention, and property setup.

## Revoke a profile

Review:

```bash
npx -y aitraffic@latest auth google revoke \
  --profile work \
  --dry-run \
  --format json
```

Then revoke:

```bash
npx -y aitraffic@latest auth google revoke \
  --profile work \
  --format json
```

Google revocation removes the OAuth grant for that Google account across every client in the same Google Cloud project. After Google confirms success, AItraffic deletes the named profile and aliases it can safely identify as the same Google account and OAuth client. Other Google accounts and profiles bound to a different configured client are left alone. Project resource selection is kept so reconnecting does not destroy project configuration.

If Google is unreachable or the token is already unusable, explicitly forget
the credential without claiming remote revocation:

```bash
npx -y aitraffic@latest auth google revoke \
  --profile work \
  --local-only \
  --format json
```

AItraffic also treats Google’s HTTP 400 response as an already-invalid token
and removes the local credential. Other revocation failures retain it so the
operation can be retried.

## External TrafficClaw adapter

The existing external adapter remains supported:

```bash
npx -y aitraffic@latest google configure \
  --adapter-script /absolute/path/to/google-data.mjs \
  --profile trafficclaw \
  --ga4-property 123456789 \
  --gsc-site sc-domain:example.com \
  --dry-run \
  --format json
```

Review the dry run, then repeat without `--dry-run`. In this mode TrafficClaw owns consent, token refresh, and credential persistence. AItraffic launches the adapter using the current Node executable and a fixed argument array, never a shell.

The adapter must accept:

```text
status
inventory --profile NAME
ga4 --profile NAME --property ID --start DATE --end DATE --dimensions CSV|none --metrics CSV --limit N
gsc --profile NAME --site SITE --start YYYY-MM-DD --end YYYY-MM-DD --dimensions CSV --limit N --offset N --type web --data-state final
```

It must write one JSON value to stdout, put diagnostics on stderr, return non-zero on failure, use read-only Google scopes, keep raw credentials out of responses, and require explicit property/site identifiers.

## MCP boundary

The MCP server exposes connection status, resource inventory, read-only reports, and the acquisition analysis. It deliberately does not expose OAuth configure, login, or revoke. Those commands require an informed person at the terminal and must not be delegated to an agent.
