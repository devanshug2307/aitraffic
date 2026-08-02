# Setup check

1. Run `get_project_status` or:

   ```bash
   aitraffic doctor --format json
   ```

2. Inspect the `agents` registration states. If Codex or Claude Code is
   `drifted`, first request the exact non-writing plan:

   ```bash
   aitraffic doctor --repair codex --dry-run --format json
   ```

   Explain every operation. Run the same command with `--yes` only after the
   user explicitly approves it. Never overwrite a registration marked for
   manual review.

3. If project configuration is absent, explain that initialization writes local
   project configuration, confirm the target directory, and offer:

   ```bash
   aitraffic init --agent both --site https://example.com
   ```

4. For a non-interactive readiness check, use:

   ```bash
   aitraffic onboard --check --format json
   ```

5. If Google evidence is requested, call `google_connection_status`. When it is
   not configured, explain that the user must personally run the TrafficClaw
   local flow:

   ```bash
   aitraffic auth google use-trafficclaw
   aitraffic auth google login --profile PROFILE
   ```

   They may instead bring their own Google OAuth client:

   ```bash
   aitraffic auth google configure --from-client-json /secure/path/client.json
   aitraffic auth google login --profile PROFILE
   aitraffic google inventory --profile PROFILE --format json
   aitraffic google select --profile PROFILE --ga4-property PROPERTY_ID --gsc-site SITE --dry-run
   ```

   The user should review the dry run and repeat the selection without
   `--dry-run` only when it is correct.
6. Never ask for client secrets, access tokens, refresh tokens, or credential
   files in chat. Never claim a profile is connected until status confirms it.
7. Continue with unauthenticated page or crawl evidence when useful.
