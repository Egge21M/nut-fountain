# NUT-16 PR #456 versus the current nut-fountain protocol

Research checked 2026-10-06 against PR head `ef77c9c33f52042835c828fcaad66a17b74cadb3` and the current local working tree, including the 1024-fragment revision. This is a comparison note, not a proposed specification or implementation change. Sources are the [pinned PR draft][pr], [pinned PR vectors][vectors], [local protocol][protocol], and implementation files cited below.

## Conclusion

The PR describes a different, incompatible binary transport: `CFP1` framing with Multipart UR fragment selection. The current binary transport uses `NF` plus a numeric version and flags, and an independent dense selection algorithm. Updating only the fragment limit or magic would not reconcile them. Several other differences are deliberate scope choices: the PR specifies a Cashu-over-QR application profile, whereas the local specification defines a transport for arbitrary bytes. [Sources: PR frame layout, fragment selection, message and QR sections][pr]; [local sections 1–4][protocol].

## Wire and algorithm differences

| Subject | PR #456 | Current local specification and implementation | Consequence |
| --- | --- | --- | --- |
| First four bytes | ASCII `CFP1`, hex `43 46 50 31` | ASCII `NF`, version byte `01`, reserved flags byte `00`: `4e 46 01 00` | Every PR frame fails the current binary parser. Both the leading marker and version/flags description must change. |
| Version dispatch | Dispatch by `CFP1`; unknown `CFP` versions cannot be interpreted as version 1 | Binary router recognizes `NF`; parser then requires version 1 and zero flags | Router requirements must describe the new prefix and numeric version/flags. |
| Repair selection | Multipart UR consensus stack: seed `uint32_be(sequence) || uint32_be(messageCRC)`, SHA-256, Xoshiro256**, `1/d` degree weights, alias sampling, specified shuffle | Dense per-fragment coefficient bits computed using the exact 32-bit arithmetic in `SELECT(q,N)`; sequence-only seed; all-zero fallback selects `(q-1) mod N` | This changes which fragments are XORed, not just the frame envelope. The message CRC no longer seeds binary selection. |
| Algorithm dependency | Normative dependency on pinned MUR guide | Normative self-contained integer pseudocode | MUR is relevant to the optional inbound UR adapter, not the binary protocol. |
| Source count | 1–4096 | 1–1024 | PR's advertised maximum is four times the current limit, despite the local increase from 256. |
| Payload size | 1–1,048,576 bytes | 1–4096 bytes | Maximum frame length changes from 1,048,600 to 4120 bytes. |
| Message length | 1–1,048,576 bytes | 0–1,048,576 bytes | Maximum is unchanged; empty messages are now valid at the transport layer. |

Sources for the table: [PR frame layout, selection and receiver constraints][pr]; [local protocol sections 2–6][protocol]; [wire parser][wire]; [binary coefficients][equations]; [automatic routing][auto]; [separate UR selection][ur-selection]. The PR allows receivers to enforce lower resource limits, so a 1024-count or 4096-byte cap could be a PR implementation restriction in isolation; the current specification instead defines these as the version-1 interoperability bounds. Neither observation makes the two binary formats compatible.

For the PR's `padded-multipart` vector (`N=4`, message CRC `2c183a19`), actual selected indexes differ as follows. Index ordering is immaterial for XOR. [PR vector source][vectors]; [current selection source][equations].

| Sequence | PR indexes | Current indexes |
| --- | --- | --- |
| 5 | `[0]` | `[1,3]` |
| 6 | `[0,3]` | `[0,2,3]` |
| 7 | `[1,0,2]` | `[2]` |
| 8 | `[2]` | `[0,1,2,3]` |

The first `N` systematic selections still agree when fragmentation agrees. Every frame CRC nevertheless changes with the prefix, and repair payloads generally change with the selector. These differences were checked against the PR JSON and by executing the local coefficient function. [Sources][vectors], [equations][equations].

## Fragmentation, padding and sequences

**Fragment-size selection differs.** The PR takes a maximum QR fragment capacity `C`, calculates `N=ceil(L/C)`, and balances actual fragment length to `F=ceil(L/N)`. The local protocol takes an actual fragment size `S` directly and calculates `N=max(1,ceil(L/S))`; the encoder uses the requested size exactly, defaulting to 128. For the PR's 162-byte synthetic token and maximum size 64, the PR emits three 54-byte fragments. `FountainEncoder(message,{fragmentSize:64})` emits three 64-byte fragments, with 30 zero tail bytes. A local sender can explicitly choose 54, so this is a sender policy/API difference, not an unavoidable wire-layout incompatibility. For nonempty messages, the PR receiver inequality `(N-1)*F < L <= N*F` is equivalent to the local count calculation; it does not itself force balanced sizing. [PR fragmentation and receiver sections][pr]; [local section 2][protocol]; [encoder][core]; [synthetic token vector][vectors].

**Empty transfer semantics are added locally.** `L=0`, `N=1`, any allowed fragment size, message CRC zero, and an all-zero payload form a valid transfer. PR #456 forbids `L=0`. This belongs to the generic byte transport; it does not imply an empty Cashu token is valid. [Local sections 2 and 5][protocol]; [PR bounds/message requirements][pr].

