# Domain Docs

This repo uses a single-context layout: `GLOSSARY.md` at the repo root and architecture decision records in `docs/adr/`.

## Before exploring

- Read the root `GLOSSARY.md`.
- Read ADRs in `docs/adr/` that touch the area you are about to work in.

If these files do not exist, proceed silently. The `domain-modeling` skill creates them lazily when terms or decisions are resolved; their absence does not require scaffolding them upfront.

## Use the glossary's vocabulary

When naming a domain concept in an issue, proposal, hypothesis, or test, use the term defined in `GLOSSARY.md`.

If a concept is missing, check whether an existing term covers it. Note a genuine vocabulary gap for `domain-modeling`.

## Flag ADR conflicts

If a proposal contradicts an existing ADR, identify the ADR and explain why reopening the decision may be worthwhile before proceeding.
