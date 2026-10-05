# 03: Decide whether to support TypeScript NodeNext resolution

Status: needs-triage
Severity: P3
Axis: Standards portability note; not a documented rule violation
Reviewed commit: cdb04b955907ab364cbb2505996c525185258402
Location: packages/nut-fountain/src/index.ts:1

## Finding

The five extensionless relative root exports are preserved in dist/index.d.ts. A consumer with module/moduleResolution NodeNext and skipLibCheck:false receives five TS2835 errors. Bundler resolution passes, which satisfies the currently documented browser-bundler target. Consider explicit .js specifiers and a consumer regression before expanding compatibility claims.
