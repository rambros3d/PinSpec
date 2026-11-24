/**
 * Read-only hardware-connection audit derived from generated chip shards and
 * user-entered workspace state.
 *
 * This module deliberately stays outside `evaluateWorkspace`: it reports facts
 * with evidence sources, never correctness diagnostics, and never prescribes
 * pull directions, passive component values, or unused-pin handling. Values
 * missing from the shard and from user state are reported explicitly as unknown
 * or data-unavailable. No Svelte or DOM API is used.
 */
import type {
  ChipData,
  GpioPull,
  PinInfo,
  VendorId,
  WorkspaceState,
} from './types';
import { getChipVendor } from './types';

/** Enumerated provenance labels for one audit fact. */
export const AUDIT_EVIDENCE_SOURCES = [
  'chip-shard-pin-type',
  'chip-shard-pin-name',
  'chip-shard-signal',
  'chip-shard-tag',
  'chip-shard-bonded-names',
  'chip-shard-peripheral',
  'workspace-gpio-config',
  'workspace-label',
  'workspace-state',
  'implicit-unused',
  'data-unavailable',
] as const;
export type AuditEvidenceSource = (typeof AUDIT_EVIDENCE_SOURCES)[number];

/** Strapping roles recognised from shard fields and pin names only. */
export const STRAPPING_ROLES = [
  'boot',
  'reset',
  'reset-and-boot',
  'debug-swd',
  'debug-sdi',
  'qspi',
] as const;
export type StrappingRole = (typeof STRAPPING_ROLES)[number];

export type AuditPull = GpioPull | 'unknown';
export type AuditStatus = 'present' | 'absent' | 'data-unavailable';

/** One classified strapping pin. Pull and label come only from user state. */
export interface StrappingFact {
  pos: string;
  pinName: string;
  role: StrappingRole;
  detail: string;
  evidence: AuditEvidenceSource;
  pull: AuditPull;
  pullEvidence: AuditEvidenceSource;
  label?: string;
  labelEvidence?: AuditEvidenceSource;
}

/** Presence or explicit absence of an interface, signal, domain, or data field. */
export interface InterfaceFact {
  id: string;
  status: AuditStatus;
  detail: string;
  evidence: AuditEvidenceSource;
}

export interface InterfaceSection {
  interfaces: InterfaceFact[];
  oscillators: InterfaceFact[];
  powerDomains: InterfaceFact[];
  passiveFields: InterfaceFact[];
}

/** An `io` pin with no assignment is unused by definition. */
export interface UnusedPinFact {
  pos: string;
  pinName: string;
  status: 'implicit-unused';
  evidence: AuditEvidenceSource;
}

/** A physical lead that bonds multiple internal pads, backed by shard fields. */
export interface BondedPadFact {
  pos: string;
  pinName: string;
  bondedNames: string[];
  evidence: AuditEvidenceSource;
}

export interface UnusedPinSection {
  unused: UnusedPinFact[];
  bonded: BondedPadFact[];
}

export type ToleranceValue = '5v-tolerant' | 'user-labeled-5v' | 'unknown';

/** Voltage tolerance claim backed by a tag, a user label, or the absence of both. */
export interface ToleranceFact {
  pos: string;
  pinName: string;
  tolerance: ToleranceValue;
  detail: string;
  evidence: AuditEvidenceSource;
}

export interface HardwareAuditReport {
  chipId: string;
  vendor: VendorId;
  strapping: StrappingFact[];
  interfaces: InterfaceSection;
  unusedPins: UnusedPinSection;
  voltageTolerance: ToleranceFact[];
}

/** Natural, numeric-aware ordering keyed by physical pin position. */
function comparePositions(a: PinInfo, b: PinInfo): number {
  return a.pos.localeCompare(b.pos, undefined, { numeric: true });
}

function hasTag(pin: PinInfo, tag: NonNullable<PinInfo['tags']>[number]): boolean {
  return Boolean(pin.tags?.includes(tag));
}