**Receiver padding validation is stronger locally.** Both senders must zero-pad source fragments, and both message CRCs exclude padding. The PR receiver truncates to `L` and checks that CRC; it does not explicitly require checking discarded tail bytes. The local receiver must additionally verify every recovered byte from `L` to `N*S` is zero. Thus a valid-message-CRC transfer with nonzero recovered padding fails locally. [PR fragmentation and receiver sections][pr]; [local section 6][protocol]; [decoder checksum/padding check][core].

**Sequence generation is stricter locally.** Both use nonzero uint32 sequences, systematic frames for `1..N`, and permit repeated/lost/reordered frames. PR senders only SHOULD send systematic frames first and increasing sequences thereafter; the local sender must start at 1 and increment by one per newly generated frame. Repeating an already generated frame remains allowed. The PR explicitly permits stop or restart at 1 on exhaustion and repeating the first one-fragment frame. The local encoder throws after `0xffffffff`; a new encoder restarts at 1. Both prohibit wrapping to zero. [PR fragment selection][pr]; [local section 2][protocol]; [encoder][core].

**Transfer identity remains equivalent.** The PR tuple `(N,L,H,F)` and local `(N,L,S,C)` carry the same four concepts with different variable names. Both prohibit mixing tuples and hold dimensions/checksum constant. The PR says the first accepted frame establishes the tuple and malformed input cannot change it. Local API behavior likewise validates first and commits metadata only on an independent equation; a foreign tuple throws until reset. The protocol leaves switching versus concurrent-session policies to applications. [PR receiver behavior][pr]; [local section 6][protocol]; [decoder][core].

## Cashu and QR profile versus generic transport

**Message requirements are a scope difference.** The PR mandates exactly `UTF8("crawB") || CBOR(V4 token)`, byte-preserving conversion from `cashuB`, no URI/base64/UR wrapper in the binary message, and token validation after fountain reconstruction. The local binary protocol treats the message as opaque and has no token-version restriction. Its Cashu helpers already implement byte-preserving `cashuB` to `crawB` conversion and V4 parsing, but using them is a separate application step. A core decoder can successfully return arbitrary bytes. The helper also accepts recovered UTF-8 `cashuB` bytes, which is useful for UR compatibility but broader than the PR's binary-message profile. Retaining the PR's Cashu requirements as an application profile is compatible with adopting the current transport. [PR message/receiver sections][pr]; [local scope][protocol]; [Cashu helpers][cashu]; [implementation guide][implementation].

**Static QR and fallback policies are absent from the binary specification.** PR #456 permits a fitting text token as static QR, permits the first one-fragment fountain frame as static QR, recommends binary send/receive support and retaining/offering UR fallback, and recommends uppercase UR text. The local binary protocol prescribes none of these presentation/compatibility policies. The package has an inbound UR decoder but no UR encoder. Its `AutoDecoder` routes NF byte frames and UR strings, but does not route bare text tokens; callers must use their token parser separately. There is no automatic negotiation in either protocol. [PR static/compatibility sections][pr]; [local scope and transport considerations][protocol]; [router][auto]; [implementation guide inbound UR][implementation].

**QR requirements are additional PR profile constraints.** The PR requires exactly one byte segment per binary QR symbol, prohibits ECI/FNC1/structured append/additional segments, mandates original byte payload extraction, and discusses QR capacity selection. QR encoding and scanning are explicitly outside the local binary specification. The playground's sender does produce a single byte segment at error-correction level M, and the reader uses `jsQR.binaryData` to preserve bytes, so the basic encoding approach agrees. However, the reader does not inspect segments/control modes to enforce the PR's rejection requirements. The core supports any transport preserving complete frame boundaries, not just QR. [PR QR encoding][pr]; [local scope/layout][protocol]; [QR sender][qr]; [QR reader][qr-decode].

**QR adaptation and scheduling differ in scope, not conflicting bytes.** Both hold fragment dimensions fixed within a transfer. The PR expresses this as restarting if QR capacity changes, and permits choices of QR version/mask/error correction/rate. The local protocol leaves transport adaptation, rate, stopping, feedback and timeouts outside its remit. Neither has an acknowledgement/end marker on the fountain wire. [PR QR/receiver sections][pr]; [local sections 4 and 8][protocol].

## Additional receiver and resource behavior

**Inconsistent dependent equations are an actual implementation mismatch with the PR.** PR #456 says inconsistent equations MUST NOT produce a successful transfer. The current shared Gaussian solver reduces an incoming equation and returns `undefined` whenever all coefficients disappear, without checking whether its remaining payload is nonzero. Such a contradictory equation is ignored; a later valid frame can complete the message. This is distinct from a frame CRC failure or reconstructed-message checksum failure, which are rejected. The current local protocol does not separately state the PR's blanket inconsistency-fails-success rule. [PR receiver behavior][pr]; [solver][solver]; [decoder][core]; [local receiver requirements][protocol].

