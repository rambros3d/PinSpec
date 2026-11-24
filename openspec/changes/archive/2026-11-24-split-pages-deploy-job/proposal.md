# Proposal

## Why

Every Pages run passes the build and upload steps, but `actions/deploy-pages@v4` then logs `Found 0 artifact(s)` even though the `github-pages` artifact exists, is unexpired, and is about 10 MB. Upstream issue actions/deploy-pages#451 identifies an intermittent metadata propagation race: deploy queries artifact metadata roughly 0.4 seconds after `Finalizing artifact upload`. Retrying the job and pinning the upload action version did not resolve it.

## What Changes

- Split the single `build-and-deploy` job into a `build` job and a `deploy` job whose `needs: build` gate forces artifact metadata to propagate before deployment starts.
- Keep source acquisition, generation and gates, tests, type checks, subpath build and smoke test, and the `upload-pages-artifact@v4` step in the `build` job.
- Move the `github-pages` environment binding and the `actions/deploy-pages@v4` step (id `deployment`) into the new `deploy` job on `ubuntu-latest`; remove them from the build job.
- Keep every trigger, permission, concurrency setting, artifact path, `BASE_PATH` value, and all other workflow behavior unchanged.
- Update the workflow contract tests to assert the two-job layout and to keep all existing behavior assertions passing.

## Capabilities

### New Capabilities

- `pages-deploy-job-separation`: The deployment workflow MUST finish the build job and artifact metadata propagation before the Pages deploy action runs, so a successful upload reliably results in a published site.

### Modified Capabilities

- None. `pages-deploy-compatibility` covers artifact client compatibility, and `ci-data-generation` covers build inputs and catalog generation. Neither capability's requirements change.

## Impact

- `.github/workflows/deploy.yml`: job structure changes from one job to two; step contents and settings are otherwise preserved.
- `tests/subpath-contracts.test.ts`: workflow structure assertions are extended for the two-job layout.
- No application source, generated data, dependencies, or runtime behavior change.