interface RoleEvidence {
  evidence: AuditEvidenceSource;
  details: string[];
}

/** Collects roles for one pin, keeping the first evidence source per role. */
function addRole(
  roles: Map<StrappingRole, RoleEvidence>,
  role: StrappingRole,
  evidence: AuditEvidenceSource,
  detail: string,
): void {
  const existing = roles.get(role);
  if (!existing) {
    roles.set(role, { evidence, details: [detail] });
    return;
  }
  if (!existing.details.includes(detail)) existing.details.push(detail);
}

/**
 * Classifies strapping roles from `PinInfo.type`, composite STM32 names,
 * SYS debug signals, and vendor tags. RP `RUN` is reset-and-boot; no BOOTSEL
 * role is synthesized because no shard declares one.
 */
function strappingRoles(pin: PinInfo, vendor: VendorId): Map<StrappingRole, RoleEvidence> {
  const roles = new Map<StrappingRole, RoleEvidence>();
  const name = pin.name.trim();
  const upperName = name.toUpperCase();
  const isRpRun = vendor === 'rp' && upperName === 'RUN';

  if (!isRpRun) {
    if (pin.type === 'boot') addRole(roles, 'boot', 'chip-shard-pin-type', pin.type);
    if (pin.type === 'reset') addRole(roles, 'reset', 'chip-shard-pin-type', pin.type);
  } else {
    addRole(roles, 'reset-and-boot', 'chip-shard-pin-name', name);
  }

  if (/-(BOOT\d?|NRST)$/i.test(name)) {
    addRole(
      roles,
      /-NRST$/i.test(name) ? 'reset' : 'boot',
      'chip-shard-pin-name',
      name,
    );
  }

  for (const signal of pin.signals) {
    if (signal.peripheral !== 'SYS') continue;
    if (signal.signal === 'SWDIO' || signal.signal === 'SWCLK') {
      addRole(roles, 'debug-swd', 'chip-shard-signal', `${signal.peripheral}.${signal.signal}`);
    }
  }

  if (hasTag(pin, 'debug-sdi')) addRole(roles, 'debug-sdi', 'chip-shard-tag', 'debug-sdi');
  if (hasTag(pin, 'debug-swd')) addRole(roles, 'debug-swd', 'chip-shard-tag', 'debug-swd');
  if (upperName === '~{QSPI_SS}' && hasTag(pin, 'qspi')) {
    addRole(roles, 'qspi', 'chip-shard-tag', 'qspi');
  }
  return roles;
}

function passiveFields(): InterfaceFact[] {
  return [
    ['i2c-pull-up-value', 'no upstream pull-up row'],
    ['decoupling-capacitor-count', 'no upstream decoupling row'],
    ['usb-series-resistance', 'no upstream series component row'],
    ['usb-esd-device', 'no upstream ESD row'],
    ['guard-ring-layout', 'no upstream layout row'],
    ['vcap-value', 'no upstream VCAP row'],
    ['crystal-load-capacitance', 'no numeric capacitance emitted'],
  ].map(([id, detail]) => ({
    id,
    status: 'data-unavailable' as const,
    detail,
    evidence: 'data-unavailable' as const,
  }));
}

