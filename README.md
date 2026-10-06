# nut-fountain

Experimental binary fountain transport for Cashu tokens, with a browser playground for device testing.

The [version-1 protocol specification](packages/nut-fountain/docs/protocol.md) is the canonical wire-format definition for this project. It defines the `NF` magic, version `1`, and sequence-seeded fragment selection implemented by the library. Implementation guides, planning records, and external proposals do not define alternative wire formats.

- [`packages/nut-fountain`](packages/nut-fountain): the TypeScript library, protocol documentation, and compatibility tests. Its package name and public exports are unchanged.
- [`apps/playground`](apps/playground): a Vite + React app that sends and scans animated **raw binary** QR frames.

## Install the library

```sh
npm install nut-fountain@alpha
```

The library is ESM and experimental; APIs and wire compatibility may change. See the [library README](packages/nut-fountain/README.md) for usage. MIT license, copyright (c) 2026 Egge21M; third-party notices are retained in the package.

## Develop

Use Bun 1.3.14 or newer:

```sh
bun install
bun run dev
```

Open http://localhost:5173. The app starts with a synthetic, non-spendable Cashu token. Press **Start sending** to display animated QR frames, or **Run local QR test** to reconstruct the token from the rendered QR pixels on the same device.

The root dev command builds the library before starting Vite. App edits reload automatically; after editing the library, run `bun run build:lib` or restart the dev command.

## Test with a phone

