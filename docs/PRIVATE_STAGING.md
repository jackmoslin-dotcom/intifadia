# Private synthetic staging runbook

No deployment has been performed. Do not expose this application to real respondents.

## Required external configuration

Provision an isolated Supabase project; run both migrations; disable public Auth signup; create named test administrators and assign owner/moderator/analyst roles through a trusted database session. Configure Auth rate limits, token expiry, and TOTP. Keep service-role credentials in the host secret manager. Configure Turnstile for the exact private hostname and set APP_ORIGIN to its HTTPS origin. Set a verified CONTACT_EMAIL and identify the data controller in the privacy/about pages before public review.

Use a private VPN or an identity-aware access gateway in front of the entire application, including API paths. A banner and an unguessable URL are not access controls. The Node process binds only to 127.0.0.1; terminate TLS on the same host and proxy privately to port 4317. Do not expose the origin directly. If hosting in containers, explicitly design private networking and bind configuration; the included loopback default is intended for a host-local proxy, not a public container port.

Run `npm ci`, `npm run build`, then `NODE_ENV=production npm start` (PowerShell equivalent is in README). Configure an OS service with restricted account permissions, restart-on-failure, no request-body/access-token logging, and a protected `.env` or injected environment. Do not run Vite in staging. Set TRUST_PROXY_HOPS only after confirming the proxy topology prevents client-supplied forwarding headers from reaching the application untrusted.

PostgreSQL functions and RLS also protect direct REST access; a private application gateway does not automatically make the Supabase REST endpoint private. Use a separate project and synthetic data. Review Supabase network restrictions and REST exposure independently.

## Acceptance exercise with live services — NOT YET EXECUTED

1. Anonymous respondent: select representative answers, skip optional demographics, confirm synthetic-only consent, complete Turnstile, submit. Check one responses row and one demands row per written answer through a trusted SQL session. Browser must show success only after the RPC commits.
2. Replay the same request UUID and identical answers with a fresh bot token: one response remains. Change its answers with the same UUID: rejected. Different UUIDs are different responses; the application does not guarantee one response per person.
3. Send invalid options, unknown questions, hidden conditional answers, duplicate selections, exclusive options mixed with others, excessive selections, malformed JSON and oversized payloads. Expect rejection and no partial writes.
4. Insert at least five synthetic responses through the actual submission flow. Verify counts against trusted SQL. Add one answer in a different city: that entire question distribution must be hidden. Never use production people as test fixtures.
5. Written demand: verify absent from `/demands` while pending. Sign in as moderator, enroll/verify actual TOTP, redact and approve. Only safe_text should appear publicly. Reject the same record and verify its removal.
6. Sign in as analyst: moderation/settings must be denied even by direct RPC. An owner at aal1 must be rejected. An authenticated user without an admin_roles row must be rejected. As anon, raw tables and privileged RPCs must fail.
7. Export aggregates and inspect UTF-8 Arabic in a spreadsheet; confirm no individual answers or free text. Review audit entries for export/moderation/settings/deletion.
8. Backdate a disposable synthetic record in the isolated database, run confirmed retention deletion as owner, verify response and linked demands removed and fresh data retained. Check the provider's backup restore lifecycle separately.
9. Verify 11th rate-limited attempt fails across two app instances using the same Supabase database and RATE_LIMIT_SECRET. Test stale/wrong-host/wrong-action Turnstile tokens with the actual service.
10. Test real refresh/expiry/logout, OTP replay, factor recovery, revocation, and revoked admin roles. Run an independent security assessment before real data.

## Operational work before any broader launch

Have the owner review Arabic wording and options. Review under-18 participation with qualified advisers or remove that audience until an appropriate policy exists. Confirm lawful processing, controller identity, international transfers, backup retention, rights handling, contact address, and accessibility with human Arabic screen-reader users. Define a scheduled retention process and alerts; manual deletion alone is not an operational schedule. Evaluate snapshot differencing and aggregation performance under expected load. Consider fixed publication intervals and a formal privacy budget if needed.

Keep all credentials out of test artifacts. Test screenshots contain synthetic or empty data only. Do not capture QR secrets, real OTPs or credentials. Reset the private project or explicitly delete disposable synthetic data before a separately approved launch. Record evidence and update ACCEPTANCE_REPORT.md; do not change NOT TESTED to PASSED based on configuration alone.
