# 01: Replace the UR runtime dependency

Type: task
Status: claimed
Blocked by: None

Spec: [Local UR decoder](../spec.md)

Implement minimal Bytewords decoding, UR parsing, exact MUR fragment selection and local fountain recovery. Move bc-ur to devDependencies, share existing primitives, extend compatibility/browser tests, document the mapping and verification results. Preserve the original binary protocol and public reader APIs.

## Comments

- Working on implement/local-ur from integration/package-purpose at da4ee37.
