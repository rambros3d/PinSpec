# Spec Delta

## MODIFIED Requirements

### Requirement: Shortcut help uses the daisyUI dialog structure

The shortcut help dialog SHALL place its `form.modal-backdrop` as a direct child
of `<dialog class="modal">`, outside `.modal-box`. Opening focus, focus
restoration on close, Escape, cancel, backdrop click, and the close control
SHALL behave as before. The dialog SHALL be the only keyboard shortcut reference
rendered in the app; the start screen SHALL have no Shortcuts card and About no
shortcut list. The shared `SHORTCUTS` list in `src/data/provenance.ts` SHALL
remain its data source.

#### Scenario: Backdrop is a direct dialog child

- **WHEN** the shortcut help dialog markup is inspected
- **THEN** the modal backdrop form is a sibling of `.modal-box` under the dialog and is not nested inside `.modal-box`

#### Scenario: Dialog dismissal is unchanged

- **WHEN** the user closes shortcut help by Escape, cancel, the close control, or a backdrop click
- **THEN** the dialog closes and focus returns to the control that opened it

#### Scenario: Dialog is the only rendered shortcut reference

- **WHEN** any shell route or the start screen is rendered in either theme
- **THEN** the only rendered keyboard shortcut list is the one inside the shortcut help dialog, with no Shortcuts card on the start screen and no shortcut reference in About
