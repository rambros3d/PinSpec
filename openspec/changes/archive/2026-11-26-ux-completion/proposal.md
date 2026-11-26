# Proposal: UX Completion

## Why

The six-vendor catalog and workspace work, but several interaction surfaces are
incomplete. Package pins are reachable only with a pointer, so keyboard users
cannot open the pin editor. Shell routes keep desktop padding on portrait
phones. The catalog has no sort control or direct part links, and it displays
flash and RAM with inconsistent placeholders. The projects list has no search,
deletes immediately, and cannot export a renamed copy. The top-bar
"Alternatives" action opens a compatible-MCU finder without saying so, the
Clear All confirmation names only assignments although the action resets the
whole pin plan, and the shortcut reference omits the `?` key that opens it.

## What Changes

- Make perimeter and BGA pin groups focusable with a button role, pin label,
  and Enter/Space activation that reuses the same click path, so the AF popover
  anchors to the focused pin.
- Reduce horizontal padding for shell routes and the landing grid inside the
  existing portrait media query; keep the document locked and the panes
  internally scrollable.
- Add catalog sorting by part, pin count, flash, and RAM, direct hash links on
  part cells, and one consistent `Flash / RAM (KB)` column with `—` for absent
  flash data. Sorting is transient view state and stays out of share URLs and
  project files.
- Add project search, an inline delete confirmation, and a Save as action that
  downloads a version-2 JSON copy with a chosen name without renaming the saved
  session.
- Rename the top-bar action and its dialog copy to "Compatible MCUs", state in
  the Clear All confirmation that labels, locks, modes, remaps, and PIO
  bindings are also reset, and add `aria-keyshortcuts` to the controls that
  have keyboard shortcuts.
- Add `?` to the shared shortcut reference and align the shortcut wording with
  the top-bar search and MCU switcher actions.

## Capabilities

- `viewport-locked-workspace`
- `global-top-bar`
- `shell-polish-and-persisted-discovery`
- `project-naming`
- `global-app-shell`
- `compatible-mcu-finder`

## Out of scope

No MCU data, solver rule, exporter format, generated artifact, or npm dependency
changes. STM32 behavior and version-2 share/project schemas remain unchanged.
No new dialog or component library is introduced.