1. Make the app reachable from both devices. Vite listens on `0.0.0.0:5173`. On a local machine, use its LAN address; on a remote server, use your environment's port forwarding or HTTPS proxy.
2. Serve it over **trusted HTTPS** for phone camera access. `bun run dev:https` enables a self-signed development certificate; your phone must trust it. Dismissing a certificate warning may not be sufficient. A trusted HTTPS proxy is usually easier. Plain HTTP works for camera access on `localhost`, but not at an ordinary LAN address. See [browser camera requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#privacy_and_security).
3. On one device, open **Send** and press **Start sending**. On the other, open **Receive**, press **Start camera**, and allow camera access. Keep the whole code in view until the token appears.
4. Adjust the frame rate or choose smaller fragments if scanning is difficult. Copy the reconstructed token to compare it with the sender.

For a forwarded hostname, allow that specific host if Vite requests it:

```sh
PLAYGROUND_ALLOWED_HOSTS=your-development-host.example bun run dev
```

You can also use **Next frame** on the sender and import screenshots with **Import QR images** on the receiver. Image import does not require camera permission or HTTPS.

Tokens are processed locally, without uploads, storage, or mint calls. The app reads the scanner's binary data directly; it does not encode fountain frames as base64, UTF-8 text, or UR. The device reader also automatically accepts single-part and animated `ur:bytes` QR codes carrying UTF-8 `cashuB` strings or `crawB` binary tokens. Camera scanning and image import use the package’s public `AutoDecoder`, with progress for both formats. Applications can instead select the scoped `FountainDecoder` or `UrDecoder`. Reset the reader before switching transfers. Sending still uses only the new binary format.

## Measure phone scanning speed

The sender allows 2–60 FPS and starts at 5 FPS. Fragment sizes range from 80 to 2,307 bytes, with extra density test steps at 256, 384, 512, 768, 1,024, 1,536, and 2,048 bytes. The maximum fills a version-40 QR at error correction M (2,307 payload bytes plus the 24-byte frame header). The displayed QR version and module dimensions identify its density. Fragments retain the selected size even for smaller tokens, using padding; beyond the token size, higher density adds padding rather than useful data. The camera reader processes fresh video frames without a fixed polling delay. It uses a QR worker with one frame in flight, skips busy frames instead of queuing them, and falls back to animation-frame scheduling when video-frame callbacks are unavailable. It requests a camera rate of 60 FPS as a preference; the camera/browser chooses the actual rate. Capture is limited to a 720-pixel longest side.

After a camera transfer completes, choose **Download scan diagnostics**. You can also stop an incomplete scan and download its report. Enter the sender's FPS in the optional field so comparisons include the display rate. Resetting the reader clears the report; starting another camera session replaces it.

After starting the reader camera, the **Camera** picker lists the devices exposed by your browser. Selecting one requests its exact device ID; changing it restarts capture while preserving the reader's progress. The choice remains across reader resets for this view, and is not saved to storage. Select an individual rear camera to avoid multi-lens switching; a combined Dual/Triple camera can still switch internally. Browsers do not expose a universal native iOS lens-switch lock, and may not expose every physical lens. An unavailable selected camera produces an error instead of silently choosing a different one. Diagnostic reports include only `camera.selection` (`automatic` or `explicit-device`), never the device IDs or labels.

For useful comparisons, use the same token, fragment size, screen brightness, distance, and lighting. Reset between runs and try 5, 10, 15, 20, 30, 40, 50, and 60 FPS. Share the downloaded JSON files along with the phone model if its browser user agent does not identify it precisely.

The result also shows **First valid frame to completion**, and JSON reports expose `firstValidFrameToCompleteMs`. This is reader wall time from receipt of the first accepted fountain frame through completed validation, excluding the earlier time spent aiming. It includes any pauses or image imports within that reader transfer and resets with the reader. Incomplete scans omit the duration. The result also shows approximate average payload throughput in decimal **kB/s** (1 kB = 1,000 bytes), calculated from reconstructed payload bytes over that same duration, excluding fountain/QR overhead and duplicates. Reports expose `payloadBytes` and `payloadKilobytesPerSecond`; a zero-duration transfer has no rate. For UR text transfers the payload size includes the reconstructed token text.

Reports contain build/browser information, actual camera settings, capture dimensions, active duration, camera callbacks and skipped frames, scan/QR/useful-equation rates, timing summaries, and a bounded timeline. They contain no tokens, raw QR payloads, camera images, mint URLs, or camera identifiers. Reports are generated locally and downloaded only when requested. Image imports do not produce camera reports.

Rates include time spent aiming after the camera starts, so compare time to the first useful frame as well as the overall rate. Useful equations measure fountain rank increases; QR reads can be duplicates or otherwise add no information. Camera presentation gaps are not a measurement of lost sender QR frames. Worker round-trip time includes startup on the first attempt; percentile summaries cover the latest 2048 attempts, while means/maxima cover the whole session.

## Validate and build

```sh
bun run typecheck
bun run test
bun run test:browser
bun run build
```

Browser tests require Chromium installed for Playwright (`bunx playwright install chromium`). They cover library compatibility, QR pixel decoding, app round trips, image import with missing frames, simulated camera input, permission errors, camera cleanup, and mobile layout. Simulated camera tests do not replace a physical phone test.

Production assets are in `apps/playground/dist`; library artifacts are in `packages/nut-fountain/dist`. Use `bun run preview` after building to preview the app on port 4173. Camera access on a remote preview still requires trusted HTTPS.

See the [protocol specification](packages/nut-fountain/docs/protocol.md) for language-neutral wire rules, the [implementation guide](packages/nut-fountain/docs/implementation.md) for the solver and package behavior, and the [library README](packages/nut-fountain/README.md) for API examples.

## Fly.io deployment

The playground is deployed at https://nut-fountain.fly.dev in the `personal` organization.

To deploy changes from the repository root:

```sh
flyctl deploy --remote-only --ha=false
```

`Dockerfile` builds the workspace with the frozen Bun lockfile, then serves only the generated app assets with nginx. `fly.toml` enables HTTPS, a health check, and one shared CPU with 256 MB RAM in Frankfurt. The machine stops while idle and starts on requests, so the first visit after inactivity can take a moment. The deployed HTTPS origin supports phone camera permissions without a development certificate.
