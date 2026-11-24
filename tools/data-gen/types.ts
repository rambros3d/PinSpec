/**
 * Shared contracts for the build-time catalog pipeline.
 *
 * These types deliberately depend only on `src/core/types.ts` (pure TypeScript)
 * so adapters, gates, and their tests never import Svelte or DOM APIs.
 */
import type {
  CatalogIndexEntry,
  CatalogMeta,
  ChipData,
  VendorId,
} from '../../src/core/types';
import type { WarningsDocument } from './artifacts';

/** One file fetched directly from an upstream host into a `.cache` directory. */
export interface RawSourceFile {
  /** Absolute HTTP(S) URL of the file. */
  url: string;
  /** Path relative to the source's `dir` where the file is stored. */
  path: string;
}

/** Declaration of an upstream checkout before its revision is resolved. */
export interface SourceSpec {
  id: string;
  url: string;
  dir: string;
  license: string;
  /**
   * When present, these files are fetched individually instead of cloning `url`.
   * `url` then names the upstream project (used for provenance only).
   */
  rawFiles?: RawSourceFile[];
}

/** A source checkout with a resolved revision (or the literal `unknown`). */
export interface ResolvedSource extends SourceSpec {
  commit: string;
}

/** Filesystem locations shared by every vendor adapter. */
export interface DataGenPaths {
  root: string;
  cacheDir: string;
  outDir: string;
  chipsOutDir: string;
}

/** A deferred or unmapped part attributed to its vendor and upstream source. */
export interface BuildWarning {
  /** Stable identifier of the deferred part (normally its upstream part id). */
  id?: string;
  vendor: VendorId;
  /** Canonical upstream source id (for example `ch32-device-data`). */
  source?: string;
  file?: string;
  refName?: string;
  reason: string;
}

/** Mutable collector passed to adapters so warnings are attributed centrally. */
export interface WarningCollector {
  add(warning: BuildWarning): void;
  all(): BuildWarning[];
  countFor(vendor: VendorId): number;
}

/** Inputs provided to a vendor adapter by the orchestrator. */
export interface AdapterContext {
  paths: DataGenPaths;
  sources: ResolvedSource[];
  warnings: WarningCollector;
}

/** Adapter output. The orchestrator owns every filesystem write. */
export interface AdapterResult {
  vendor: VendorId;
  chips: Map<string, ChipData>;
  index: CatalogIndexEntry[];
  families: string[];
  totalVariants: number;
  matchedVariants: number;
}

/** Complete catalog view available to per-vendor gates after emission. */
export interface GateContext {
  paths: DataGenPaths;
  chips: Map<string, ChipData>;
  index: CatalogIndexEntry[];
  totalVariants: number;
  matchedVariants: number;
  matchRate: number;
  totalBytes: number;
  warnings: BuildWarning[];
  /** Filled by the orchestrator for the global provenance and artifact gates. */
  meta?: CatalogMeta;
  warningDoc?: WarningsDocument;
  /** Serialized shard payloads keyed by part id, used by shard-integrity checks. */
  serializedShards?: Map<string, string>;
}

/** Result of one gate. Errors block strict vendors; notes become warnings. */
export interface GateResult {
  vendor: VendorId;
  name: string;
  errors: string[];
  notes: string[];
}

/** Named validation step contributed by a vendor adapter. */
export interface Gate {
  name: string;
  evaluate(ctx: GateContext): GateResult;
}

/** Contract implemented by each vendor data adapter. */
export interface VendorAdapter {
  vendor: VendorId;
  sourceSpecs: SourceSpec[];
  /** Source id whose revision is the primary `meta.json.sources[vendor].commit`. */
  primarySourceId?: string;
  generate(ctx: AdapterContext): AdapterResult;
  gates: Gate[];
  /** Strict vendors fail on gate errors; lenient vendors record warnings. */
  strict: boolean;
}
