# Design: Rename the Application to PinSpec

## Approach

Treat the rename as a mechanical identity migration over tracked files, with no
behavioral change. The canonical mapping is:

| Former case form | New form | Applies to |
| :--- | :--- | :--- |
| lowercase | `pinspec` | lowercase identifiers, package name, URLs, paths, storage keys, format ids, temp prefixes, download stems, spec capability paths |
| uppercase | `PINSPEC` | exported constants, C include guards, exported macro prefixes |
| title case | `PinSpec` | type names, display strings, documentation titles, generated-code comments |

Replacement order is title case, then uppercase, then lowercase, so mixed-case
forms such as a project-file type name and a state-version constant resolve to
their new spellings without a second pass.

## Tracked content

The replacement is applied only to tracked files that contain the former name.
Gitignored directories (`.cache/`, `node_modules/`, `dist/`) are never edited;
`dist/` is regenerated only for the build check. No upstream source file is
modified.

Tracked paths containing the former name are renamed with `git mv`:

- The start-screen capability spec directory becomes
  `openspec/specs/pinspec-start-screen/`.
- Its archived change directory becomes
  `openspec/changes/archive/2026-11-25-pinspec-start-screen/`.
- Archived delta directories named for that capability follow the rename so
  spec ids and directory names stay consistent.

## Behavior preservation

- Hash routing, routes, solver logic, data generation, and exporter structure
  stay unchanged; only literal names change.
- The numeric state version stays 2. Only the exported format string changes.
- Pin configuration remains shareable; UI preferences remain in localStorage
  under the new prefix and are absent from share URLs and project files.
- `src/core/` gains no Svelte or DOM import. No dependency is added and no
  backend is introduced.

## Tests and static contracts

Tests are updated in place rather than removed. Assertions covering localStorage
keys, the C include guard, generated headers, the wordmark, the project format,
the base path, and documentation strings are changed to the new values. Temp
directory prefixes in data-gen tests are renamed for consistency.

## Verification

1. A case-insensitive search of tracked content for the former name returns no
   matches.
2. `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` pass
   without warnings.
3. `openspec validate rename-pinspec --strict` passes before implementation and
   `openspec validate --all --strict` passes after archive.
4. Archive the change with `openspec archive rename-pinspec -y`, correct the
   generated Purpose placeholder in the new spec, then commit and push.

## Repository rename

The GitHub repository name is changed by the repository owner outside this
repository. No CLI or API rename is attempted here.
