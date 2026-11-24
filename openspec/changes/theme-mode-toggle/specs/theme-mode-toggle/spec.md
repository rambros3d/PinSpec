# Spec Delta

## Purpose

Defines the two-theme appearance modes of the PinCraft interface and the single control that cycles the system, light, and dark preferences, including load-time resolution, persistence, bootstrapping, and control labeling.

## ADDED Requirements

### Requirement: Vendored theme catalog has exactly two entries

The application SHALL vendor exactly two daisyUI theme blocks: `fantasy` for light mode and `halloween` for dark mode. Blocks named `lofi`, `forest`, and `caramellatte` SHALL NOT appear in the vendored CSS or any source, test, or configuration file. Each retained block SHALL declare the complete token set consumed by the UI.

#### Scenario: Two-theme catalog

- **WHEN** the vendored theme CSS is scanned for `[data-theme]` selectors
- **THEN** the only selectors present are `fantasy` and `halloween`

#### Scenario: Removed themes are absent

- **WHEN** source and test files are scanned for the names `lofi`, `forest`, and `caramellatte`
- **THEN** no references to those theme names remain

#### Scenario: Light theme token set

- **WHEN** the `fantasy` block is inspected
- **THEN** it declares `color-scheme: light`, the full color token set, radius, size, and border tokens, `--depth`, `--noise`, and the upstream attribution comment

### Requirement: Mode preference cycles in a fixed order

The theme control SHALL expose one mode preference with exactly three values ordered System, Light, and Dark. Each activation SHALL advance one step in System -> Light -> Dark -> System order and persist the new value. Light SHALL resolve to `fantasy`, Dark SHALL resolve to `halloween`, and System SHALL resolve as defined by the load-time color scheme requirement.

#### Scenario: Cycle order

- **WHEN** the control is activated from System four times
- **THEN** the observed modes are Light, Dark, System, and Light in that order

#### Scenario: Mode to theme mapping

- **WHEN** the mode is Light or Dark
- **THEN** the applied document theme is `fantasy` or `halloween` respectively

#### Scenario: Single-step activation

- **WHEN** the control is activated once
- **THEN** exactly one mode transition occurs and no menu, dropdown, or dialog opens

### Requirement: System color scheme resolves once at load

System mode SHALL evaluate `prefers-color-scheme` only during initial loading, in the inline bootstrap and in store initialization. The application SHALL NOT register a `matchMedia` change listener or re-evaluate the OS preference during the session. When no stored mode and no OS preference exist, light mode SHALL be the baseline.

#### Scenario: Light preference at load

- **WHEN** system mode is active and the OS reports a light preference at load
- **THEN** `fantasy` is applied

#### Scenario: Dark preference at load

- **WHEN** system mode is active and the OS reports a dark preference at load
- **THEN** `halloween` is applied

#### Scenario: No live listener

- **WHEN** the source is scanned for `matchMedia` listener registration
- **THEN** no such listener is present and a later OS preference change leaves the applied theme unchanged

#### Scenario: Absent preference baseline

- **WHEN** no stored mode and no OS preference are available
- **THEN** the applied theme is `fantasy`

### Requirement: Legacy saved theme ids are ignored

Saved values from the previous four-theme picker SHALL NOT be honored or translated. A stored value other than `system`, `light`, or `dark` SHALL resolve to system mode without applying that value as a theme id. No migration shim or mapping table for legacy ids SHALL be present.

#### Scenario: Legacy ids reset

- **WHEN** storage holds `lofi`, `forest`, `caramellatte`, or `halloween` as the saved preference
- **THEN** the application starts in system mode

#### Scenario: Unknown value reset

- **WHEN** storage holds an unrecognized string
- **THEN** the application starts in system mode

#### Scenario: No legacy mapping

- **WHEN** the theme state source is inspected
- **THEN** no code maps a legacy theme id to a retained theme

### Requirement: Mode persists in localStorage only

The selected mode SHALL be written under the existing `pincraft:theme` localStorage key as one of `system`, `light`, or `dark`. The mode and the resolved theme id SHALL NOT appear in share URLs, version-2 project JSON, or any exported artifact. No other storage key SHALL be used for this preference.

#### Scenario: Persist across reload

- **WHEN** the user selects Dark and reloads the application
- **THEN** the application starts in dark mode with `halloween` applied

#### Scenario: Persist system mode

- **WHEN** the user selects System and reloads the application
- **THEN** the application resolves the theme from the load-time OS preference

#### Scenario: Storage unavailable

- **WHEN** localStorage access throws
- **THEN** the application still applies the resolved theme and does not fail

#### Scenario: Sharing isolation

- **WHEN** a share URL, project JSON, or export file is produced or imported
- **THEN** it contains no theme mode or theme id field and import does not change localStorage

### Requirement: No-FOUC bootstrap matches store resolution

The document SHALL declare `fantasy` as its initial `data-theme` and an inline script SHALL replace it with `fantasy` or `halloween` from the stored mode and load-time OS preference before the application module runs. The bootstrap SHALL mirror the store resolution without importing the store, and both SHALL agree for every accepted stored value.

#### Scenario: Cold light load

- **WHEN** no mode is stored and the OS reports light
- **THEN** the bootstrap sets `data-theme` to `fantasy` before the app module executes

#### Scenario: Stored dark load

- **WHEN** the stored mode is dark
- **THEN** the bootstrap sets `data-theme` to `halloween` before the app module executes

#### Scenario: Bootstrap and store agree

- **WHEN** the app initializes after bootstrap
- **THEN** the resolved store theme equals the document `data-theme` and no visible theme change occurs

#### Scenario: Legacy bootstrap value

- **WHEN** a legacy theme id is stored
- **THEN** the bootstrap and the store both resolve to system mode

### Requirement: Theme control presents mode icon and label

The theme control SHALL be a single button, not a dropdown, menu, or modal. The full form SHALL show a Monitor, Sun, or Moon icon for System, Light, or Dark together with the text `System`, `Light`, or `Dark`. The compact toolbar form SHALL be icon-only and SHALL expose `title` and `aria-label` that name the current mode.

#### Scenario: Full control in system mode

- **WHEN** the landing header renders the control in system mode
- **THEN** it shows a Monitor icon, the text `System`, and no menu element

#### Scenario: Compact control

- **WHEN** the workspace toolbar renders the control
- **THEN** it shows one icon, no text label, and `title` and `aria-label` naming the current mode

#### Scenario: Label follows cycle

- **WHEN** the user cycles to Light and then to Dark
- **THEN** the icon and text change to Sun and Light, then Moon and Dark

### Requirement: Theme change keeps source hygiene and verification green

The change SHALL add no dependency, keep raw color literals confined to `src/themes/daisyui.css`, keep zero emoji characters, and keep strict TypeScript clean. The token audit SHALL still report 28 declared tokens with depth and noise inert. `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` SHALL exit zero with no build warnings.

#### Scenario: Source hygiene scan

- **WHEN** delivered source is scanned for color literals and emoji
- **THEN** no offenders appear outside the vendored theme file

#### Scenario: Token audit

- **WHEN** `tests/theme-tokens.test.ts` runs
- **THEN** 28 declared tokens are reported and no token loses its consumer

#### Scenario: Verification sequence

- **WHEN** the three verification commands run
- **THEN** all exit zero and the build reports no warnings
