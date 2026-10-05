# 04: Package integration and browser round trips

Type: task
Status: claimed
Blocked by: 01, 02, 03

Spec: [Package purpose](../spec.md)

## Scope and acceptance

Integrate exports, package metadata, build and type declarations, README examples and reproducible browser tests. Complete all six acceptance checks in ../spec.md. Core should be separately importable from Cashu/UR helpers. Support cashuB and token-object -> new binary frames -> equivalent token, plus single-/multipart UR wrapping cashuB and crawB -> token. Add a thin public Cashu reader/helper only if it simplifies these workflows; do not add QR rendering/scanning or benchmark work. Use real headless Chromium without Node globals to prove exported package browser compatibility; validate published/build artifact shape in browser, not only source in Bun. Existing Playwright browser caches are available. Record versions and exact test commands. Own integration files after dependency tickets merge. Keep package private/experimental; no publishing. Run bun tests, typecheck, build and browser acceptance. Update docs/protocol.md to accurately reflect integrated format and limitations.

## Workflow

Use the tdd skill at the public round-trip seams already agreed in the spec. Work on a dedicated branch/worktree based on integration/package-purpose. Merge the integration tip before reporting. Commit your changes and report tests plus commit. Parent resolves the ticket after integration.

## Comments

- Created from the agreed purpose and goals; implementation details are delegated within this scope.

- Claimed after tickets 01, 02 and 03 were merged and resolved.
