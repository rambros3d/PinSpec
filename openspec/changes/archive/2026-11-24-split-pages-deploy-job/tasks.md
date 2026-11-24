# Tasks

## 1. Split the Pages deployment workflow into two jobs

- [x] 1.1 Rewrite `.github/workflows/deploy.yml` so the existing pipeline is in a `build` job (no `environment`, no deploy step) followed by a `deploy` job with `needs: build`, `runs-on: ubuntu-latest`, the `github-pages` environment and `steps.deployment.outputs.page_url`, containing only the `Deploy to GitHub Pages` step with `id: deployment` and `actions/deploy-pages@v4`; verify triggers, permissions, concurrency group, all build steps, artifact path, and `BASE_PATH` handling remain unchanged.

## 2. Update workflow contract tests

- [x] 2.1 Extend `tests/subpath-contracts.test.ts` with structure-aware assertions that parse the two job blocks and confirm `build` and `deploy` exist, `deploy` declares `needs: build`, the environment URL lives in the deploy job, `actions/deploy-pages@v4` appears only in the deploy job, and `actions/upload-pages-artifact@v4` appears only in the build job, while keeping every pre-existing trigger, provenance, ordering, and smoke-check assertion; verify with `npm test`.

## 3. Verify and close out

- [x] 3.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` successfully, and parse the workflow YAML to confirm two jobs, `needs: build`, and `actions/deploy-pages@v4` only in the `deploy` job.

## Workflow follow-up

- Run `openspec archive split-pages-deploy-job -y` after all tasks pass and verification is green.
- Run `openspec validate --all --strict`, `openspec list --specs`, and `openspec list` to confirm the archived spec and the change inventory.
- Leave all changes uncommitted and unpushed.
