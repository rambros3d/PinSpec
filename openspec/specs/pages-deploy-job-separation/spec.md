# pages-deploy-job-separation Specification

## Purpose

Defines the job boundary in the GitHub Pages deployment workflow so the deploy action starts only after the build job has finished and its uploaded artifact metadata has fully propagated.

## Requirements

### Requirement: Build and deploy run in separate jobs

The deployment workflow SHALL perform the site build and artifact upload in a `build` job and the Pages publication in a separate `deploy` job that declares `needs: build`.

#### Scenario: Upload completes before deploy starts

- **WHEN** the workflow is triggered by a push to `main`, manual dispatch, or the weekly schedule
- **THEN** the `deploy` job starts only after the `build` job has succeeded and the uploaded artifact is registered

#### Scenario: Build failure blocks deployment

- **WHEN** any step in the `build` job fails
- **THEN** the `deploy` job is skipped and no deployment is attempted

### Requirement: Deploy job owns the Pages environment and deploy action

The `deploy` job SHALL run on `ubuntu-latest`, bind the `github-pages` environment with the URL from its `deployment` step, and contain the single `actions/deploy-pages@v4` step with id `deployment`. The `build` job SHALL NOT contain that environment binding or deploy step.

#### Scenario: Deployment URL is reported

- **WHEN** the deploy step completes successfully
- **THEN** the Pages environment URL resolves from `steps.deployment.outputs.page_url` and the published artifact is the `dist` directory uploaded by the `build` job

#### Scenario: Deploy action appears once

- **WHEN** the workflow YAML is parsed
- **THEN** exactly one `actions/deploy-pages@v4` step exists and it belongs to the `deploy` job

### Requirement: Workflow behavior outside the job boundary is preserved

The job separation SHALL preserve all triggers, permissions, concurrency settings, checkout and tool setup, source acquisition, generation gates, tests, type checks, subpath build and smoke checks, `BASE_PATH` handling, artifact name and path, and deploy step configuration.

#### Scenario: Existing workflow contracts still pass

- **WHEN** the workflow contract tests and the local verification suite run against the two-job workflow
- **THEN** all assertions for triggers, weekly source refresh, provenance recording, generation-before-tests ordering, subpath smoke checks, and artifact actions pass

#### Scenario: Deploy metadata race is removed by job ordering

- **WHEN** the `build` job has completed and uploaded the `github-pages` artifact
- **THEN** the `deploy` job queries fully propagated artifact metadata instead of the in-job metadata queried shortly after upload finalization
