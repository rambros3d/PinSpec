# compatible-mcu-finder Specification

## Purpose

Lets users rank catalog MCUs by how closely their pinouts match the current workspace, across STM32, CH32, and RP parts, and open a candidate without altering the source pinout.

## Requirements

### Requirement: Compatibility signature is derived from the pinout
The system SHALL derive a compatibility signature from the current workspace consisting of assigned pin names and types, power and reset pins, the required signals of every active peripheral mode, and the chip's mux model. Cosmetic fields SHALL NOT affect the signature.

#### Scenario: Labels do not affect the signature
- **WHEN** two workspaces have identical assignments and modes but different custom labels
- **THEN** both workspaces produce the same compatibility signature

#### Scenario: Mode changes affect the signature
- **WHEN** a user changes an active peripheral mode so that its required signals change
- **THEN** the derived compatibility signature changes

### Requirement: Candidates are scored by pin compatibility and memory
The system SHALL rank each candidate with an exact pin-for-pin score, a functional match score, and a flash and RAM delta relative to the source chip. Ranking SHALL be deterministic for identical inputs.

#### Scenario: Exact pin-for-pin match ranks first
- **WHEN** a candidate places every required signal on the same physical pin and pin type as the source workspace
- **THEN** that candidate receives the exact-match classification and ranks above a candidate with only a functional match

#### Scenario: Functional match on different pins
- **WHEN** a candidate supports every required signal but on different physical pins
- **THEN** the candidate receives a functional-match classification rather than an exact-match classification

#### Scenario: Memory delta is reported
- **WHEN** a candidate has different flash or RAM capacity than the source chip
- **THEN** the reported flash/RAM delta reflects the difference in kilobytes

### Requirement: Comparison works across vendors
The system SHALL score candidates from STM32, CH32, and RP regardless of the source chip vendor, evaluating each candidate's signals under that candidate's own mux model.

#### Scenario: Cross-vendor candidate
- **WHEN** the source workspace is an STM32 chip and the candidate is an RP chip
- **THEN** the candidate is scored using the RP mux model rather than rejected for a vendor mismatch

#### Scenario: Remap candidate
- **WHEN** the candidate is a CH32 chip whose signals are grouped into remap options
- **THEN** signal compatibility is evaluated against the candidate's remap groups

### Requirement: Finder filters and bounds candidate loading
The finder UI SHALL present at most 20 ranked candidates, SHALL provide vendor and package filters over that result, and SHALL load at most 4 candidate shards concurrently. Pending shard loads SHALL be cancelled when the finder closes.

#### Scenario: Result cap
- **WHEN** more than 20 catalog entries are compatible
- **THEN** the finder displays at most 20 candidates

#### Scenario: Bounded concurrency
- **WHEN** the finder evaluates 20 candidates
- **THEN** no more than 4 candidate shard loads are in flight at any time

#### Scenario: Cancellation on close
- **WHEN** the finder is closed while shard loads are pending
- **THEN** those pending loads are cancelled and no result is applied afterward

### Requirement: Incomplete candidate data is reported and skipped
When a candidate shard lacks pin-level data required for scoring, the system SHALL surface a warning identifying that candidate and SHALL omit it from ranked results without failing the search.

#### Scenario: Empty candidate pinout
- **WHEN** a candidate shard contains no pins
- **THEN** the finder shows a warning naming the candidate and excludes it from the results

### Requirement: Opening a candidate preserves the source workspace
Selecting a candidate SHALL navigate to that candidate's MCU workspace and SHALL NOT change the assignments, labels, locks, modes, remaps, or PIO bindings of the workspace from which the search started.

#### Scenario: Open candidate from a configured workspace
- **WHEN** a user opens a candidate from a workspace with assignments and locked pins
- **THEN** the source workspace state is unchanged after navigation
