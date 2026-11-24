# Design

## Context

See `proposal.md` for motivation. `.github/workflows/deploy.yml` currently has one job, `build-and-deploy`, which performs the entire pipeline including `actions/upload-pages-artifact@v4` followed immediately by `actions/deploy-pages@v4` with id `deployment`. The `github-pages` environment and its URL are attached to that job. `tests/subpath-contracts.test.ts` reads the raw workflow text and asserts triggers, action versions, step ordering, and smoke-check content. No YAML parser is a declared project dependency, so contract tests stay text/indentation based.

## Goals / Non-Goals

**Goals:**

- Give artifact metadata time to propagate by making deployment a separate downstream job.
- Keep the observable workflow contract identical apart from job structure.
- Keep contract tests meaningful for the new layout.

**Non-Goals:**

- Changing action versions, artifact names, paths, permissions, or concurrency.
- Adding waits, retries, or polling inside the existing job.
- Changing the generated site, tests, or local verification commands.

## Decisions

- **Two jobs with `needs: build` instead of an in-job delay or retry.** A job boundary is the standard fix documented for actions/deploy-pages#451: the deploy job cannot start until the build job concludes, so artifact registration is complete. Alternatives (sleep, retries, job-level re-run) either add fixed latency without a propagation guarantee or had already failed in practice.
- **Move only the environment binding and deploy step.** The `build` job keeps all existing steps verbatim, including `upload-pages-artifact@v4` with `path: dist`. The `deploy` job contains exactly one step, `Deploy to GitHub Pages`, with id `deployment` and `uses: actions/deploy-pages@v4`.
- **Keep workflow-level permissions and concurrency.** Both jobs inherit `contents: read`, `pages: write`, `id-token: write` and the `pages` concurrency group; duplicating them per job would change settings without adding value.
- **Update contract tests structurally, not by loosening them.** Existing assertions remain; new assertions parse the two-space-indented job headings into blocks and verify `needs: build`, `runs-on: ubuntu-latest`, the environment URL, and that `deploy-pages@v4` appears only in the deploy block. This avoids adding a YAML dependency.

## Risks / Trade-offs

- [Deploy job loses build logs context] -> GitHub retains the separate build job logs and the `needs` relationship makes the dependency explicit.
- [Workflow-level permissions are broader for build] -> Kept as-is to preserve the current contract; no extra permissions are introduced.
- [Text-based test assertions are indentation sensitive] -> Tests assert exact job block headings used by the workflow, and the full suite plus YAML parse verification guard the structure.

## Migration Plan

1. Edit the workflow to rename the single job to `build`, remove its environment and deploy step, and add the `deploy` job after it.
2. Update the workflow contract tests for the two-job layout while keeping all prior behavior assertions.
3. Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build`, then parse the YAML to confirm the structure.
4. Archive the OpenSpec change; the next Pages run consumes the new workflow.

Rollback: restore the previous single-job workflow and test assertions from git if the two-job split causes an unexpected failure.
