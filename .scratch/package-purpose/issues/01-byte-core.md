# 01: Versioned binary fountain core

Type: task
Status: ready-for-agent
Blocked by: None

Spec: [Package purpose](../spec.md)

## Scope and acceptance

Implement a browser-native Uint8Array fountain encoder and decoder. Public exports from src/core.ts: FountainEncoder(message, { fragmentSize?: number }), nextFrame(): Uint8Array, fragmentCount; FountainDecoder with receive(frame): boolean (whether useful), isComplete and result getters (result undefined until complete, defensive copy), reset(). No Cashu or UR dependencies in this core. Document the explicit versioned wire layout and deterministic fragment selection under docs/protocol.md. Start systematic then emit genuine mixed repair frames; recover missing source frames, not merely repeat chunks. Use the earlier POC as reference, not blindly copy its dependency on UR internals. Reject malformed/unsupported frames, guard sizes, avoid mixing messages, verify integrity, preserve arbitrary bytes (define empty-message behavior). Bounded experimental limits are acceptable if documented. Tests only via public byte encoder/decoder seam: exact recovery, a lost source frame recovered using repair frames, duplicates/reordering, invalid input, reset. Do not edit package.json or bun.lock. Own src/core.ts, src/internal/core/*, tests/core.test.ts, docs/protocol.md.

## Workflow

Use the tdd skill at the public round-trip seams already agreed in the spec. Work on a dedicated branch/worktree based on integration/package-purpose. Merge the integration tip before reporting. Commit your changes and report tests plus commit. Parent resolves the ticket after integration.

## Comments

- Created from the agreed purpose and goals; implementation details are delegated within this scope.
