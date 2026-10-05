# 01: Bun workspaces and device playground

Type: task
Status: resolved
Blocked by: None

Spec: [Device playground](../spec.md)

Move library and library docs into packages/nut-fountain; retain root agent/domain/tracker docs. Add the workspace-linked Vite/React app, QR byte renderer/reader, camera and local testing UI, root commands, and setup/validation docs. Preserve protocol behavior and existing tests.

## Answer

Implemented Bun workspaces, moved the unchanged library source/tests to `packages/nut-fountain`, and added `apps/playground` using Vite, React, qrcode byte mode and jsQR binaryData. The app sends animated frames, scans the camera, imports QR images, and tests rendered QR pixels locally. Root README documents workspace commands and trusted HTTPS setup for phones.

Validation: typecheck and production build passed; 86 existing library tests (199 assertions), one QR byte/pixel test (5 assertions), 12 existing Chromium checks, and 8 app browser checks passed. App coverage includes exact reconstruction, invalid input, repair-only image input with loss, simulated camera success, completion/manual/unmount/late-permission cleanup, denial, and a 390px mobile layout. No physical camera or phone was available, so that validation remains manual. Vite reports a non-fatal 509 kB app chunk warning (170 kB gzip).

## Comments

- Library package name, exports, runtime dependency boundary and wire protocol are preserved. Existing root protocol/validation documentation paths forward to the moved documents.
- Tokens are not uploaded, persisted, or sent to a mint. No public deployment was performed.
