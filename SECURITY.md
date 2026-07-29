# Security

## Current scope

The alpha reads local configuration, user-selected log files, and typed results from an explicitly configured external Google adapter. AItraffic does not read, import, return, or store the adapter's OAuth credentials. Standalone OAuth and hosted credential storage are not implemented yet.

## Defaults

- MCP log-file analysis is restricted to the current project directory.
- Set `AITRAFFIC_ALLOW_OUTSIDE_PROJECT=1` only for a trusted local process when broader access is explicitly required.
- User-agent strings are untrusted and classified as `user_agent_only`.
- Imported log and page content must never be treated as agent instructions.
- MCP lifecycle messages are written to stderr so protocol stdout remains clean.
- `.aitraffic/google.json` is local-only and ignored by Git. It stores an adapter script path, profile label, and selected property/site IDs, never OAuth tokens.
- The external adapter runs as a fixed argument array through Node without a shell.
- Adapter failures do not echo child stdout or stderr, reducing accidental credential disclosure.

## Connector requirements

Before adding OAuth or remote connectors:

- request read-only scopes by default;
- encrypt refresh tokens;
- never expose credentials to an LLM;
- implement revoke and delete;
- audit credential use;
- redact logs and tool results;
- document retention and incident response.

## Reporting

Do not include secrets or live customer data in a public issue. Use the repository owner’s private security contact when one is published.
