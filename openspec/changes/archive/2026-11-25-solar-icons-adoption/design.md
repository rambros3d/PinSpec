# Design

## Context

See `proposal.md` for motivation. The current UI imports 49 distinct glyph
names from `lucide-svelte` in 21 Svelte files. `package.json` also lists
`lucide-react`, but no source file imports it; that dependency is out of scope
and remains untouched. All affected icons are decorative: accessible names live
on parent controls through `title` or `aria-label`, and click handlers live on
those controls.

The target package exposes per-icon default exports through the exports map
`./bold-duotone/*`, for example
`@solar-icons/svelte/bold-duotone/magnifier`. Its base component renders
`class="solar solar-<slug>-bold-duotone"`, sets `aria-hidden="true"` when the
icon itself has no `alt`, `aria-label`, or `title`, and reads CSS variables
`--solar-color`, `--solar-size`, `--solar-secondary-color`, and
`--solar-secondary-opacity`. At planning time the registry reported version
2.7.0; implementation must verify the installed version and every slug before
editing imports.

Source hygiene tests forbid raw color literals outside
`src/themes/daisyui.css`, forbid emoji, and require zero Svelte build warnings.
The two package renderers own all SVG pin geometry and `feTurbulence` filters;
they are not icon surfaces.

## Goals / Non-Goals

**Goals:**

- Swap the icon dependency and remove every `lucide-svelte` import.
- Replace each glyph with a verified bold duotone icon without changing sizes,
  accessible names, or interaction behavior.
- Keep icon colors tied to existing theme tokens, including the duotone
  secondary layer.
- Add factual license attribution and update static tests to the new contract.
- Complete the full verification sequence and archive the change.

**Non-Goals:**

- No change to hash routing, workspace state, share URLs, project JSON,
  exporters, solver, data generation, or STM32 behavior.
- No change to `public/radiokit-logo.svg`, the favicon reference in
  `index.html`, or the `PerimeterPackage.svelte` and `GridPackage.svelte`
  geometry, labels, and textures.
- No removal of the unused `lucide-react`, React, or motion dependencies.
- No new shared icon wrapper component, no runtime icon loader, and no backend.

## Decisions

### Decision 1: Per-icon default imports with preserved local names

Import each icon from its own module path and alias the default export to the
name already used in the component, for example:

```ts
import Search from '@solar-icons/svelte/bold-duotone/magnifier';
import Plus from '@solar-icons/svelte/bold-duotone/add';
```

This keeps component markup, dynamic icon selection, and existing static tests
stable while the package path carries the Solar identity. Barrel-style named
imports were considered and rejected because the user-facing package
documentation specifies the per-icon path and tree shaking is clearer.

Unused imports are deleted, not mapped. `RefreshCw` in
`src/pages/LandingPage.svelte` has no rendering use.

### Decision 2: Verified mapping table

The mapping below is the implementation source of truth. Every slug in the
right column was checked against the published package exports. Implementation
must repeat that check against `node_modules` after `npm install` and must not
substitute a guessed name.

| Current name | Solar bold duotone slug | Rationale |
|---|---|---|
| `AlertCircle` | `danger-circle` | Error state in a circle |
| `AlertTriangle` | `danger-triangle` | Warning state in a triangle |
| `ArrowLeftRight` | `transfer-horizontal` | Remap and swap action |
| `ArrowRight` | `arrow-right` | Direct equivalent |
| `ArrowUpDown` | `sort-vertical` | Sort indicator on the position column |
| `Check` | `check` | Direct equivalent |
| `CheckCircle2` | `check-circle` | Success state |
| `ChevronDown` | `alt-arrow-down` | Catalogue chevron-style down arrow |
| `ChevronRight` | `alt-arrow-right` | Catalogue chevron-style right arrow |
| `CircuitBoard` | `cpu` | Closest board/compute symbol; no circuit-board slug exists |
| `Clock` | `clock-circle` | Direct equivalent in a circle |
| `Copy` | `copy` | Direct equivalent |
| `Cpu` | `cpu` | Direct equivalent; may duplicate `CircuitBoard` |
| `Crosshair` | `target` | Closest crosshair/target symbol |
| `Database` | `database` | Direct equivalent |
| `Download` | `download` | Direct equivalent |
| `FileUp` | `import` | File import action |
| `FolderOpen` | `folder-open` | Direct equivalent |
| `GitCompare` | `git-diff` | Closest comparison symbol |
| `Home` | `home` | Direct equivalent |
| `Info` | `info-circle` | Information in a circle |
| `Keyboard` | `keyboard` | Direct equivalent |
| `LayoutGrid` | `grid-2x2` | Catalogue grid symbol |
| `Lock` | `lock` | Direct equivalent |
| `Maximize2` | `maximize-square` | Fit/expand action |
| `Minus` | `minus` | Direct equivalent |
| `Monitor` | `monitor` | Direct equivalent |
| `Moon` | `moon` | Direct equivalent |
| `Orbit` | `planet` | Closest orbit symbol; no orbit slug exists |
| `PanelLeftClose` | `panel-left-close` | Direct equivalent |
| `PanelLeftOpen` | `panel-left-open` | Direct equivalent |
| `PanelRight` | `panel-right` | Direct equivalent |
| `Pencil` | `pen` | Catalogue edit symbol |
| `Plus` | `add` | Catalogue add symbol |
| `Redo2` | `undo-right` | Catalogue redo direction |
| `RefreshCw` | none | Unused import; delete it |
| `RotateCw` | `rotate-clockwise` | Direct equivalent |
| `Search` | `magnifier` | Catalogue search symbol |
| `SearchCheck` | `magnifier-check` | Catalogue checked-search symbol |
| `Share2` | `share` | Direct equivalent |
| `Sun` | `sun` | Direct equivalent |
| `Tag` | `tag` | Direct equivalent |
| `Trash2` | `trash-bin-trash` | Catalogue delete symbol |
| `Undo2` | `undo-left` | Catalogue undo direction |
| `Unlock` | `lock-unlocked` | Catalogue unlocked symbol |
| `Upload` | `upload` | File import action |
| `Wrench` | `wrench` | Direct equivalent |
| `X` | `close` | Catalogue close symbol |
| `XCircle` | `close-circle` | Error state in a circle |