/** Builds the interface, oscillator, power-domain, and passive-field facts. */
function interfaceFacts(chip: ChipData, state: WorkspaceState): InterfaceSection {
  const declared = Object.entries(chip.peripherals)
    .filter(([name, info]) =>
      info.kind === 'i2c' ||
      info.kind === 'usb' ||
      /^I2C\d*$/i.test(name) ||
      /^(USB|OTG)/i.test(name),
    )
    .sort(([a], [b]) => a.localeCompare(b));

  const interfaces: InterfaceFact[] = declared.map(([name]) => {
    const mode = state.peripheralModes[name] ?? 'disabled';
    return {
      id: name,
      status: mode !== 'disabled' ? 'present' : 'absent',
      detail: `${name}:${mode}`,
      evidence: 'chip-shard-peripheral',
    };
  });
  if (!interfaces.some((fact) => /^I2C/i.test(fact.id))) {
    interfaces.push({
      id: 'I2C',
      status: 'absent',
      detail: 'no declared I2C peripheral',
      evidence: 'data-unavailable',
    });
  }
  if (!interfaces.some((fact) => /^(USB|OTG)/i.test(fact.id))) {
    interfaces.push({
      id: 'USB',
      status: 'absent',
      detail: 'no declared USB peripheral',
      evidence: 'data-unavailable',
    });
  }

  const oscillatorSignals = new Map<string, string>();
  const powerDomains = new Map<string, string>();
  for (const pin of chip.pins) {
    for (const signal of pin.signals) {
      if (/^OSC/i.test(signal.signal) && !oscillatorSignals.has(signal.signal)) {
        oscillatorSignals.set(signal.signal, `${pin.pos}:${pin.name}:${signal.signal}`);
      }
    }
    if (pin.type === 'power' && !powerDomains.has(pin.name)) {
      powerDomains.set(pin.name, `${pin.pos}:${pin.name}`);
    }
  }

  const oscillators: InterfaceFact[] = Array.from(oscillatorSignals, ([id, detail]) => ({
    id,
    status: 'present' as const,
    detail,
    evidence: 'chip-shard-signal' as const,
  })).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  if (oscillators.length === 0) {
    oscillators.push({
      id: 'OSC',
      status: 'absent',
      detail: 'no OSC* signal name in shard',
      evidence: 'data-unavailable',
    });
  }

  const domains: InterfaceFact[] = Array.from(powerDomains, ([id, detail]) => ({
    id,
    status: 'present' as const,
    detail,
    evidence: 'chip-shard-pin-type' as const,
  })).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  if (domains.length === 0) {
    domains.push({
      id: 'power-domains',
      status: 'absent',
      detail: 'no pin typed power in shard',
      evidence: 'data-unavailable',
    });
  }

  return {
    interfaces,
    oscillators,
    powerDomains: domains,
    passiveFields: passiveFields(),
  };
}

/**
 * Builds a deterministic hardware audit. Every array is ordered by the chip's
 * emitted pin geometry or by sorted identifiers, so identical inputs produce
 * byte-identical reports and exports.
 */
export function buildHardwareAudit(chip: ChipData, state: WorkspaceState): HardwareAuditReport {
  const vendor = getChipVendor(chip);
  const pins = [...chip.pins].sort(comparePositions);

  const strapping: StrappingFact[] = [];
  const unused: UnusedPinFact[] = [];
  const bonded: BondedPadFact[] = [];
  const voltageTolerance: ToleranceFact[] = [];

  for (const pin of pins) {
    const roles = strappingRoles(pin, vendor);
    const config = state.gpioConfig?.[pin.pos];
    const label = state.labels[pin.pos]?.trim();

    for (const [role, info] of roles) {
      const fact: StrappingFact = {
        pos: pin.pos,
        pinName: pin.name,
        role,
        detail: info.details.sort().join('; '),
        evidence: info.evidence,
        pull: config?.pull ?? 'unknown',
        pullEvidence: config ? 'workspace-gpio-config' : 'data-unavailable',
      };
      if (label) {
        fact.label = label;
        fact.labelEvidence = 'workspace-label';
      }
      strapping.push(fact);
    }

    if (pin.type === 'io' && !state.assignments[pin.pos]) {
      unused.push({
        pos: pin.pos,
        pinName: pin.name,
        status: 'implicit-unused',
        evidence: 'implicit-unused',
      });
    }

    const bondedNames = pin.bondedNames ?? [];
    if (bondedNames.length > 1 && hasTag(pin, 'bonded')) {
      bonded.push({
        pos: pin.pos,
        pinName: pin.name,
        bondedNames: [...bondedNames],
        evidence: 'chip-shard-bonded-names',
      });
    }

    let tolerance: ToleranceFact;
    if (hasTag(pin, '5v-tolerant')) {
      tolerance = {
        pos: pin.pos,
        pinName: pin.name,
        tolerance: '5v-tolerant',
        detail: '5v-tolerant',
        evidence: 'chip-shard-tag',
      };
    } else if (label && /^5V_|^UART_5V/i.test(label)) {
      tolerance = {
        pos: pin.pos,
        pinName: pin.name,
        tolerance: 'user-labeled-5v',
        detail: label,
        evidence: 'workspace-label',
      };
    } else {
      tolerance = {
        pos: pin.pos,
        pinName: pin.name,
        tolerance: 'unknown',
        detail: 'no tolerance tag or matching label',
        evidence: 'data-unavailable',
      };
    }
    voltageTolerance.push(tolerance);
  }

  return {
    chipId: chip.id,
    vendor,
    strapping,
    interfaces: interfaceFacts(chip, state),
    unusedPins: { unused, bonded },
    voltageTolerance,
  };
}

