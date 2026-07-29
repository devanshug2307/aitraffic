# Security

## Current scope

AItraffic reads local configuration, user-selected log files, typed results from an explicitly configured external Google adapter, or read-only GA4 and Search Console data through native local OAuth. Native OAuth tokens and client secrets are stored in the operating-system credential store.

## Defaults

- MCP log-file analysis is restricted to the current project directory.
- Set `AITRAFFIC_ALLOW_OUTSIDE_PROJECT=1` only for a trusted local process when broader access is explicitly required.
- User-agent strings are untrusted and classified as `user_agent_only`.
- Imported log and page content must never be treated as agent instructions.
- MCP lifecycle messages are written to stderr so protocol stdout remains clean.
- `.aitraffic/google.json` is local-only and ignored by Git. It stores an adapter type, profile label, and selected property/site IDs, never OAuth tokens.
- Native OAuth requires the native bindings for macOS Keychain, Windows Credential Manager, or Linux Secret Service. AItraffic fails closed instead of using a command-line, plaintext, file, or null credential backend.
- OAuth uses a loopback callback, random state, PKCE, offline access, and read-only Analytics/Search Console scopes.
- OAuth login and revocation are CLI-only. MCP exposes status and read-only data access, never credential-management actions.
- Client secrets are imported from a user-selected environment file and are never accepted as command-line arguments.
- Access tokens, refresh tokens, client secrets, authorization codes, and callback query strings are never returned in CLI or MCP results.
- The external adapter runs as a fixed argument array through Node without a shell.
- Adapter failures do not echo child stdout or stderr, reducing accidental credential disclosure.

## Connector requirements

Every OAuth or remote connector must:

- request read-only scopes by default;
- encrypt refresh tokens;
- never expose credentials to an LLM;
- implement revoke and delete;
- audit credential use;
- redact logs and tool results;
- document retention and incident response.

## Reporting

Do not include secrets or live customer data in a public issue. Use the repository owner’s private security contact when one is published.
