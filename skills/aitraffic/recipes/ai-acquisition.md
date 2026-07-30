# AI acquisition

1. Check Google readiness.
2. Use `analyze_ai_acquisition` or:

   ```bash
   aitraffic report acquisition --days 28 --format json
   ```

3. Report current and previous periods, source/medium evidence, sessions,
   engagement, key events, and revenue only when returned.
4. Keep Google AI-search traffic separate from AI-assistant referrals and
   preserve unknown or unrecognized referrers.
5. If access logs are available inside the project, use `analyze_log_file` to
   add crawler-request evidence. Do not equate a crawler request with a referral,
   citation, training event, or verified bot identity.
6. State that dark or unattributed AI influence is not observable through GA4.
