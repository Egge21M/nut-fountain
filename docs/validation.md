# Implementation validation

Verified on 2026-10-05 with Bun 1.3.14, TypeScript 5.9.3, Playwright 1.63.0, and headless Chromium 153.0.8010.12. Runtime dependencies are pinned to `@cashu/cashu-ts@4.11.0`, `@gandlaf21/bc-ur@1.1.12`, and `cborg@4.3.2`. The lockfile records the full dependency graph.

Commands from the package root:

```sh
bun install
bun run build
bun run typecheck
bun run test
bun run test:browser
```

All 28 Bun tests pass (132 assertions). Coverage includes the public byte encoder/reader, repair-only recovery, loss and reordering, duplicates, malformed frames, integrity checks, independent version-1 wire bytes, Cashu conversions, encoding helpers, UR rejection and recovery, and the built core entry point. Buffer input and received-frame ownership regressions verify exact recovery after caller mutation and ensure decoding leaves caller frames unchanged. Type checking and ESM/declaration builds pass.

The browser harness bundles a consumer that imports **built package entry points** through the export map, then executes it in actual Chromium. It verifies that global `Buffer` and `process` are absent before import and after execution. Reference UR fixtures are generated outside the browser using the pinned reference encoder, so the test does not need a public UR encoder in this package. The fixture proofs are not spendable.

Browser checks pass for:

- Arbitrary bytes through binary fountain frames, with exact byte recovery.
- `cashuB` through binary fountain frames, recovering equivalent token contents and original unpadded text.
- A cashu-ts `Token` with a full keyset ID and an `Amount` larger than JavaScript's safe integer range through binary fountain frames. Recovered amounts retain the consumer's `Amount` class identity.
- Both single-part and multipart UR wrapping UTF-8 `cashuB` text.
- Both single-part and multipart UR wrapping `crawB` binary.
- CBOR and base64url convenience entry points.

On a fresh machine, install the browser once with `bun x playwright install chromium`. The managed development server required permission to launch Chromium outside its restricted process sandbox; no browser-specific library shims were needed. Other browser engines, actual wallets, QR readers, performance comparisons, and adversarial resource-exhaustion audits were not part of this acceptance run.
