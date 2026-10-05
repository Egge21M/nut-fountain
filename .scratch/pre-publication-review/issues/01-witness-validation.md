# 01: Reject invalid witness metadata at the Cashu boundary

Status: resolved
Severity: P2
Axis: Spec
Reviewed commit: cdb04b955907ab364cbb2505996c525185258402
Location: packages/nut-fountain/src/cashu.ts:41

## Finding

A structurally otherwise valid crawB token with CBOR proof field w:123 successfully decodes to proof.witness === 123. The public cashu-ts Token type excludes numbers for witness. bytesToTokenString and tokenToBytes(string) reaccept the same invalid value. Valid witness objects normalize to strings correctly; this finding concerns malformed wire input, not valid object equivalence.

## Evidence

Reproduction: /tmp/nut-fountain-publication-review/witness.ts. Uses fixture mint https://mint.example, keyset 009a1f293253e41e, amount1, secret test-secret, and C=02 followed by 32 bytes of11. Output: actualType=number, witness=123, roundTripWitness=123.

## Acceptance

Validate or normalize optional witness metadata at the boundary so returned tokens satisfy the public Token shape. Reject malformed wire witnesses and add a regression through the public helpers. Preserve valid witness normalization and original CBOR for supported text tokens.

## Resolution

2026-10-05: Validate the original CBOR witness field as text, including falsy malformed values that cashu-ts omits. Eight malformed wire variants are rejected by binary/text/UR-payload helper paths; valid object witnesses still normalize to strings and text CBOR remains unchanged. The regressions failed before the fix and pass afterward.
