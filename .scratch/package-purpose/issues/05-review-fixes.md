# 05: Resolve implementation review findings

Type: task
Status: resolved
Blocked by: 04

Spec: [Package purpose](../spec.md)

## Scope and acceptance

Fix accepted Uint8Array subclass aliasing at encoder input and received frame boundaries. Buffer.slice returns a view, so explicit owned Uint8Array copies are required. Add public-seam regression tests for caller mutation after encoder construction and after frame reception. Keep the core browser-native without Buffer imports.

Address the standards review's wire-layout maintenance concern by keeping binary frame serialization and parsing in the same internal module. Preserve the public interface and exact wire bytes; do not change protocol version or broaden scope.

Use tdd for correctness fixes and refactor at this review stage. Run the relevant tests, then final typecheck/build/browser acceptance and update validation counts. Merge integration/package-purpose before reporting. Commit on an isolated review-fix branch; merger resolves this ticket.

## Comments

- Review reports: /tmp/nut-fountain-review/standards.md and /tmp/nut-fountain-review/spec.md. Standards: one hard contract finding and one heuristic; Spec: one correctness finding, overlapping the contract finding.

## Answer

Implemented in `67942c9`, integrated by merge `34db42d`. Encoder inputs and accepted frame payloads now use owned Uint8Array copies, preserving the byte contract even for subclasses whose slice method aliases memory. Wire serialization and parsing share the internal wire module without changing version-1 bytes. Implementer validation passed 28 tests and 132 assertions, typecheck/build, and all eight browser acceptance checks. The integration merge had no conflicts, and `git diff --exit-code implement/05-review-fixes HEAD` confirmed an identical tree before this tracker update.
