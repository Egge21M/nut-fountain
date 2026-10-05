# nut-fountain

Experimental binary fountain transport for Cashu tokens, with a browser playground for device testing.

- [`packages/nut-fountain`](packages/nut-fountain): the TypeScript library, protocol documentation, and compatibility tests. Its package name and public exports are unchanged.
- [`apps/playground`](apps/playground): a Vite + React app that sends and scans animated **raw binary** QR frames.

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

Tokens are processed locally, without uploads, storage, or mint calls. The app reads the scanner's binary data directly; it does not encode fountain frames as base64, UTF-8 text, or UR. The device reader currently accepts only this experimental binary format; the library still exposes its UR compatibility decoder.

## Validate and build

```sh
bun run typecheck
bun run test
bun run test:browser
bun run build
```

Browser tests require Chromium installed for Playwright (`bunx playwright install chromium`). They cover library compatibility, QR pixel decoding, app round trips, image import with missing frames, simulated camera input, permission errors, camera cleanup, and mobile layout. Simulated camera tests do not replace a physical phone test.

Production assets are in `apps/playground/dist`; library artifacts are in `packages/nut-fountain/dist`. Use `bun run preview` after building to preview the app on port 4173. Camera access on a remote preview still requires trusted HTTPS.

See the [library README](packages/nut-fountain/README.md) for APIs and [wire protocol](packages/nut-fountain/docs/protocol.md) for the experimental format.

## Fly.io deployment

The playground is deployed at https://nut-fountain.fly.dev in the `personal` organization.

To deploy changes from the repository root:

```sh
flyctl deploy --remote-only --ha=false
```

`Dockerfile` builds the workspace with the frozen Bun lockfile, then serves only the generated app assets with nginx. `fly.toml` enables HTTPS, a health check, and one shared CPU with 256 MB RAM in Frankfurt. The machine stops while idle and starts on requests, so the first visit after inactivity can take a moment. The deployed HTTPS origin supports phone camera permissions without a development certificate.
