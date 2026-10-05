# Implementation graph

Spec: [Package purpose](spec.md)

## Notes

Tickets 01, 02 and 03 are independent. Ticket 04 depends on all three. Implementation runs on integration/package-purpose; each ticket uses an isolated branch and worktree. Public test seams are the byte round trip, Cashu conversions, UR input and browser end-to-end round trips confirmed in the spec.

## Decisions so far

- [01 Byte core](issues/01-byte-core.md)
- [02 Cashu helpers](issues/02-cashu-helpers.md)
- [03 UR reader](issues/03-ur-reader.md)
- [04 Browser integration](issues/04-browser-integration.md)

- Resolved [02 Cashu helpers](issues/02-cashu-helpers.md): strict browser-native V4 and encoding helpers; merge `99e0bb3`, eight tests and typecheck passed.

- Resolved [03 UR reader](issues/03-ur-reader.md): bounded inbound single/multipart UR adapter; merge `846413a`, six tests, typecheck and browser-target bundle passed.

- Resolved [01 Byte core](issues/01-byte-core.md): versioned dependency-free binary transport and protocol document; merge `6314589`, combined 24 tests and typecheck passed.

- Resolved [04 Browser integration](issues/04-browser-integration.md): built package and real Chromium acceptance; merge `69a9b26`, 25 tests, typecheck and eight browser checks passed.

- Resolved [05 Review fixes](issues/05-review-fixes.md): owned byte boundaries and centralized wire layout; merge `34db42d`, exact tested-tree match, 28 tests and eight browser checks passed.

## Fog

No outstanding product questions or implementation tickets. API and wire details are documented in README.md and docs/protocol.md. The final review against main is recorded in review.md; both review axes have no outstanding findings.

## Review follow-up

- [05 Review fixes](issues/05-review-fixes.md) follows ticket 04: input ownership and wire-layout locality.
