# Spec Delta

## Purpose

Defines how the catalog store retains chip shards so repeated opens are cheap, concurrent requests are shared, memory stays bounded, and obsolete loads can be cancelled by callers that track generations.

## ADDED Requirements

### Requirement: Concurrent chip loads are deduplicated

The catalog store SHALL share one in-flight promise per normalized MCU id. A second `loadChip(id)` call while the first request is pending SHALL receive the same shard without issuing another network request; after settlement, later calls SHALL use the cached result. A failed or aborted request SHALL be removed from the in-flight map so a later call can retry.

#### Scenario: Two callers share one request

- **WHEN** two callers request the same MCU id before the first fetch resolves
- **THEN** exactly one fetch is started and both callers receive the same chip data

#### Scenario: A failed load can be retried

- **WHEN** a fetch rejects and a later call requests the same MCU id
- **THEN** no stale rejected promise is reused and a new fetch is started

### Requirement: Retained chips are bounded by an LRU cap

The chip cache SHALL retain at most a fixed number of chip shards. Inserting a chip beyond that cap SHALL evict the least recently used entry; a cache hit SHALL refresh that entry's recency. The cap SHALL be a documented constant in the catalog store.

#### Scenario: Least recently used chip is evicted

- **WHEN** the cache is at its cap and a new distinct chip id is loaded
- **THEN** the least recently used chip is removed, the new chip is retained, and no more than the cap of chips remain

#### Scenario: A cache hit refreshes recency

- **WHEN** an older cached chip is read before a new chip is inserted at the cap
- **THEN** that older chip is retained and a different, untouched entry is evicted

### Requirement: Chip loads accept optional cancellation

`loadChip(id, signal)` SHALL accept an optional `AbortSignal` while preserving the single-argument call form for existing callers. When the signal is already aborted, the load SHALL reject without starting a fetch. When aborted during a fetch, the request SHALL be aborted, the in-flight entry SHALL be discarded, and the promise SHALL reject. Cancellation of one caller SHALL NOT discard a shared in-flight request still wanted by a non-aborted caller.

#### Scenario: Pre-aborted signal skips the fetch

- **WHEN** a caller passes a signal that is already aborted to `loadChip`
- **THEN** the promise rejects and no fetch starts

#### Scenario: Abort during a shared load

- **WHEN** one of two callers for the same chip aborts while the shared fetch is pending
- **THEN** the remaining caller still receives the chip and only the aborted caller's promise rejects

#### Scenario: Existing callers remain compatible

- **WHEN** a caller invokes `loadChip(id)` with one argument
- **THEN** the chip is fetched and cached as before
