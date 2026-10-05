# Package purpose and goals

Status: Purpose and goals agreed through the design interview. Implementation is in progress; see map.md for the task graph.

## Confirmed

Build an experimental TypeScript package that serves as the basis for a specification draft for binary fountain transport.

Expose a core encoder and decoder for arbitrary bytes. Provide Cashu convenience helpers that accept a token represented as a JavaScript object or an encoded string, including CBOR and base64 encoding and decoding conveniences. The core remains useful without Cashu payloads.

Encode only the new binary fountain format. Decode both the new format and existing UR input. Cashu helpers initially support V4 cashuB tokens; cashuA support is outside this experiment.

Browser compatibility is required. Additional runtime guarantees have not been requested.

This is an experimental specification-development package. Stable wire compatibility and production readiness are not yet promised.

## Required outcomes

- Cashu token -> our binary fountain frames -> reconstructed Cashu token.
- Existing UR input carrying a Cashu token -> reconstructed Cashu token.

These round trips are sufficient for the initial experiment. Comparative frame savings, loss benchmarks, and integration with a wallet are not acceptance requirements. QR rendering and camera scanning are outside these byte-level round trips.

## Representation and compatibility contracts

- The byte core reconstructs the exact original bytes.
- Cashu object helpers use the public cashu-ts Token shape. Object conversions preserve equivalent token contents; they do not promise identical serialized text.
- UR decoding accepts complete UR strings and handles URI, Bytewords, and CBOR framing internally.
- Supported UR payload conventions are cashuB text and crawB binary, each wrapped as a CBOR byte string as in the earlier POC. Single-part and multipart UR inputs belong to the inbound compatibility scope.
- New binary fountain frames carry an explicit format version independent of the Cashu token version. The exact wire layout is an implementation and specification-design task.

## Acceptance checks

1. Encode arbitrary bytes into the new binary fountain frames and reconstruct byte-for-byte identical input.
2. Convert a cashuB token to our binary fountain frames, decode it, and recover the same token contents.
3. Repeat the Cashu round trip with an object matching the public cashu-ts Token shape.
4. Decode existing UR input containing cashuB text and recover the same token contents.
5. Decode existing UR input containing crawB binary and recover the same token contents.
6. Demonstrate these capabilities in a browser; a Bun-only test run does not establish browser compatibility.

The experiment supplies evidence and an implementation for a later specification draft. Publication of the draft, production hardening, and a stable protocol release are not required to complete these initial round trips.

## Research relevant to compatibility

UR multipart CBOR parts contain sequence number, sequence length, message length, checksum, and fragment data, with no explicit wire-version field. The URI carries the UR type separately. Cashu cashuB/crawB prefixes carry token version B. The earlier POC has its own CFP1 framing marker; this is not yet a decision for this package.

An inbound UR adapter is feasible alongside custom binary output. Shared fountain decoding requires compatibility with the existing deterministic fragment selection. Supporting the POC conventions alone would not establish interoperability with every wallet: NUT-16 does not specify an exact UR type and payload mapping.

Sources:
- https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2024-001-multipart-ur.md#part-serialization
- https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md#ur-encoding
- https://github.com/cashubtc/nuts/blob/main/00.md#binary-token
- https://github.com/cashubtc/nuts/blob/main/16.md
