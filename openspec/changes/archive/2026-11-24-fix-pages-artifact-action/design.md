# Design

## Context

See proposal.md - Why for the failure and its root cause. The Pages workflow in `.github/workflows/deploy.yml` uploads `dist` with `actions/upload-pages-artifact@v5` and deploys with `actions/deploy-pages@v4`. Inspection of the action sources confirms:

- `upload-pages-artifact@v5/action.yml` runs `actions/upload-artifact@bbbca2ddaa5d8feaa63e36b76fdaad77386f024f # v7.0.0`.
- `upload-pages-artifact@v4/action.yml` runs `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2`.
- `deploy-pages@v4/src/internal/api-client.js` discovers artifacts through the older `DefaultArtifactClient.listArtifacts()` twirp endpoint, which matches the v4.6.2 client, not v7.

The RESTful artifact list shows a valid, unexpired `github-pages` artifact, so the failure is a client/API mismatch, not a missing or expired artifact.

## Goals / Non-Goals

**Goals:**

- Make the upload and deploy actions use compatible artifact clients so deployment completes.
- Keep the change minimal and auditable: one line in one file.

**Non-Goals:**

- Upgrading `deploy-pages` to a newer major version.
- Changing any build, test, generation, smoke-test, or deployment configuration.
- Modifying application code or generated data.

## Decisions

- **Pin upload-pages-artifact to `@v4` instead of upgrading deploy-pages.** v4 of the upload action pins `actions/upload-artifact@v4.6.2`, which is the client that `deploy-pages@v4` can discover. This is the smallest change that restores a known-good pairing. Alternative considered: bumping `deploy-pages` to a version that understands the v7 artifact API would be a larger change with unknown compatibility and is out of scope.
- **Leave all other workflow steps untouched.** The problem is isolated to artifact handoff; changing triggers, permissions, concurrency, or build steps would add risk without addressing the failure.

## Risks / Trade-offs

- [Risk] A future major bump of either action could reintroduce an incompatible pairing. Mitigation: the new spec records the compatibility contract, and workflow changes should be reviewed against it.
- [Trade-off] Staying on `upload-pages-artifact@v4` forgoes v5-only features such as `include-hidden-files`; the site does not need them, and hidden files are intentionally excluded by the current archive step.

## Migration Plan

1. Replace `actions/upload-pages-artifact@v5` with `@v4` in `.github/workflows/deploy.yml`.
2. Verify locally with `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build`.
3. Parse the workflow YAML to confirm the pinned version.
4. On merge, CI uploads with the v4.6.2 artifact client and `deploy-pages@v4` discovers the artifact.
5. Rollback: revert the single version reference to `@v5` if compatibility is restored by a different means.

## Open Questions

None.
