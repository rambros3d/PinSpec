# pages-deploy-compatibility Specification

## Purpose

Defines the contract between the workflow that uploads the static site and the action that deploys it to GitHub Pages, so a successful build and upload reliably results in a published site.

## Requirements

### Requirement: Compatible Pages artifact handoff

The deployment workflow SHALL upload the built site using an action whose underlying artifact client can be discovered by the configured `actions/deploy-pages` version. A successful build and upload MUST result in the `github-pages` artifact being found and deployed, rather than a `Found 0 artifact(s)` failure.

#### Scenario: Successful deploy after build and upload

- **WHEN** the Pages workflow completes its build and upload steps for a push to `main`, manual dispatch, or the weekly schedule
- **THEN** the deploy step finds the `github-pages` artifact and publishes the site without a `No artifacts named "github-pages" were found` error

#### Scenario: Artifact client compatibility

- **WHEN** the upload action writes the `github-pages` artifact
- **THEN** it does so through an `actions/upload-artifact` version compatible with the artifact discovery API used by the pinned `actions/deploy-pages` version

### Requirement: Unchanged deployment workflow behavior

The compatibility fix MUST NOT alter the workflow's triggers, permissions, concurrency settings, source acquisition, catalog generation and gates, unit tests, type checks, subpath build, subpath smoke test, or the deploy step configuration.

#### Scenario: Workflow behavior preserved

- **WHEN** the workflow file is compared with its pre-fix state
- **THEN** the only behavioral change is the upload action version reference, with all other steps, triggers, and settings identical
