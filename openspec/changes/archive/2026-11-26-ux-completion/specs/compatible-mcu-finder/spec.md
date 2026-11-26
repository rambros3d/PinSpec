# Spec Delta

## ADDED Requirements

### Requirement: The finder action is named for its result

The workspace action that opens the compatible-MCU finder SHALL be labelled
"Compatible MCUs" in its visible text, title, and aria label. The finder dialog
SHALL use the same name in its heading and accessible label. Existing scoring,
filtering, warnings, and candidate navigation behavior SHALL be unchanged.

#### Scenario: Action and dialog agree

- **WHEN** a user activates the compatible-MCU action in the global bar
- **THEN** the dialog opens with the heading and accessible label "Compatible MCUs"

#### Scenario: Scoring is unchanged

- **WHEN** the finder searches with the same filters and catalog state as before this change
- **THEN** candidates, scores, warnings, and navigation results are identical
