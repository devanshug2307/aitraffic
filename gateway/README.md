# AItraffic OAuth gateway

This is the small server-side part of AItraffic's no-JSON Google connection.
It keeps the Google OAuth client secret on the VPS and never writes user
access or refresh tokens to disk. Tokens are encrypted to an ephemeral key in
the local CLI, returned over a loopback callback, and stored in that user's OS
credential store.

## Endpoints

- `GET /aitraffic/health` – health check
- `GET /aitraffic/google/start` – starts a browser sign-in from the CLI
- `GET /aitraffic/google/callback` – Google-only callback
- `POST /aitraffic/google/refresh` – refreshes a locally held token

## Coolify configuration

Use the repository branch containing this folder and select:

- **Build pack:** Dockerfile
- **Base directory:** `/gateway`
- **Port:** `3000`
- **Static site:** disabled

Set these runtime environment variables in Coolify; do not add them to Git:

```text
PUBLIC_BASE_URL=https://auth.trafficclaw.com/aitraffic
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
OAUTH_STATE_SECRET=...
```

`OAUTH_STATE_SECRET` must be a random value, for example from
`openssl rand -base64 48`. Configure Google OAuth with this exact redirect URI:

```text
https://auth.trafficclaw.com/aitraffic/google/callback
```

Do not expose the Google client secret in the npm package, browser JavaScript,
logs, GitHub, or a Coolify build argument.
