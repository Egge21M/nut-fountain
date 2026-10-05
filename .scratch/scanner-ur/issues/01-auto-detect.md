# 01: Connect UR to the demo reader

Type: task
Status: resolved
Blocked by: None

Spec: [Scanner compatibility](../spec.md)

Add a format-routing reader shared by image import and camera scanning. Expose rank-based UR progress without counting dependent accepted parts as progress. Keep the reference UR encoder development-only.

## Answer

The demo's shared TransferReader now selects the local binary or UR decoder from QR bytes. UR text conversion is restricted to UR frames; binary bytes remain unchanged. Camera and image imports accept cashuB strings and crawB binary wrapped in ur:bytes, including uppercase/alphanumeric QR, lowercase/byte QR, single-part and multipart inputs. The demo sends only the binary format. UR progress now reports independent equations and resets on failed reconstruction.

Validation: build/typecheck, 96 unit tests (396 assertions), and 26 Chromium checks pass. Reference bc-ur-generated pixel tests cover repair-only decoding with loss, duplicates, format isolation, and reset. Browser checks include all four UR payload/part variants and a simulated camera scanning repair-only uppercase UR cashuB text. Live HTTPS UR image import, partial/completed progress and exact token reconstruction passed with no browser errors. Physical wallet/camera validation remains manual.

Deployed at https://nut-fountain.fly.dev. The reference UR encoder remains a development-only test dependency.
