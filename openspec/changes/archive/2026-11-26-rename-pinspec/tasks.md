# Tasks

## 1. Application and configuration identity

- [x] 1.1 Rename package metadata, document title, and display strings: `package.json`, `package-lock.json`, `index.html`, `metadata.json`, and `src/components/shell/GlobalTopBar.svelte` use `pinspec` / `PinSpec`; verify no former-name match remains in these files
- [x] 1.2 Update external repository and site URLs to `https://github.com/rambros3d/pinspec` and `https://rambros3d.github.io/pinspec/` wherever tracked
- [x] 1.3 Change the GitHub Pages base path to `/pinspec/` in `.github/workflows/deploy.yml`, docs, specs, and verification commands, including cache keys, smoke-check directories, and download file names; keep hash routing and `import.meta.env.BASE_URL` resolution unchanged

## 2. Core identifiers, persistence, and exporters

- [x] 2.1 Rename the state-version constant to `PINSPEC_STATE_VERSION`, the project-file type to `PinSpecProjectFile`, and the project format id to `pinspec-pinout` in `src/core/types.ts`, `src/core/url-state.ts`, and `src/core/exporters/json.ts`; keep numeric version 2 and the no-v1-import rule
- [x] 2.2 Rename C header guard, macro, and generated-comment prefixes to `PINSPEC` / `PinSpec` in `src/core/exporters/c-header.ts`, `src/core/exporters/embassy-rust.ts`, `src/core/importers/ioc.ts`, and `src/core/data-url.ts`; confirm `src/core/` still has zero Svelte or DOM imports
- [x] 2.3 Rename all localStorage key prefixes to `pinspec:` across `src/state/*.svelte.ts` and the `index.html` theme bootstrap; confirm no UI preference enters share URLs or project files

## 3. Documentation, specs, and tests

- [x] 3.1 Update `README.md`, `AGENTS.md`, active specs, and all archived change artifacts so no former-name occurrence remains
- [x] 3.2 Rename tracked paths containing the former identity with `git mv`: the start-screen capability spec directory, its archived delta directories, and the archived change directory
- [x] 3.3 Update all test fixtures and assertions deliberately, including storage keys, include guards, wordmark checks, format ids, URLs, base paths, and temp prefixes; no coverage is deleted
- [x] 3.4 Run a case-insensitive tracked-content search for the former name and confirm zero matches with no intentional exception

## 4. Verification and closeout

- [x] 4.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build`; all pass with zero warnings and no new dependency or backend
- [x] 4.2 Run `openspec validate rename-pinspec --strict` and confirm it passes
- [x] 4.3 After verification, run `openspec archive rename-pinspec -y`, replace the archived spec Purpose placeholder with a concrete description, run `openspec validate --all --strict`, confirm no active changes remain, commit including archive artifacts, push, and verify `git status --short` is clean and `git log -1 --oneline` shows the rename commit