Reproduction executed using the current code: encode `[1,2]` with fragment size 1; receive correct sequence 1; receive a copy of sequence 1 with payload changed to 9 and its frame CRC recomputed; receive correct sequence 2. `receive()` results are `[true,false,true]`, `isComplete` is `true`, and the result is `[1,2]`. Therefore the output message is correct in this example, but the contradictory received equation does not poison or reset the transfer. [Executable behavior explained by solver][solver] and [decoder][core].

**Failure recovery is less prescribed locally.** The PR SHOULD discard a failed transfer and permit restart. Local protocol leaves equation retention and reset policy unspecified; implementation discards the last independent pivot if final CRC/padding checks fail and throws, retaining previous state until caller reset. Token validation happens afterward in the helpers. [PR receiver behavior][pr]; [local section 6][protocol]; [decoder][core]; [Cashu helpers][cashu].

**Security/resource language is broader in the PR.** Both warn CRC32 is not authentication or a unique transfer identity. The PR additionally requires bounded memory, decoding work and active sessions, safe dimension arithmetic before metadata-driven allocation, clean failure for stricter resource limits, and recommends cancellation/expiry. The current binary specification enforces dimension bounds but leaves session/time/work policies to implementations/applications. Its one-session decoder validates frame metadata before solver allocation, but has no built-in timeout or cumulative work limit. These can remain application requirements in NUT-16 rather than changing the core format. [PR receiver/security sections][pr]; [local sections 6 and 8][protocol]; [wire parser][wire]; [decoder][core].

## Vectors and claims requiring an update

- Every valid PR frame vector needs the new four-byte prefix and recomputed frame CRC. Repair selections and payloads must be regenerated with the binary selector; systematic payloads only need changing if fragmentation policy changes. The existing PR vectors cannot serve as current binary interoperability vectors. [PR vectors][vectors]; [current vectors and selector][protocol].
- Unknown-version vectors need the new numeric version byte; flags need explicit coverage. Count boundaries should test 1024/1025 rather than only the PR's 4096/4097 range; fragment boundaries should test 4096/4097; message maximum stays 1 MiB. PR's current over-count vector also violates its count/length relationship, so it does not isolate the count bound. [PR invalid vectors][vectors]; [wire constraints][wire].
- Replace the categorical rejection of zero-length messages with positive valid-empty vectors and negative nonzero-empty-padding/wrong-checksum vectors. Merely relabeling the PR's existing `message-length-zero` frame as valid would be wrong: its nonzero message CRC/payload do not describe a valid empty transfer. Add explicit recovered-padding failure vectors. [PR invalid vectors][vectors]; [local empty and receiver rules][protocol].
- Keep `framing-only` versus `token` distinctions: arbitrary-byte vectors are valid core inputs but not necessarily Cashu tokens. The PR's synthetic token is nonspendable and must remain labeled accordingly. [PR test-vector section][pr]; [local scope][protocol].
- The PR's approximately 50% fewer frames versus text-token MUR claim is not established for the current selector by the local documentation. The implementation guide gives framing overhead and complexity, explicitly without claiming a measured UR comparison. The changed repair distribution means any numerical efficiency claim should be measured for the specified loss/QR scenarios or qualified; this comparison does not show the claim false. [PR motivation][pr]; [implementation costs][implementation].

## What agrees

The 24-byte overhead; uint32 big-endian sequence/count/length/message CRC fields at offsets 4/8/12/16; payload at 20; trailing four-byte frame CRC; CRC-32/ISO-HDLC parameters and checksum coverage; uint32 sequence range; systematic source-fragment ordering; bytewise XOR payloads; zero-padding by senders; transfer-tuple isolation; reordered/lost/duplicate frame tolerance; independence rather than frame-count completion; message CRC after reconstruction; algorithm-independent decoder choice; and absence of acknowledgements all agree. The current dense Gaussian solver itself need not be standardized. [PR encoding and receiver sections][pr]; [local protocol sections 2–8][protocol].

[pr]: https://github.com/Egge21M/nuts/blob/ef77c9c33f52042835c828fcaad66a17b74cadb3/16.md
[vectors]: https://github.com/Egge21M/nuts/blob/ef77c9c33f52042835c828fcaad66a17b74cadb3/tests/16-vectors.json
[protocol]: ../../packages/nut-fountain/docs/protocol.md
[implementation]: ../../packages/nut-fountain/docs/implementation.md
[wire]: ../../packages/nut-fountain/src/internal/core/wire.ts
[equations]: ../../packages/nut-fountain/src/internal/core/equations.ts
[core]: ../../packages/nut-fountain/src/core.ts
[auto]: ../../packages/nut-fountain/src/auto.ts
[cashu]: ../../packages/nut-fountain/src/cashu.ts
[ur-selection]: ../../packages/nut-fountain/src/internal/ur/fragments.ts
[solver]: ../../packages/nut-fountain/src/internal/fountain.ts
[qr]: ../../apps/playground/src/qr.ts
[qr-decode]: ../../apps/playground/src/qrDecode.ts
