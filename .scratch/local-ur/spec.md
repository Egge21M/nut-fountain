# Local UR decoder

Status: Implementation in progress.

Replace the @gandlaf21/bc-ur runtime dependency with local browser-native UR decoding while preserving UrDecoder's public API and the supported ur:bytes conventions. Keep the pinned reference package only as a development dependency for interoperability tests. Reuse CBOR and a small SHA-256 dependency; use native BigInt for the UR PRNG. Keep the custom binary wire format unchanged and share the Gaussian solver where useful.

Acceptance: decode published vectors and reference-generated single/multipart inputs, including repair-only streams, loss/reordering, duplicate frames, checksums and malformed input. Recover both cashuB text and crawB payload conventions in Chromium without Node globals. Verify production browser entry points do not import the reference library or its Buffer/JSBI/BigNumber/alias-sampling stack. Preserve the current bounded resource behavior and reset semantics. No public UR encoder is added.

Tests exercise the existing public UrDecoder, byte encoder/decoder and built-browser entry points; these are the user-approved seams. Internal helpers are not exposed or tested as public APIs.
