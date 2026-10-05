# 02: Cashu V4 and encoding helpers

Type: task
Status: ready-for-agent
Blocked by: None

Spec: [Package purpose](../spec.md)

## Scope and acceptance

Implement browser-native Cashu V4 helpers using the public cashu-ts Token type and supported official APIs where possible; pin the dependency version. Export src/cashu.ts: tokenToBytes(token: string | Token): Uint8Array (crawB bytes), bytesToToken(bytes): Token, bytesToTokenString(bytes): string. Reject cashuA. Preserve exact CBOR bytes for text-to-binary-to-text where feasible; object conversions promise equivalent contents, including memo/proof metadata. Export CBOR and base64url utilities through src/encoding.ts; reject invalid encodings clearly. Own these sources, tests/cashu.test.ts, tests/encoding.test.ts, and package.json/bun.lock dependency changes for runtime helpers. Coordinate dependencies by informing parent, not editing other agents files. Read /tmp/nut-fountain-research/ notes when available. Tests use public helper seams, known-good fixtures and actual cashu-ts objects including Amount. No network/mint calls.

## Workflow

Use the tdd skill at the public round-trip seams already agreed in the spec. Work on a dedicated branch/worktree based on integration/package-purpose. Merge the integration tip before reporting. Commit your changes and report tests plus commit. Parent resolves the ticket after integration.

## Comments

- Created from the agreed purpose and goals; implementation details are delegated within this scope.
