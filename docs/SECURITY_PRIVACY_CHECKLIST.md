# Security and privacy review

## Implemented controls

- All 35 questions optional; no name, telephone, contact identifier or political affiliation requested.
- Request shape, question IDs, options, duplicate/excess selections and visibility validated on server and again in PostgreSQL.
- PostgreSQL trigger protects direct inserts and updates; transactional RPC stores response and private texts together.
- Request UUID plus advisory lock provides retry idempotency; conflicting payload rejected.
- All application tables RLS-enabled; no raw grants to anon/authenticated and no permissive policies.
- Public security-definer RPCs expose approved text and suppressed one-dimensional aggregates only.
- Privileged RPC execute grants explicit; helper functions unavailable to anonymous/authenticated users.
- Owner, analyst, moderator enforced in PostgreSQL using auth.uid() and aal2 claim. Express additionally verifies bearer tokens through Supabase Auth.
- MFA enrollment and challenge UI uses Supabase TOTP; no runtime bypass flag.
- All written responses privately stored; human redaction and confirmation required for approval; rejection removes publication.
- Formula-safe aggregate-only CSV; no raw-response export.
- Atomic shared-database submission limit, keyed hourly network bucket, fail-closed bot checks.
- Same-origin checks on API writes, 24 KB body cap, CSP, frame protection, no-store API headers, generic errors.
- Tokens memory-only, no third-party analytics or local survey draft persistence; no application body/token logging.
- Bounds on retention and suppression threshold; explicit deletion phrase and audit for destructive/mutating administrative actions.

## Review boundaries and residual risks

- PGlite proves PostgreSQL logic, not deployed Supabase JWT verification, PostgREST grants/schema configuration or real concurrent instances.
- CAPTCHA alone does not establish unique humans. Rate limiting may affect households/shared networks and has fixed-hour boundary effects.
- Private access gateway, TLS, secret lifecycle, trusted proxy routing, provider logs, backups and network policies remain operator responsibilities and are NOT TESTED.
- Text review is human judgment; names, indirect identifiers and sensitive allegations can be missed. No automated redaction guarantee is claimed.
- Suppression reduces small-cell exposure but does not guarantee anonymity or prevent longitudinal differencing. Exact total and repeated aggregate releases need independent threat assessment.
- Server-rendered public statistical data is not embedded; browser fetches current aggregates. Aggregation currently scans response JSON for each option. Load testing and a versioned materialized release process remain prerequisites for significant traffic.
- Raw responses have no admin UI/read endpoint. Trusted database owners and the service-role credential remain powerful; restrict infrastructure access and audit it externally.
- App audit tracks successful moderation, settings, deletion and exports; provider authentication/security event logs must be enabled and reviewed separately.
- Admin sessions intentionally do not survive page reload. Browser XSS would still threaten in-memory tokens; CSP is defense in depth, not a proof of safety.
- Retention is an implemented manual administrative operation. It requires a defined operating schedule; backups are not erased by the application.
- Email contact requires an actual verified address; policy/controller details and rights handling are not finalized.
- Content with respondents under 18 requires explicit policy/legal review before launch. No personal data should be entered into staging.
- Human screen-reader, keyboard-only review across all authenticated states, and an independent penetration/privacy assessment remain NOT TESTED.

Do not declare production readiness until the deployment checklist and independent review are completed with evidence.
