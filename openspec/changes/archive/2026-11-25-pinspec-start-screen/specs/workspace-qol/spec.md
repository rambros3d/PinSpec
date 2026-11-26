# Spec Delta

## MODIFIED Requirements

### Requirement: Copy and download failures are reported

Failure of a clipboard write or file download SHALL be reported to the user in
the workspace export dialog. That dialog SHALL keep its success confirmation
indicator on a successful copy. A generated object URL SHALL remain valid until
the browser has started the download. The start screen SHALL NOT provide an
export preview, so no copy or download failure strings are required there.

#### Scenario: Clipboard write is rejected

- **WHEN** the browser rejects a clipboard write from the workspace export dialog
- **THEN** a visible failure notification is shown and the success indicator is not set

#### Scenario: Download cannot be started

- **WHEN** a download action in the workspace export dialog fails
- **THEN** a visible failure notification is shown instead of failing silently

#### Scenario: Object URL lifetime

- **WHEN** a download is started from the workspace export dialog
- **THEN** the object URL is revoked only after the download has begun, so the anchor can still read its content

#### Scenario: No landing export surface

- **WHEN** the start screen is rendered
- **THEN** it shows no copy or download control for an export preview, and export failure handling is exercised only by the workspace dialog
