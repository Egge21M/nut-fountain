# 01: Replace the UR runtime dependency

Type: task
Status: resolved
Blocked by: None

Spec: [Local UR decoder](../spec.md)

Implement minimal Bytewords decoding, UR parsing, exact MUR fragment selection and local fountain recovery. Move bc-ur to devDependencies, share existing primitives, extend compatibility/browser tests, document the mapping and verification results. Preserve the original binary protocol and public reader APIs.

## Comments

- Working on implement/local-ur from integration/package-purpose at da4ee37.

## Answer

Implemented in `42406d5`: local Bytewords/MUR decoding, native BigInt fragment selection, shared Gaussian solver, and a development-only reference package. Public APIs and the custom binary wire format are preserved.

Validation: 86 tests / 199 assertions, typecheck and build passed; 12 Chromium checks passed. A fresh production-only installation builds the browser entry points with bc-ur, Buffer, JSBI, BigNumber and alias-sampling absent. Standards and spec reviews found no issues. Standalone UR bundle size fell 75.0% minified and 71.9% gzipped; methodology is in docs/validation.md.
