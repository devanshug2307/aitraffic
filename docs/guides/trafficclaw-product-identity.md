# AItraffic by TrafficClaw: Google OAuth identity

## Decision

AItraffic launches as a **TrafficClaw product**. Google consent therefore
identifies TrafficClaw as the OAuth application, while AItraffic is the
terminal-first product that presents the resulting read-only reports.

This is clearer and safer than presenting AItraffic as an independent OAuth
application before it has its own production site, verified consent screen,
and hosted security controls.

## Beta configuration

Use the TrafficClaw production Google Cloud project with only these scopes:

```text
openid
email
profile
https://www.googleapis.com/auth/analytics.readonly
https://www.googleapis.com/auth/webmasters.readonly
```

Create a separate **Web application** OAuth client named `AItraffic Gateway`.
Its authorized redirect URI is
`https://auth.trafficclaw.com/aitraffic/google/callback`. The Google client
secret is stored only as a runtime secret on the gateway VPS; it is never
bundled with the npm CLI. Each person who uses the beta personally completes
Google consent and must already have access to the chosen GA4 property and
Search Console site.

The CLI stores the access and refresh tokens only in that person's native OS
credential store. The gateway encrypts a one-time handoff to an ephemeral
local CLI key and does not persist user tokens. A separate `AItraffic Local
Beta` Web client can remain for manual testing, but it is not the default npm
onboarding path.

## Public hosted product later

Before moving the broker to `auth.aitraffic.dev`, ship a public homepage,
privacy policy, and terms that clearly state “AItraffic is a TrafficClaw
product.” Verify the domain and add only the exact HTTPS callback used by the
broker. Do not persist user access or refresh tokens on the broker, and never
expose them to an agent.

Do not add `aitraffic.dev` merely for the local CLI: the loopback beta callback
does not need it.

## Security boundary

- Google OAuth tokens stay in native OS credential storage for the local CLI.
- The gateway's Web client secret is a VPS runtime secret; no client secret is
  packaged.
- `.aitraffic/google.json` contains only the selected profile and resource IDs.
- MCP exposes read-only reports and connection state, never OAuth setup,
  credentials, authorization codes, or tokens.
- A dedicated client per product/environment limits blast radius during secret
  rotation or redirect changes.

Google requires OAuth branding to accurately represent the application,
requests only the scopes needed, and uses domains the developer owns or is
authorized to use. See [Google OAuth 2.0 policies](https://developers.google.com/identity/protocols/oauth2/policies).
