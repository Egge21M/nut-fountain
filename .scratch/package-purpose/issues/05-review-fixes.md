# 05: Resolve implementation review findings

Type: task
Status: claimed
Blocked by: 04

Spec: [Package purpose](../spec.md)

## Scope and acceptance

Fix accepted Uint8Array subclass aliasing at encoder input and received frame boundaries. Buffer.slice returns a view, so explicit owned Uint8Array copies are required. Add public-seam regression tests for caller mutation after encoder construction and after frame reception. Keep the core browser-native without Buffer imports.

Address the standards review's wire-layout maintenance concern by keeping binary frame serialization and parsing in the same internal module. Preserve the public interface and exact wire bytes; do not change protocol version or broaden scope.

Use tdd for correctness fixes and refactor at this review stage. Run the relevant tests, then final typecheck/build/browser acceptance and update validation counts. Merge integration/package-purpose before reporting. Commit on an isolated review-fix branch; merger resolves this ticket.

## Comments

- Review reports: /tmp/nut-fountain-review/standards.md and /tmp/nut-fountain-review/spec.md. Standards: one hard contract finding and one heuristic; Spec: one correctness finding, overlapping the contract finding.
