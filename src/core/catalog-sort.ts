/**
 * Pure ordering for catalog search results. Sorting is presentation state: it
 * never changes the generated index, discovery filters, share URLs, or project
 * files. Absent memory values sort last so bare dies stay reachable.
 */

import type { CatalogIndexEntry } from './types';

/** Fields offered by the catalog result sort control. */
export type CatalogSortField = 'part' | 'pins' | 'flash' | 'ram';

/** Part-number comparison used for the primary sort and as a stable tie-break. */
function comparePartIds(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Nullable numeric comparison with absent values after every present value. */
function compareNullable(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/** Return a new array ordered by the requested field and then by part number. */
export function sortCatalogEntries(
  entries: readonly CatalogIndexEntry[],
  field: CatalogSortField,
): CatalogIndexEntry[] {
  return [...entries].sort((a, b) => {
    let primary = 0;
    if (field === 'part') primary = comparePartIds(a.id, b.id);
    else if (field === 'pins') primary = a.pinCount - b.pinCount;
    else if (field === 'flash') primary = compareNullable(a.flashKb, b.flashKb);
    else primary = a.ramKb - b.ramKb;
    return primary || comparePartIds(a.id, b.id);
  });
}
