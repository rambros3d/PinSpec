/** Deterministic hash helpers used by golden-output regression tests. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { CatalogIndexEntry, ChipData } from '../../src/core/types';

/** SHA-256 of a UTF-8 payload, lowercase hex. */
export function sha256Hex(payload: string | Buffer): string {
  return createHash('sha256').update(payload).digest('hex');
}

/** Hash of a single chip shard, whose on-disk bytes are `JSON.stringify(chip)`. */
export function chipHash(chip: ChipData): string {
  return sha256Hex(JSON.stringify(chip));
}

/**
 * Order-independent aggregate over all chip shards. Each entry contributes its
 * part ID, a NUL separator, the exact shard bytes, and a newline. Timestamped
 * metadata files are excluded, so repeated generation is byte-comparable.
 */
export function aggregateChipHash(chips: Map<string, ChipData>): string {
  const hash = createHash('sha256');
  for (const id of Array.from(chips.keys()).sort()) {
    hash.update(id);
    hash.update('\0');
    hash.update(JSON.stringify(chips.get(id)));
    hash.update('\n');
  }
  return hash.digest('hex');
}

/** Aggregate hash over chip shard files, matching `aggregateChipHash`. */
export function aggregateChipFilesHash(chipsDir: string): string {
  const hash = createHash('sha256');
  const files = fs
    .readdirSync(chipsDir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  for (const file of files) {
    hash.update(file.slice(0, -'.json'.length));
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(chipsDir, file)));
    hash.update('\n');
  }
  return hash.digest('hex');
}

/** Hash of the compact catalog index as emitted by the generator. */
export function indexHash(index: CatalogIndexEntry[]): string {
  return sha256Hex(JSON.stringify(index));
}
