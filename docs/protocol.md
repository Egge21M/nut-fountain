# Experimental binary fountain format, version 1

The byte core transports one finite `Uint8Array`. It first emits every source fragment, then emits deterministic XOR combinations that can repair missing fragments. This is an experimental dense random linear fountain scheme over GF(2), not the UR fountain algorithm. The format is explicitly versioned and is expected to evolve while developing a specification. QR rendering and scanning are outside this format.

## Public byte interface

```ts
const encoder = new FountainEncoder(message, { fragmentSize: 128 });
const decoder = new FountainDecoder();
decoder.receive(encoder.nextFrame());
// Repeat until decoder.isComplete; decoder.result is then the original bytes.
```

`fragmentCount` is the number of source fragments, not a promise about how many received frames will suffice after loss. `nextFrame()` emits a fresh frame with a sequence number starting at 1. Sequences never wrap: after 0xffffffff the encoder throws. The constructor copies the input; changing it afterward does not change the encoded message.

`receive(frame)` returns `true` when a frame adds an independent equation, including the equation that completes recovery. It returns `false` for redundant frames and frames for the same message received after completion. Invalid frames or mismatched message metadata throw; a bad frame rejected during parsing does not alter reader state. `result` is `undefined` until complete and returns a defensive copy thereafter. `reset()` clears both the message identity and all accumulated equations.

The first accepted frame selects the current message using its length, fragment count, fragment size, and message CRC. Frames with a different tuple are rejected until reset, including after completion. This tuple is an accidental-mixup guard, not a cryptographic identity: distinct messages can collide in CRC-32. CRCs detect accidental corruption; they provide no authenticity against an adversarial sender. After a reconstructed-message integrity failure, the final equation is discarded; earlier accepted equations may still be wrong, so resetting can be necessary.

## Bounds and padding

Fragment size defaults to 128 bytes and must be an integer from 1 through 4096. At most 256 source fragments are accepted, so the largest possible message is 1 MiB with 4096-byte fragments. A message exceeding 32768 bytes needs an explicitly larger fragment size than the default. These bounds limit storage and Gaussian-elimination work; this experiment does not claim suitability for large file transfers.

For message length `L` and fragment size `S`, source count is `N = max(1, ceil(L / S))`. Split bytes into consecutive `S`-byte fragments and zero-pad the last fragment. Empty input has one all-zero fragment and message length 0; one source frame completes its transfer. Every frame carries exactly `S` payload bytes, including empty and short messages. The decoder verifies zero padding before completing.

## Wire layout

All multibyte integers are unsigned, big-endian. Each frame has 24 bytes of overhead and no text encoding.

| Offset | Bytes | Meaning |
| --- | --- | --- |
| 0 | 2 | Magic: hexadecimal `4e 46` (ASCII `NF`) |
| 2 | 1 | Fountain format version: `01` |
| 3 | 1 | Reserved flags: `00`; other values are rejected |
| 4 | 4 | Sequence number, starting at 1 |
| 8 | 4 | Source fragment count `N` |
| 12 | 4 | Original message length `L`, excluding padding |
| 16 | 4 | CRC-32 of the original unpadded message |
| 20 | `S` | Encoded fragment bytes |
| `20 + S` | 4 | CRC-32 of all preceding frame bytes |

Both CRCs use CRC-32/ISO-HDLC: reflected polynomial `0xedb88320`, initial register `0xffffffff`, final XOR `0xffffffff`. The CRC of empty input is zero. Fragment size is inferred from the total frame length minus 24. Receivers reject unsupported versions and flags, sequence 0, inconsistent fragment count versus length/size, out-of-bound sizes, and incorrect frame checksums before allocating decoding equations.

The fountain format version is independent of the Cashu token version. There is no Cashu payload marker inside the core framing; arbitrary input bytes are preserved exactly.

## Deterministic fragment selection

