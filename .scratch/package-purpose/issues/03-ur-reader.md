# 03: Existing UR input reader

Type: task
Status: claimed
Blocked by: None

Spec: [Package purpose](../spec.md)

## Scope and acceptance

Implement inbound UR compatibility in src/ur.ts: UrDecoder.receive(ur: string): boolean (useful/accepted), isComplete and result getters, reset(). Result is unwrapped payload bytes from a UR CBOR byte string, which may be cashuB UTF-8 or crawB binary. Accept complete single-part/multipart UR strings, uppercase, out-of-order/duplicate parts; validate type/payload/checksum and protect bounded resources. UR output is not a public package feature. Use @gandlaf21/bc-ur@1.1.12 for compatibility if feasible; avoid requiring callers to polyfill Buffer, process, require in a browser. Tell parent exact deps needed; do not modify package.json/bun.lock (ticket02 owns these). You may install dependencies in /tmp for local tests and use existing prototype node_modules. Own src/ur.ts, src/internal/ur/*, tests/ur.test.ts and UR-specific fixtures. Preserve attribution for any ported dependency code. Tests via public UR reader seam using independent reference-generated input; no assertions on private functions. Read /tmp/nut-fountain-research/ notes when ready.

## Workflow

Use the tdd skill at the public round-trip seams already agreed in the spec. Work on a dedicated branch/worktree based on integration/package-purpose. Merge the integration tip before reporting. Commit your changes and report tests plus commit. Parent resolves the ticket after integration.

## Comments

- Created from the agreed purpose and goals; implementation details are delegated within this scope.

- Claimed by the corresponding implementer on its isolated worktree.
