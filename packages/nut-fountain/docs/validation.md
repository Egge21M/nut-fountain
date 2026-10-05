# Implementation validation

Verified on 2026-10-05 with Bun 1.3.14, TypeScript 5.9.3, Playwright 1.63.0, and headless Chromium 153.0.8010.12. Runtime dependencies are pinned to `@cashu/cashu-ts@4.11.0`, `@noble/hashes@2.4.0`, and `cborg@4.3.2`. `@gandlaf21/bc-ur@1.1.12` remains pinned as a development-only interoperability reference. The lockfile records the full dependency graph.

Commands from the package root:

```sh
bun install
bun run build
bun run typecheck
bun run test
bun run test:browser
```

All 103 library Bun tests pass (366 assertions). Coverage includes the public byte encoder/reader, repair-only recovery, loss and reordering, duplicates, malformed frames, integrity checks, independent version-1 wire bytes, Cashu conversions, encoding helpers, UR rejection and recovery, and the built core entry point. The UR suite includes 54 reference-generated cases across payload sizes, fragment counts, and high unsigned sequence numbers, plus independent URKit vectors. An additional transfer exceeds the custom protocol's 256-fragment limit to verify that the shared solver preserves UR's separate 1024-fragment bound. Buffer input and received-frame ownership regressions verify exact recovery after caller mutation and ensure decoding leaves caller frames unchanged. Type checking and ESM/declaration builds pass.

The browser harness bundles a consumer that imports **built package entry points** through the export map, then executes it in actual Chromium. It verifies that global `Buffer` and `process` are absent before import and after execution. Reference UR fixtures are generated outside the browser using the pinned reference encoder, so the test does not need a public UR encoder in this package. The fixture proofs are not spendable.

Browser checks pass for:

- Arbitrary bytes through binary fountain frames, with exact byte recovery.
- `cashuB` through binary fountain frames, recovering equivalent token contents and original unpadded text.
- A cashu-ts `Token` with a full keyset ID and an `Amount` larger than JavaScript's safe integer range through binary fountain frames. Recovered amounts retain the consumer's `Amount` class identity.
- Single-part, multipart, and repair-only UR wrapping UTF-8 `cashuB` text.
- Single-part, multipart, and repair-only UR wrapping `crawB` binary.
- Published URKit single-part and multipart vectors, with dropped source frames.
- CBOR and base64url convenience entry points.

A separate clean installation using `bun install --production --frozen-lockfile` also built a browser consumer of the package exports. The installed dependency tree contained none of bc-ur, Buffer, JSBI, BigNumber, or alias-sampling.

All 19 library browser checks pass. Repair-only cases include dropped, reordered, repeated, and malformed inputs. The browser build audits the entire consumer import graph and fails if it resolves bc-ur, Buffer, JSBI, BigNumber, or alias-sampling.

On a fresh machine, install the browser once with `bun x playwright install chromium`. The managed development server required permission to launch Chromium outside its restricted process sandbox; no browser-specific library shims were needed. Other browser engines, actual wallets, QR readers, performance comparisons, and adversarial resource-exhaustion audits were not part of this acceptance run.

## UR bundle comparison

Measured with Bun 1.3.14 using `Bun.build({entrypoints: ['src/ur.ts'], target: 'browser', minify: true})`, bundling runtime dependencies. Gzip uses `Bun.gzipSync` on the resulting JavaScript. The baseline is commit `da4ee37`, before replacing the dependency.

| Standalone UR entry | Before | Local decoder | Reduction |
| --- | ---: | ---: | ---: |
| Minified JavaScript | 127,523 bytes | 31,864 bytes | 75.0% |
| Gzipped JavaScript | 41,809 bytes | 11,756 bytes | 71.9% |

These are bundle-size reductions for the standalone UR reader, not QR capacity or transfer-speed measurements. Applications sharing dependencies can see different savings.


## Alpha release artifact verification

Run `bun run test:package` from the package directory after committing changes. This check archives HEAD into a clean temporary checkout, installs with the frozen lockfile, asserts there is no pre-existing build, and invokes `npm pack` (which must build through `prepack`). It checks all exported JavaScript/declaration files and documentation/license files, then installs that exact tarball into an isolated production-only consumer.

The consumer checks all six public entry points, binary repair recovery with loss, Cashu conversion, UR routing against an independent fixture, CBOR/base64 helpers, native Node ESM execution, strict TypeScript NodeNext and Bundler resolution, and execution of a browser bundle in Chromium without Node globals. It also checks that development-only dependencies and TypeScript are absent from the production installation. Successful output includes the source commit, tarball path, and npm integrity hash. Temporary files are retained for inspection and publication of the verified artifact.
