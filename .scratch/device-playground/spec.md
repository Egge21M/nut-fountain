# Bun monorepo and device playground

Status: Implemented. Automated validation passed; physical phone validation remains manual.

User request: move the library under packages/ in a Bun monorepo and add a small Vite + React app for testing binary encoding on a real device.

Keep nut-fountain's package name, public exports, protocol and existing tests. Place the library in packages/nut-fountain and app in apps/playground, joined by workspace:*.

The mobile-friendly app sends a Cashu V4 token as animated raw binary QR frames and receives those bytes through camera scanning. Include a visibly synthetic demo, pause/resume/step controls, adjustable frame rate and fragment size, received-token copy, camera cleanup and permission errors. Provide QR-image import and a local image-based round-trip test. No token upload, persistence, mint calls, or public deployment is needed. Document trusted HTTPS for phone camera use and offer local HTTPS dev mode.

Validate existing library tests/build/types, actual QR pixels into the scanner and library, browser UI including simulated camera success/denial/cleanup, and a mobile layout. Physical phone/camera behavior remains a manual validation step.
