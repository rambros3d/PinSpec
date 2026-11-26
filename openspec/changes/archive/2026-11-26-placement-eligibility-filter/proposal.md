# Proposal: Placement Eligibility Filter

## Why

The placement tab lists every configured peripheral, including peripherals whose
pins cannot move because every alternate is locked or occupied and immovable.
Enabling a bubble for those peripherals changes nothing, which makes the panel
look as though placement is broken.

## What Changes

- Add a pure core helper that classifies each configured peripheral as having
  a reassignable pin, being locked-only, or being ineligible. Occupied
  alternates count when their occupant is unlocked and has a free alternate of
  its own (one-hop mobility).
- Show eligible peripherals in the placement tab with active toggles.
- Show locked-only peripherals with disabled toggles and an explanatory title.
- Hide other ineligible peripherals.
- Use the same eligibility result in `PackageCanvas.svelte` so overlay
  indicators match the panel.
- Update host tests for the classification and static placement-panel tests.

## Capabilities

- `placement-eligibility-filter`
- `placement-right-panel`

## Out of scope

No solver rule, allocation, persistence, generated data, exporter, dialog, or
shell change. GPIO stays excluded from placement. No new dependency or
preference.
