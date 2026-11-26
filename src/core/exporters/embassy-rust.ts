import {
  formatMuxLabel,
  getChipMuxModel,
  getChipVendor,
  type ChipData,
  type GpioConfig,
  type PinInfo,
  type WorkspaceState,
} from '../types';

/** Convert a custom label into a unique, valid Rust snake_case field name. */
function toSnakeCase(input: string): string {
  const cleaned = input
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  if (!cleaned) return 'pin';
  return /^[0-9]/.test(cleaned) ? `p_${cleaned}` : cleaned;
}

/** STM32/CH32 pad identifier: "PA11 [PA9]" -> "PA11", "PC13-ANTI_TAMP" -> "PC13". */
function basePinIdent(pinName: string): string {
  const match = pinName.match(/^(P[A-K][0-9]{1,2})/);
  return match ? match[1] : pinName.replace(/[^A-Za-z0-9_]/g, '_');
}

/** ESP32 pad identifier: "GPIO4" -> "GPIO4" (the esp-hal peripheral name). */
function espPinIdent(pinName: string): string {
  const match = pinName.match(/GPIO(\d+)/i);
  return match ? `GPIO${match[1]}` : basePinIdent(pinName);
}

/** RP pad identifier: "GPIO0" -> "PIN_0" (the embassy-rp peripheral name). */
function rpPinIdent(pinName: string): string {
  const match = pinName.match(/^GPIO(\d+)$/i);
  if (match) return `PIN_${match[1]}`;
  return basePinIdent(pinName);
}

interface BindingEntry {
  pos: string;
  pinName: string;
  pinIdent: string;
  peripheral: string;
  signal: string;
  muxLabel: string;
  resourceId?: string;
  fieldName: string;
  gpio?: GpioConfig;
}

interface Bindings {
  grouped: Map<string, BindingEntry[]>;
  sortedPeripherals: string[];
}

