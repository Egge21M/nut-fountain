# 04: Choose package license and enable publication deliberately

Status: resolved
Axis: Publication preflight
Reviewed commit: cdb04b955907ab364cbb2505996c525185258402

## Decisions needed before publication

The package still has private:true (package.json:4). That guard is expected for the current unpublished experiment and should change only during an authorized release. There is no project LICENSE or package license field. NOTICE.md explicitly applies only to third-party material and does not license the rest of the package. The owner must choose the project license; retain the third-party notice.

No publication or license selection was performed during review.

## Resolution

2026-10-05: Owner selected MIT with copyright (c) 2026 Egge21M. Added root and package licenses, retained third-party NOTICE, removed the library private flag, set 0.1.0-alpha.0 with public alpha publication defaults and repository metadata, and updated installation docs. Root workspace and playground remain private. Registry lookup returned 404 for nut-fountain; npm whoami returned ENEEDAUTH, so publication remains pending authentication.