Number source fragments from 0 through `N - 1`. Sequence numbers 1 through `N` select only fragment `sequence - 1`. Later sequences select a reproducible pseudo-random subset. Both sides run the following algorithm; all state assignments and bitwise operations have JavaScript 32-bit integer semantics. `imul` means multiplication modulo 2^32; `>>>` is unsigned right shift.

```text
state = sequence as uint32
for i = 0 .. N - 1:
    state = (state + 0x6d2b79f5) modulo 2^32
    word = imul(state XOR (state >>> 15), state OR 1)
    word = word XOR (word + imul(word XOR (word >>> 7), word OR 61))
    selected[i] = (word XOR (word >>> 14)) AND 1
if no fragment was selected:
    selected[(sequence - 1) modulo N] = 1
```

This is the integer output step of Mulberry32. The sequence alone seeds selection; the message CRC is used for integrity and message separation, not as an additional seed. The encoded payload is the bytewise XOR of the selected padded source fragments. Some repair frames are singletons or redundant; many combine multiple fragments. A receiver can join after the systematic frames and recover from repair frames alone, but no fixed number of repair frames guarantees full rank.

The reference reader incrementally reduces equations using GF(2) Gaussian elimination. With `N` independent equations it back-substitutes, verifies the original message CRC and padding, and exposes the unpadded bytes. Other implementations can use any solver that produces the same bytes from these equations.

## Independent wire vector

Message hexadecimal `010203`, fragment size 3, sequence 1, fragment count 1, message CRC `55bc801d`:

```text
4e46010000000001000000010000000355bc801d010203a3b35f2d
```

The final frame CRC is `a3b35f2d`. This vector was computed independently using Python `struct.pack('>IIII', ...)` and `zlib.crc32`, and is verified through the public encoder and decoder tests.

## Cashu mapping and inbound UR compatibility

`tokenToBytes` maps Cashu V4 text or a cashu-ts `Token` object to `UTF8("crawB") || CBOR`, which becomes the exact input message to this binary transport. It preserves CBOR when converting text. Cashu token version B is independent of fountain format version 1. The core itself has no knowledge of Cashu, CBOR, or base64.

UR decoding is a local adapter. It decodes minimal Bytewords with CRC-32, parses multipart CBOR metadata, and uses SHA-256-seeded Xoshiro256**, Walker-Vose degree sampling, and the specified removal-based shuffle to reproduce MUR fragment selection. Native `BigInt` supplies 64-bit arithmetic. The adapter shares the internal Gaussian solver with the binary reader; the binary wire format and its own fragment-selection algorithm are unchanged. The pinned `@gandlaf21/bc-ur@1.1.12` encoder is used only in development tests. It accepts complete single-part or multipart `ur:bytes` strings and unwraps a CBOR byte string. Supported Cashu payloads are UTF-8 `cashuB` text and `crawB` binary, both interpreted by `bytesToToken`/`bytesToTokenString`. Other UR types and non-byte CBOR payloads are rejected. These are the conventions tested against the reference encoder, not a claim about all NUT-16 wallets. The new binary frames are not UR-compatible output, and the package exposes no UR encoder.

The UR adapter bounds the wrapped message to 1 MiB, source count to 1024, each input to 131072 characters, and each session to 8192 distinct parts and 16 MiB cumulative fragment bytes. It ignores duplicate sequence numbers and mismatched transfer metadata. A failed reconstructed checksum or malformed reconstructed CBOR clears the session. A completed result is a defensive copy; `reset()` starts a new transfer. MUR fragment selection follows IEEE-754 operations in the specified order. Repair-only streams are tested against the reference encoder and independent URKit fixtures.

Source references: [Cashu binary tokens](https://github.com/cashubtc/nuts/blob/main/00.md#binary-token), [NUT-16](https://github.com/cashubtc/nuts/blob/main/16.md), [UR multipart specification](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2024-001-multipart-ur.md).