/** Collect assigned pins once, using the single mux-label helper for every vendor. */
function collectBindings(chip: ChipData, state: WorkspaceState): Bindings {
  const muxModel = getChipMuxModel(chip);
  const pinMap = new Map<string, PinInfo>(chip.pins.map((p) => [p.pos, p]));
  const grouped = new Map<string, BindingEntry[]>();
  const usedNames = new Map<string, number>();

  const sortedPositions = Object.keys(state.assignments).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  for (const pos of sortedPositions) {
    const asgn = state.assignments[pos];
    const pin = pinMap.get(pos);
    if (!pin) continue;

    const rawLabel = state.labels[pos]?.trim();
    const baseName = rawLabel
      ? toSnakeCase(rawLabel)
      : toSnakeCase(`${asgn.peripheral}_${asgn.signal}`);
    const count = usedNames.get(baseName) ?? 0;
    usedNames.set(baseName, count + 1);
    const fieldName = count === 0 ? baseName : `${baseName}_${count + 1}`;

    const entry: BindingEntry = {
      pos,
      pinName: pin.name,
      pinIdent:
        getChipVendor(chip) === 'esp32'
          ? espPinIdent(pin.name)
          : getChipVendor(chip) === 'rp'
            ? rpPinIdent(pin.name)
            : basePinIdent(pin.name),
      peripheral: asgn.peripheral,
      signal: asgn.signal,
      muxLabel: formatMuxLabel(asgn, muxModel),
      ...(asgn.resourceId ? { resourceId: asgn.resourceId } : {}),
      fieldName,
      ...(state.gpioConfig?.[pos] ? { gpio: state.gpioConfig[pos] } : {}),
    };

    const list = grouped.get(asgn.peripheral) ?? [];
    list.push(entry);
    grouped.set(asgn.peripheral, list);
  }

  const sortedPeripherals = Array.from(grouped.keys()).sort((a, b) => {
    if (a === 'GPIO') return 1;
    if (b === 'GPIO') return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  return { grouped, sortedPeripherals };
}

/** Embedded-HAL-style configuration comment emitted only for configured pins. */
function gpioCommentLines(gpio: GpioConfig | undefined): string[] {
  if (!gpio) return [];
  return [
    `    // embedded-hal GPIO config: level=${gpio.outputLevel}, drive=${gpio.drive}, pull=${gpio.pull}, speed=${gpio.speed}`,
  ];
}

/** Shared struct/impl body used by all three vendor formatters. */
function renderStruct(
  chip: ChipData,
  state: WorkspaceState,
  bindings: Bindings,
  peripheralsType: string,
): string[] {
  const lines: string[] = [];
  if (bindings.sortedPeripherals.length === 0) {
    lines.push(`pub struct BoardPins {}`);
    lines.push(``);
    lines.push(`impl BoardPins {`);
    lines.push(`    pub fn from_peripherals(p: ${peripheralsType}) -> Self {`);
    lines.push(`        Self {}`);
    lines.push(`    }`);
    lines.push(`}`);
    return lines;
  }
  lines.push(`pub struct BoardPins {`);
  for (const periph of bindings.sortedPeripherals) {
    const entries = bindings.grouped.get(periph)!;
    const mode = state.peripheralModes[periph];
    lines.push(`    // ${periph}${mode ? ` (${mode})` : ''}`);
    for (const e of entries) {
      lines.push(
        `    pub ${e.fieldName}: peripherals::${e.pinIdent}, // Pin ${e.pos} (${e.pinName}) -> ${e.peripheral}_${e.signal} [${e.muxLabel}]`,
      );
      lines.push(...gpioCommentLines(e.gpio));
    }
  }
  lines.push(`}`);
  lines.push(``);
  lines.push(`impl BoardPins {`);
  lines.push(`    pub fn from_peripherals(p: ${peripheralsType}) -> Self {`);
  lines.push(`        Self {`);
  for (const periph of bindings.sortedPeripherals) {
    for (const e of bindings.grouped.get(periph)!) {
      lines.push(`            ${e.fieldName}: p.${e.pinIdent},`);
    }
  }
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push(`}`);
  return lines;
}

function headerLines(chip: ChipData): string[] {
  return [
    `// Generated by PinSpec for ${chip.id} (${chip.package.name})`,
    `// Core: ${chip.core} | Flash: ${chip.flashKb ?? 'unspecified'} KB | RAM: ${chip.ramKb} KB`,
  ];
}

/** STM32 output: byte-for-byte compatible with the original AF-based exporter. */
function formatStm32(chip: ChipData, state: WorkspaceState): string {
  const bindings = collectBindings(chip, state);
  const lines = [...headerLines(chip), `use embassy_stm32::peripherals;`, ``];
  lines.push(...renderStruct(chip, state, bindings, 'embassy_stm32::Peripherals'));
  return lines.join('\n') + '\n';
}

/** RP output: embassy-rp init, PIN_x pads, PWM slice/PIO grouping, interrupt skeleton. */
function formatRp(chip: ChipData, state: WorkspaceState): string {
  const bindings = collectBindings(chip, state);
  const lines = [
    ...headerLines(chip),
    `// Mux model: per-pin FUNCSEL, shared PWM slices and flexible PIO`,
    `use embassy_rp::peripherals;`,
    ``,
    `/// Initialize RP peripherals. Call once at startup.`,
    `pub fn init() -> embassy_rp::Peripherals {`,
    `    embassy_rp::init(Default::default())`,
    `}`,
    ``,
  ];

  const entries = bindings.sortedPeripherals.flatMap((p) => bindings.grouped.get(p)!);

  const slices = new Map<string, string[]>();
  for (const e of entries) {
    const match = (e.resourceId ?? e.signal).match(/^PWM(\d+)([AB])$/);
    if (!match) continue;
    const key = `PWM_SLICE${match[1]}`;
    const list = slices.get(key) ?? [];
    list.push(`${e.pinName} (${e.signal})`);
    slices.set(key, list);
  }
  if (slices.size > 0) {
    lines.push(`// PWM slices in use:`);
    for (const [slice, users] of Array.from(slices.entries()).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true }),
    )) {
      lines.push(`//   ${slice}: ${users.join(', ')}`);
    }
    lines.push(``);
  }

  const pioEntries = entries.filter(
    (e) => e.peripheral.startsWith('PIO') || Boolean(state.pioAssignments?.[e.pos]),
  );
  if (pioEntries.length > 0) {
    lines.push(`// PIO bindings:`);
    for (const e of pioEntries) {
      const binding = state.pioAssignments?.[e.pos];
      const detail = binding
        ? `${binding.instance} / SM${binding.sm ?? 0} / ${binding.role ?? 'signal'}`
        : e.peripheral;
      lines.push(`//   ${e.pinName}: ${detail}`);
    }
    lines.push(``);
  }

  lines.push(...renderStruct(chip, state, bindings, 'embassy_rp::Peripherals'));

  lines.push(``);
  lines.push(`// Interrupt skeleton (bind the handlers to the slices/PIO you use):`);
  lines.push(`// use embassy_rp::interrupt;`);
  lines.push(`// #[interrupt]`);
  lines.push(`// fn PWM_SLICE0() {}`);
  lines.push(`// #[interrupt]`);
  lines.push(`// fn PIO0_IRQ_0() {}`);

  return lines.join('\n') + '\n';
}

