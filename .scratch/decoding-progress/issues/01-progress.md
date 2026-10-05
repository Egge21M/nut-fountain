# 01: Expose and display decoding progress

Type: task
Status: resolved
Blocked by: None

Spec: [Binary decoding progress](../spec.md)

Add library getters, receiver progress bar, API documentation, and regression coverage for partial input, loss, duplicates, rejected frames, failed reconstruction, completion and reset.

## Validation

Typecheck, production build, 88 unit tests (236 assertions), and 21 Chromium checks pass. Unit coverage includes loss/repair recovery, duplicate and rejected input, failed message validation, completed transfers, empty messages, and reset. Browser coverage checks the rendered progress value with partial QR-image input, a duplicate, completion, and reset. Wire encoding is unchanged.

## Answer

Added `FountainDecoder.independentFrames`, `fragmentCount`, and `progress`; the receiver displays a percentage bar and independent frame count. Documentation explains information progress and reset semantics. Deployed to https://nut-fountain.fly.dev. Live Chromium checks passed for the QR pixel round trip, partial progress, duplicate handling, reset, secure camera API availability, and mobile layout, with no browser errors. Physical camera scanning remains a hardware validation step.
