# Implementation review

Baseline: `main` (`5326c6c`). Initial review: `7d34c9b`. Fixes: `67942c9`, merged through `34db42d`.

## Standards

Reviewed `git diff main...HEAD` at `5326c6c..7d34c9b`, including the documented tracker, glossary, README and wire contracts. No tracker-layout or glossary violations found.

1. **Documented-contract violation — defensive copies rely on subclass-sensitive `slice()`.** `src/core.ts:25` uses `this.message = message.slice()` and `src/internal/core/wire.ts:39` uses `data: frame.slice(20, -4)`. `docs/protocol.md`, “Public byte interface,” explicitly promises: “The constructor copies the input; changing it afterward does not change the encoded message.” The public runtime guard accepts every `Uint8Array`, including `Buffer`, whose `slice()` aliases memory. Reproduced with `new FountainEncoder(Buffer.from([1,2,3]), {fragmentSize:3})`, modifying the original before `nextFrame()`: its own decoder throws a reconstructed-message checksum error. Incoming Buffer frames likewise retain aliases in equations. Use `new Uint8Array(message)` and `new Uint8Array(frame.subarray(20, -4))` to make ownership independent of subclass behavior; cover mutation through the public round-trip seam. This requires no Buffer global in the package.

2. **Judgment call, low severity — possible Shotgun Surgery in the versioned wire layout.** `src/core.ts:33–40` writes `frame.set([0x4e, 0x46, 1, 0])`, `view.setUint32(4, sequence)` and `frame.subarray(20, -4)`; `src/internal/core/wire.ts:23–39` independently embeds the corresponding header, offsets and boundaries. Format evolution must update both modules consistently. Consider putting serialization alongside parsing in `wire.ts`, with shared header/layout constants. This is a maintainability heuristic, not a documented-standard breach.

Two findings: one documented-contract violation and one low-severity heuristic.

### Resolution verification

Verified the scoped changes in `67942c9` against `7d34c9b`. Both findings are resolved: the encoder and frame parser now make explicit `new Uint8Array(...)` copies; three public regression tests cover encoder-input mutation, received-frame mutation and caller-owned duplicate frames. Serialization now lives beside parsing in `wire.ts`, sharing prefix, offset and CRC-size constants. No outstanding standards findings from this review. Verification was by targeted diff inspection; the implementation's reported full checks were not rerun.


## Spec

Reviewed `main` (`5326c6c`) through frozen integration HEAD `7d34c9b` using `git diff main...HEAD`, against `.scratch/package-purpose/spec.md` and tickets 01–04.

- **P2 — Accepted Uint8Array subclasses can violate exact recovery through aliased buffers** (`src/core.ts:25`, `src/internal/core/wire.ts:39`). The spec requires: “The byte core reconstructs the exact original bytes.” The protocol additionally promises: “The constructor copies the input; changing it afterward does not change the encoded message.” Both code locations rely on the input's `.slice()` to copy. `Buffer` is an accepted `Uint8Array` subclass, but its `.slice()` returns a view. Confirmed: construct an encoder with `Buffer.from([1,2,3])`, mutate the original byte, then transmit its first frame; the receiver throws a reconstructed-message checksum error. Also confirmed: receive a Buffer-backed first source frame, mutate its payload afterward, then receive the second source frame; the stored equation changed and reconstruction fails. This affects browser Buffer implementations as well as Bun/Node. Copy into an owned plain Uint8Array explicitly at both boundaries and test encoder input isolation and decoder frame isolation through the public API.

No missing acceptance outcomes or unjustified scope additions found. Built-package browser acceptance covers all six specified checks, including single/multipart UR text and binary token conventions. The documented experimental limits are permitted by ticket 01.

Total: **1 finding**; worst issue is input aliasing that breaks the byte recovery contract.

### Resolution verification

Verified commit `67942c9`: the encoder owns `new Uint8Array(message)` and the parser owns `new Uint8Array(frame.subarray(DATA_OFFSET, -CRC_SIZE))`, removing subclass-dependent slice behavior at both input boundaries. Three public API regression tests cover later encoder-input mutation, later received-frame mutation, and decoder equation reduction leaving caller frames unchanged. The parent reports 28 tests/132 assertions and eight browser checks passing; this verification inspected the fix and regression coverage without rerunning the full suite. **Outstanding spec findings: 0.**


Summary: Standards — 2 findings resolved, 0 outstanding; Spec — 1 finding resolved, 0 outstanding. Both axes identified the same input-ownership defect; the standards axis also identified a wire-layout maintenance concern.