/** CH32 output: ch32-hal init, active remap summary and debug-pin warnings. */
function formatCh32(chip: ChipData, state: WorkspaceState): string {
  const bindings = collectBindings(chip, state);
  const lines = [...headerLines(chip), `use ch32_hal::peripherals;`, ``];

  lines.push(`/// Initialize CH32 peripherals. Call once at startup.`);
  lines.push(`pub fn init() -> ch32_hal::Peripherals {`);
  lines.push(`    ch32_hal::init()`);
  lines.push(`}`);
  lines.push(``);

  const remapEntries = Object.entries(state.activeRemaps ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  if (remapEntries.length > 0) {
    lines.push(`/* Active remap groups (ch32-hal):`);
    for (const [peripheral, remapId] of remapEntries) {
      const option = chip.peripherals[peripheral]?.remaps?.find((r) => r.id === remapId);
      const name = option ? option.name : `RM${remapId}`;
      const note = option?.registerNote ? ` -- ${option.registerNote}` : '';
      lines.push(` * ${peripheral}: ${name}${note}`);
    }
    lines.push(` */`);
    lines.push(``);
  }

  for (const pin of chip.pins) {
    const tag = pin.tags?.find((t) => t === 'debug-sdi' || t === 'debug-swd');
    if (!tag || !state.assignments[pin.pos]) continue;
    const asgn = state.assignments[pin.pos];
    if (asgn.peripheral === 'SDI' || asgn.peripheral === 'SYS') continue;
    lines.push(
      `// WARNING: Pin ${pin.pos} (${pin.name}) is a ${tag} debug pin; repurposing it may disable debugging.`,
    );
  }
  if (lines[lines.length - 1] !== '') lines.push(``);

  lines.push(...renderStruct(chip, state, bindings, 'ch32_hal::Peripherals'));
  return lines.join('\n') + '\n';
}

/** ESP32 output: esp-hal init, GPIO-number pads, and matrix route comments. */
function formatEsp32(chip: ChipData, state: WorkspaceState): string {
  const bindings = collectBindings(chip, state);
  const lines = [
    ...headerLines(chip),
    `// Mux model: GPIO matrix with direct IO_MUX routes`,
    `use esp_hal::peripherals;`,
    ``,
    `/// Initialize ESP32 peripherals. Call once at startup.`,
    `pub fn init() -> esp_hal::Peripherals {`,
    `    esp_hal::init(Default::default())`,
    `}`,
    ``,
  ];

  const entries = bindings.sortedPeripherals.flatMap((p) => bindings.grouped.get(p)!);
  if (entries.length > 0) {
    lines.push(`// Matrix routes in use:`);
    for (const entry of entries) {
      lines.push(
        `//   ${entry.peripheral}_${entry.signal}: ${entry.pinName} (pin ${entry.pos}) [${entry.muxLabel}]`,
      );
    }
    lines.push(``);
  }

  lines.push(...renderStruct(chip, state, bindings, 'esp_hal::Peripherals'));
  return lines.join('\n') + '\n';
}

/**
 * Generate a Rust `BoardPins` struct for the chip's vendor.
 * STM32 keeps the original embassy-stm32 output; RP, CH32, and ESP32 emit
 * their own crates, init helpers, and mux comments derived from
 * `formatMuxLabel`.
 */
export function exportEmbassyRust(chip: ChipData, state: WorkspaceState): string {
  switch (getChipVendor(chip)) {
    case 'rp':
      return formatRp(chip, state);
    case 'ch32':
      return formatCh32(chip, state);
    case 'esp32':
      return formatEsp32(chip, state);
    default:
      return formatStm32(chip, state);
  }
}