/**
 * Renders the same structured facts in a stable plain-text order for the Audit
 * export. The text contains no recommended actions and no passive values.
 */
export function formatHardwareAuditText(report: HardwareAuditReport): string {
  const lines: string[] = [`Hardware audit: ${report.chipId} (${report.vendor})`, ''];

  lines.push('Strapping');
  if (report.strapping.length === 0) lines.push('  (none)');
  for (const fact of report.strapping) {
    const label = fact.label ? `${fact.label} (${fact.labelEvidence})` : 'absent';
    lines.push(
      `  ${fact.pos} ${fact.pinName}: role=${fact.role}; evidence=${fact.evidence}; ` +
      `detail=${fact.detail}; pull=${fact.pull} (${fact.pullEvidence}); label=${label}`,
    );
  }

  lines.push('', 'Interfaces');
  for (const fact of report.interfaces.interfaces) {
    lines.push(`  ${fact.id}: status=${fact.status}; detail=${fact.detail}; evidence=${fact.evidence}`);
  }
  lines.push('Oscillators');
  for (const fact of report.interfaces.oscillators) {
    lines.push(`  ${fact.id}: status=${fact.status}; detail=${fact.detail}; evidence=${fact.evidence}`);
  }
  lines.push('Power Domains');
  for (const fact of report.interfaces.powerDomains) {
    lines.push(`  ${fact.id}: status=${fact.status}; detail=${fact.detail}; evidence=${fact.evidence}`);
  }
  lines.push('Passive Fields');
  for (const fact of report.interfaces.passiveFields) {
    lines.push(`  ${fact.id}: status=${fact.status}; detail=${fact.detail}; evidence=${fact.evidence}`);
  }

  lines.push('', 'Unused Pins');
  if (report.unusedPins.unused.length === 0) lines.push('  (none)');
  for (const fact of report.unusedPins.unused) {
    lines.push(`  ${fact.pos} ${fact.pinName}: status=${fact.status}; evidence=${fact.evidence}`);
  }
  lines.push('Bonded Pads');
  if (report.unusedPins.bonded.length === 0) lines.push('  (none)');
  for (const fact of report.unusedPins.bonded) {
    lines.push(
      `  ${fact.pos} ${fact.pinName}: pads=${fact.bondedNames.join(' / ')}; evidence=${fact.evidence}`,
    );
  }

  lines.push('', 'Voltage Tolerance');
  for (const fact of report.voltageTolerance) {
    lines.push(
      `  ${fact.pos} ${fact.pinName}: tolerance=${fact.tolerance}; ` +
      `detail=${fact.detail}; evidence=${fact.evidence}`,
    );
  }
  return lines.join('\n') + '\n';
}
