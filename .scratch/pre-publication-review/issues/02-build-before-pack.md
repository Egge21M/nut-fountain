# 02: Ensure release tarballs contain current build artifacts

Status: resolved
Severity: P1 for publication
Axis: Publication preflight
Reviewed commit: cdb04b955907ab364cbb2505996c525185258402
Location: packages/nut-fountain/package.json:55

## Finding

The package exports dist/*.js and dist/*.d.ts, but dist is untracked and no prepack or equivalent release guard builds/verifies artifacts. Packing a clean checkout succeeds with only NOTICE.md, README.md, docs/protocol.md and package.json. After private:true is intentionally removed for release, publishing that artifact would provide no working entry points. A manually built tarball does work.

## Evidence

Snapshot from git archive HEAD packages/nut-fountain in /tmp/nut-fountain-publication-review/clean. npm pack --dry-run --json lists four files and no dist. Saved output: /tmp/nut-fountain-publication-review/clean-pack.json. Built tarball has40 files; isolated production-only installation, runtime binary round trip, strict TypeScript Bundler resolution and browser bundle all pass.

## Acceptance

Add a release/pack lifecycle that builds or fails when artifacts are missing/stale. Test an actual tarball from a clean checkout and assert every exported JS/declaration path exists. Do not publish as part of this fix.

## Resolution

2026-10-05: Added prepack to rebuild JS/declarations. The clean-checkout test verifies 43 packed files including every export, installs only the tarball and production dependencies, and runs all six entry points in native Node and Chromium. The verified artifact contains no workspace-only files or development-only dependencies.
