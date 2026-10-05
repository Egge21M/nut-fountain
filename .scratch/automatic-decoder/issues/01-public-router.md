# 01: Export the automatic router

Type: task
Status: resolved
Blocked by: None

Spec: [Public automatic decoder](../spec.md)

Extract the router, document its contract, retain both scoped decoders, migrate the demo and cover the built public API in tests.

## Validation

Typecheck, production build, 102 unit tests (479 assertions), and 33 Chromium checks passed. Public built exports are tested from both root and subpath, along with scoped decoder behavior, mixed UR text/byte input, binary data preservation, progress, rejected initial frames, session isolation, failed UR reconstruction, and reset in both format directions. The browser consumer runs without Node globals or the reference UR runtime. The demo camera/image tests now consume the package router.

## Answer

Exported AutoDecoder and DecoderFormat from nut-fountain and nut-fountain/auto. Scoped FountainDecoder and UrDecoder remain available with unchanged behavior. AutoDecoder accepts Uint8Array or UR string input, exposes format/progress/result, and resets selection and transfer state. The demo now imports the package API and its local router was deleted.

Deployed at https://nut-fountain.fly.dev. Live Chromium checks passed for binary and UR reconstruction, partial/completed progress, duplicate handling and reset, with no browser errors. Physical device checks remain manual.
