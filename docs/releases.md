# Publishing releases

Publishing a GitHub release triggers [publish.yml](../.github/workflows/publish.yml). The workflow checks out that release's tag, verifies that it matches `packages/nut-fountain/package.json`, runs type checks and tests, and verifies a clean-checkout tarball in isolated Node, TypeScript and Chromium consumers. A separate job checks the tarball's SHA-512 integrity and publishes that exact artifact to npm using OIDC and provenance. No npm token secret is used.

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

1. Update the package version and its workspace entry in `bun.lock`, commit, and push.
2. Create and push an annotated tag named `v<package version>`, such as `v0.1.0-alpha.2`. The tagged commit must include the publishing workflow for automatic release-event publishing.
3. Create a GitHub release for that tag and publish it. Mark alpha, beta and rc versions as prereleases; mark stable versions as ordinary releases.
4. Check the **Publish npm package** workflow result and the version on npm.

Creating a draft release or pushing a tag alone does not publish the package. The workflow listens to `release.published`, which covers both stable releases and prereleases, including publication from drafts. See [GitHub's release event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#release).

Versions `X.Y.Z-alpha.N`, `X.Y.Z-beta.N` and `X.Y.Z-rc.N` publish under the npm dist-tags `alpha`, `beta` and `rc`, respectively. Stable `X.Y.Z` versions publish under `latest`. The GitHub release's prerelease setting must agree with the version. An already published npm version cannot be overwritten; use a new package version for new contents.

## Manual verification and recovery

The workflow also has a **Run workflow** action on `main`:

- Set **tag** to an existing version tag.
- Leave **publish** disabled to run all verification and upload the checked tarball without publishing. This does not require an npm login or a GitHub release.
- Enable **publish** only when a published GitHub release already exists for that tag. The same version, release and artifact checks run before publishing through OIDC.

The existing `v0.1.0-alpha.1` tag predates this workflow. After registering the trusted publisher, create its GitHub prerelease and use the manual action on `main` with that tag and **publish** enabled. This publishes the original tagged source without moving the tag. Subsequent tags containing the workflow publish automatically when their GitHub releases are published.
