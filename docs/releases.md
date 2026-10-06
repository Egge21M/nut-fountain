# Publishing releases

Publishing a stable GitHub release triggers [publish.yml](../.github/workflows/publish.yml). The workflow checks out that release's tag, checks that the package has a stable `X.Y.Z` version matching the tag, runs type checks and tests, and verifies a clean-checkout tarball in isolated Node, TypeScript and Chromium consumers. A separate job checks the tarball's SHA-512 integrity and publishes that exact artifact to npm under `latest` using OIDC and provenance. No npm token secret is used.

## One-time npm configuration

In [nut-fountain's npm settings](https://www.npmjs.com/package/nut-fountain/access), add a GitHub Actions trusted publisher with these exact values:

| Field | Value |
| --- | --- |
| Organization or user | `Egge21M` |
| Repository | `nut-fountain` |
| Workflow filename | `publish.yml` |
| Environment name | Leave blank |
| Allowed action | Direct publishing with `npm publish` |

The workflow filename is case-sensitive and excludes `.github/workflows/`. The workflow uses GitHub-hosted runners, Node 24, npm >=11.5.1 and `id-token: write` in its publish job. See [npm's trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/) for the registration requirements.

## Release process

1. Update the package to a stable `X.Y.Z` version and update its workspace entry in `bun.lock`, commit, and push.
2. Create and push an annotated tag named `v<package version>`, such as `v0.1.0`. The tagged commit must include the publishing workflow.
3. Create a GitHub release for that tag and publish it as an ordinary release, with the prerelease option unchecked.
4. Check the **Publish npm package** workflow result and the version on npm.

Creating a draft release or pushing a tag alone does not publish the package. The workflow listens to `release.published` and skips prereleases. See [GitHub's release event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#release).

Only stable `X.Y.Z` package versions are supported; alpha, beta and rc packages cannot be published by this workflow. An already published npm version cannot be overwritten; use a new package version for new contents.
