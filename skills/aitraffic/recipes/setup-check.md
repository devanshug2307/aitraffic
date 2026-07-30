# Setup check

1. Run `get_project_status` or:

   ```bash
   aitraffic doctor --format json
   ```

2. If project configuration is absent, explain that initialization writes local
   project configuration, confirm the target directory, and offer:

   ```bash
   aitraffic init --agent both --site https://example.com
   ```

3. For a non-interactive readiness check, use:

   ```bash
   aitraffic onboard --check --format json
   ```

4. If Google evidence is requested, call `google_connection_status`. When it is
   not configured, explain that the user must personally run:

   ```bash
   aitraffic auth google configure --from-client-json /secure/path/client.json
   aitraffic auth google login --profile PROFILE
   aitraffic google inventory --profile PROFILE --format json
   aitraffic google select --profile PROFILE --ga4-property PROPERTY_ID --gsc-site SITE --dry-run
   ```

   The user should review the dry run and repeat the selection without
   `--dry-run` only when it is correct.
5. Never ask for client secrets, access tokens, refresh tokens, or credential
   files in chat. Never claim a profile is connected until status confirms it.
6. Continue with unauthenticated page or crawl evidence when useful.
