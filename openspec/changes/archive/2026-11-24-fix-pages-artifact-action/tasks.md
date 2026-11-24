# Tasks

## 1. Restore compatible Pages artifact handoff

- [x] 1.1 Change `actions/upload-pages-artifact@v5` to `@v4` in `.github/workflows/deploy.yml` and update the matching version assertion in `tests/subpath-contracts.test.ts`, leaving all other workflow steps, triggers, permissions, concurrency, and the `deploy-pages@v4` step unchanged. Verify by parsing the workflow YAML to confirm `upload-pages-artifact@v4`, by confirming the v4 `action.yml` pins `actions/upload-artifact@v4.6.2`, and by running `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` successfully.

## Workflow follow-up

- Run `openspec archive fix-pages-artifact-action -y` after the task passes and all verification is green.
- Run `openspec validate --all --strict`, `openspec list --specs`, and `openspec list` to confirm the archived spec and no active changes.