The four approximate mappings (`CircuitBoard`, `Cpu` duplication, `Orbit`, and
`GitCompare`) are documented rather than hidden. They change glyph shape, not
control behavior.

### Decision 3: Sizes stay in existing utility classes

Every affected icon already carries a `size-*` or `w-*/h-*` class, including
dynamically selected icons. Keep those classes and do not pass a `size` prop by
default. The package sets SVG `width` and `height` attributes of `1em`, but CSS
classes override presentational attributes, so the rendered box stays the same.
If a migrated icon is found without a size class, pass a numeric `size` prop
matching the surrounding control instead of adding a new raw CSS rule.
CompatibleMcuFinder, PinPopover, PeripheralTree, and other search overlays keep
their `pointer-events-none` icon classes so focus behavior is unchanged.

### Decision 4: Theme-token color behavior

Do not set a global `--solar-color`; leaving the prop unset lets the icon
inherit the parent text color through `currentColor`, preserving info, success,
warning, and error utilities. Define the duotone secondary layer on the SVG
class in `src/app.css`:

```css
.solar {
  --solar-secondary-color: color-mix(in oklab, currentColor 60%, var(--color-base-content));
}
```

`--color-base-content` is an existing vendored daisyUI token, so the secondary
layer follows the active theme without a raw color literal and retains the
contextual hue of the primary layer. The package default
`--solar-secondary-opacity` of 0.5 remains in effect unless visual inspection
shows insufficient contrast; if changed, use a numeric value in the same rule.
Per-icon `secondaryColor` props are not used because they would duplicate this
rule across 21 files. Avoid declaring `--depth` or `--noise`, which the token
audit treats as intentionally inert.

### Decision 5: Accessibility and behavior stay on parent controls

No affected icon has its own `aria-label` or `title`. Keep it that way: the
package marks such unlabeled icons as `aria-hidden="true"`, which is correct for
decorative glyphs inside labeled buttons. Do not pass `alt` to an icon when the
parent already has an accessible name, and keep every existing `title`,
`aria-label`, `disabled`, and click handler on the parent control unchanged.

### Decision 6: Tests assert behavior and provenance

Aliasing preserves local component names, so assertions such as the theme
picker's `Monitor`, `Sun`, and `Moon` and the top bar's `<Pencil ...>` markup
can remain. Tests are still updated deliberately to check the new
`@solar-icons/svelte/bold-duotone/` import paths and the absence of
`lucide-svelte`. Any test that couples a contract to a retired library name is
rewritten to assert the preserved behavior instead.

## Risks / Trade-offs

- [Slug mismatch or renamed export] -> Verify all 48 mapped slugs from the
  installed package before editing, and rely on `npm run check` and the
  production build to fail on unresolved imports. No fallback library is used.
- [Bold duotone differs visually from outline icons] -> Preserve sizes and
  token-derived colors, then inspect shell, landing, and workspace surfaces in
  both themes. The four approximate mappings are explicit in the table.
- [Duotone secondary color clashes with status colors] -> Use the documented
  `color-mix` of `currentColor` and `--color-base-content`; adjust only the
  numeric opacity if contrast checks require it.
- [Solar `aria-hidden` suppresses a needed name] -> Verify that labels remain on
  parent controls and that no icon is the only source of an accessible name.
- [Size regression from the package `1em` default] -> Keep size classes and add
  a numeric `size` prop only where no size class exists.
- [Lockfile churn or peer conflict] -> Resolve in `package-lock.json` and the
  existing `.npmrc` (`legacy-peer-deps=true`), not in application code, and
  confirm `npm ci` still works.
- [Static tests fail on renamed markup] -> Use aliases that preserve local names
  and update only assertions tied to library provenance.
- [Out-of-scope dependencies remain] -> `lucide-react` and React packages are
  unused but retained; removing them is a separate change.

## Migration Plan

1. Edit `package.json` to remove `lucide-svelte` and add `@solar-icons/svelte`,
   run `npm install`, confirm `package-lock.json` changes, and verify every
   mapped slug exists in `node_modules/@solar-icons/svelte/dist/icons/bold-duotone/`.
2. Add the `.solar` secondary-color rule to `src/app.css`.
3. Replace imports by group, checking after each group: shell and theme picker,
   landing components and page, workspace dialogs and panels, workspace page,
   then catalog, projects, and remaining pages. Delete `RefreshCw`.
4. Update the static tests listed in `tasks.md`, then scan `src/` for any
   remaining `lucide-svelte` reference and for unverified Solar slugs.
5. Run `npm test`, `npm run check`, and
   `BASE_PATH="/pincraft/" npm run build`; fix warnings and regressions.
6. Run `openspec archive solar-icons-adoption -y` after all tasks pass and
   include archived artifacts in the implementation commit.

Rollback is a git revert of the dependency, import, CSS, test, and documentation
changes. There is no persisted data migration: workspace, share, and project
formats are untouched.
