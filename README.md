# nut-fountain

An experimental, browser-compatible TypeScript package for developing a binary fountain transport specification. It encodes arbitrary bytes into versioned binary fountain frames, reconstructs those bytes, and provides Cashu V4 helpers and an inbound UR reader. The package is private and has not been published; wire compatibility may change.

QR rendering, camera scanning, wallet integration, and comparative performance claims are outside this implementation. Its new dense GF(2) fountain protocol differs from the earlier POC; that POC's efficiency measurements do not establish this protocol's performance.

## Build and verify

```sh
bun install
bun run build
bun run typecheck
bun run test
bun x playwright install chromium # Needed only if Chromium is not already cached.
bun run test:browser
```

`build` produces ESM and declaration files in `dist/`. Browser applications should consume this local package through an ESM-capable bundler (for example, via a `file:` dependency); its dependencies are external in the package artifacts and resolved by the application bundler. The browser test does exactly this using the package export map. No global `Buffer` or `process` polyfill is required. `nut-fountain/core` can be imported without pulling in Cashu or UR code.

The [validation record](docs/validation.md) lists versions, commands, and coverage. No npm publication is part of this experiment.

## Arbitrary bytes

```ts
import { FountainEncoder, FountainDecoder } from 'nut-fountain/core';

const message = new TextEncoder().encode('hello');
const encoder = new FountainEncoder(message, { fragmentSize: 128 });
const decoder = new FountainDecoder();

// A local round trip. In an application, send each frame through your transport.
for (let i = 0; i < encoder.fragmentCount; i++) {
  decoder.receive(encoder.nextFrame());
}
if (!decoder.isComplete) throw new Error('Transfer incomplete');
const restored = decoder.result!; // Exact original bytes; a defensive copy.
```

`nextFrame()` first emits source fragments, then repair frames. A receiver can accept reordering and duplicates and recover from lost source frames using repair frames. A real sender continues generating frames until the receiver completes or the application stops the transfer; there is no fixed completion bound under arbitrary loss. The example sends all source frames without loss.

`FountainDecoder.receive()` returns whether the frame added an independent equation, **not** whether decoding is complete. Malformed frames and frames belonging to another message throw. Use `isComplete` and `result` for completion, and `reset()` before another transfer. See the [wire format](docs/protocol.md) for size bounds, checksums, and exact behavior.

## Cashu V4 tokens

```ts
import { Amount, type Token } from '@cashu/cashu-ts';
import { FountainEncoder, FountainDecoder } from 'nut-fountain/core';
import { tokenToBytes, bytesToToken, bytesToTokenString } from 'nut-fountain/cashu';

// A structurally valid fixture, not spendable money.
const token: Token = {
  mint: 'https://mint.example',
  unit: 'sat',
  proofs: [{
    id: '009a1f293253e41e', amount: Amount.from(1),
    secret: 'not-spendable', C: '02' + '11'.repeat(32),
  }],
};
// A cashuB string is also accepted in place of token.
const encoder = new FountainEncoder(tokenToBytes(token));
const decoder = new FountainDecoder();
for (let i = 0; i < encoder.fragmentCount; i++) decoder.receive(encoder.nextFrame());
if (!decoder.isComplete) throw new Error('Transfer incomplete');
const recoveredToken = bytesToToken(decoder.result!);
const cashuB = bytesToTokenString(decoder.result!);
```

`tokenToBytes` returns `crawB` binary bytes. Text conversion preserves the original CBOR and produces unpadded base64url text. Object input uses the public `Token` shape in pinned `@cashu/cashu-ts@4.11.0`, including `Amount` values. Object conversions promise equivalent contents rather than identical serialization: cashu-ts defaults missing units to `sat` and normalizes witness metadata to JSON strings. Full keyset IDs from objects are preserved; already shortened IDs in input cannot be expanded without additional information. Helpers do not contact a mint or validate whether proofs are spendable. `cashuA` is unsupported.

## Existing UR input

```ts
import { UrDecoder } from 'nut-fountain/ur';
import { bytesToToken, bytesToTokenString } from 'nut-fountain/cashu';

export function readUrParts(parts: Iterable<string>) {
  const reader = new UrDecoder();
  for (const part of parts) {
    reader.receive(part); // The complete UR string, including ur:bytes/.
    if (reader.isComplete) {
      return {
        token: bytesToToken(reader.result!),
        cashuB: bytesToTokenString(reader.result!),
      };
    }
  }
  throw new Error('More UR parts are needed');
}
```

The supported convention is `ur:bytes` carrying a CBOR byte string whose payload is either UTF-8 `cashuB` text or `crawB` binary. Single-part and multipart inputs, including uppercase strings, are accepted. `UrDecoder` removes UR/Bytewords/CBOR framing and returns payload bytes; the Cashu helpers interpret either payload representation. The package does not encode UR.

`UrDecoder.receive()` returns whether a new part was accepted; it returns `false` for malformed, duplicate, foreign, over-limit, or post-completion input. It does **not** indicate completion. Use `isComplete`, `result`, and `reset()` as with the binary reader. A failed reconstructed UR message resets the session; a successfully reconstructed non-Cashu byte payload is rejected by the Cashu helper. [NUT-16](https://github.com/cashubtc/nuts/blob/main/16.md) does not fix the exact UR payload mapping, so these conventions do not establish compatibility with every wallet.

## Entry points

| Import | Exports |
| --- | --- |
| `nut-fountain/core` | `FountainEncoder`, `FountainDecoder` |
| `nut-fountain/cashu` | `tokenToBytes`, `bytesToToken`, `bytesToTokenString`, type `Token` |
| `nut-fountain/ur` | `UrDecoder` |
| `nut-fountain/encoding` | `encodeCbor`, `decodeCbor`, `encodeBase64Url`, `decodeBase64Url` |
| `nut-fountain` | All of the above |

CBOR helpers encode CBOR-compatible values and decode exactly one item. Base64 helpers use the URL-safe alphabet; encoding omits padding and decoding accepts valid padded or unpadded input. Invalid input throws.
