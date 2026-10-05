# Local UR replacement review

Baseline: `da4ee37`. Reviewed implementation: `42406d5`.

## Standards

Reviewed `git diff da4ee37...HEAD` at `42406d5` against `AGENTS.md`, `docs/agents/*.md`, `GLOSSARY.md`, and the README/protocol contracts.

No documented-standard violations or actionable baseline smells found.

- The local tracker retains the documented per-feature spec and numbered-ticket layout. Domain terminology remains consistent with the glossary; no ADRs exist to conflict with.
- CRC and Gaussian elimination are shared through focused internal modules. Explicit byte copies preserve ownership across both readers. Each transport retains its own validation, message identity, coefficient selection and reset semantics.
- UR-only helpers isolate Bytewords and MUR fragment selection; native `BigInt` state arithmetic introduces no public types or platform globals. The PRNG's short state names are conventional algorithm notation, rather than a useful Mysterious Name finding.
- The public declaration files retain the existing API. Runtime imports use CBOR and SHA-256 dependencies; bc-ur moved to development dependencies. Browser validation audits the bundled consumer import graph for the removed runtime stack, and includes independent vectors and repair-only token transfers.
- Source attribution and a distribution notice accompany the local protocol material; `NOTICE.md` is included in package files.

This was a read-only diff, source and built-declaration review. The reported full test suite and browser checks were not rerun.

Findings: **0**.


## Spec

Reviewed `git diff da4ee37...HEAD` at `42406d5` against `.scratch/local-ur/spec.md` and its implementation ticket. **No findings.**

- **Missing or partial requirements:** None identified. Local minimal Bytewords/CRC validation, URI and CBOR parsing, native-BigInt Xoshiro256**, SHA-256 seeding, alias sampling, and removal-based fragment selection implement the requested decoder. The MUR seed byte order, floating-point operation order, alias-table ordering, and shuffle agree with the saved primary specification. Published URKit vectors and 54 reference-transfer variants exercise the public reader; Chromium scenarios cover both Cashu payload conventions, including repair-only transfers.
- **Scope creep:** None identified. Extracting CRC-32 and Gaussian elimination satisfies “share the Gaussian solver where useful.” The diff leaves binary framing and its independent coefficient algorithm unchanged. It adds no public UR encoder or internal-helper exports.
- **Implemented incorrectly:** None identified. The previous limits remain enforced before solver work, duplicate/foreign parts are rejected, invalid individual input retains active progress, and completed checksum/CBOR failures reset state. Buffer isolation remains preserved in the shared solver. The reference package is pinned under devDependencies; source and built runtime entry points contain no imports of its Buffer/JSBI/BigNumber/alias-sampling stack.

Validation reviewed: public tests and browser harness, documented 86 passing tests/199 assertions, 12 Chromium scenarios, and the parent's production-only install/browser-build check. No full-suite rerun was needed for this read-only review.

Total: **0 spec findings.**


Summary: Standards — 0 findings; Spec — 0 findings. No outstanding issues on either axis.
