# Proposal

## Why

Every recent Pages deployment passes all build and upload steps, but `actions/deploy-pages@v4` logs `Found 0 artifact(s)` and fails with `No artifacts named "github-pages" were found`, even though a valid unexpired artifact exists. The cause is a version mismatch: `actions/upload-pages-artifact@v5` writes artifacts with `actions/upload-artifact@v7.0.0`, while `deploy-pages@v4` discovers artifacts through the older `DefaultArtifactClient` twirp API. The two halves of the deploy pipeline must use a compatible artifact client so releases can complete.

## What Changes

- Pin `actions/upload-pages-artifact` to `@v4` in `.github/workflows/deploy.yml`, replacing `@v5`.
- Keep every other workflow behavior unchanged: triggers, permissions, concurrency, source acquisition, data generation and gates, unit tests, type checks, subpath build, subpath smoke test, and the deploy step itself.
- No application source, generated data, or dependency files change.

## Capabilities

### New Capabilities

- `pages-deploy-compatibility`: The Pages deployment workflow MUST produce an artifact that `deploy-pages@v4` can discover, so that a successful build and upload ends in a successful deployment.

### Modified Capabilities

- None. The existing `ci-data-generation` spec covers source acquisition and generation, not artifact handoff between the upload and deploy actions.

## Impact

- `.github/workflows/deploy.yml`: one action version reference changes.
- Effective artifact client changes from `actions/upload-artifact@v7.0.0` to `@v4.6.2`, matching the client `deploy-pages@v4` queries.
- Build inputs, generated artifacts, tests, checks, and the `/pinspec/` subpath build are unaffected.
