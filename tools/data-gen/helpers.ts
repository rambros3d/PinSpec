import type { PackageInfo, PeripheralKind, PinType } from '../../src/core/types';

/**
 * Expands ST parenthesized RefName variants into concrete part numbers.
 * Examples:
 *   "STM32G431C(6-8-B)Ux" -> ["STM32G431C6Ux", "STM32G431C8Ux", "STM32G431CBUx"]
 *   "STM32F411C(C-E)Ux"   -> ["STM32F411CCUx", "STM32F411CEUx"]
 *   "STM32H743VITx"       -> ["STM32H743VITx"]
 */
export function expandRefNameVariants(refName: string): string[] {
  const match = refName.match(/\(([^()]+)\)/);
  if (!match) return [refName];

  const options = match[1].split('-').map((s) => s.trim()).filter(Boolean);
  const results: string[] = [];
  for (const opt of options) {
    const replaced = refName.replace(match[0], opt);
    results.push(...expandRefNameVariants(replaced));
  }
  return results;
}

/**
 * Converts a CubeMX template RefName (e.g. "STM32G431CBUx" or "STM32U575RITxQ")
 * into a canonical commercial part ID ("STM32G431CBU6", "STM32U575RIT6Q").
 */
export function canonicalizePartId(refName: string): string {
  // Replace lowercase temperature-grade wildcard 'x' after package letter with '6'
  return refName.replace(/([A-Z])x([A-Z0-9]*)$/, '$16$2');
}

/**
 * Extracts the Embassy base chip stem from a RefName / Part ID.
 * Examples:
 *   "STM32G431CBUx"  -> "STM32G431CB"
 *   "STM32U575RITxQ" -> "STM32U575RI"
 *   "STM32F103C8Tx"  -> "STM32F103C8"
 *   "STM32H743XIHx"  -> "STM32H743XI"
 */
export function extractEmbassyStem(partName: string): string {
  // Standard STM32 pattern: STM32 + family(2) + subline(2) + pincount(1) + flash(1) + package(1) + temp(1) + optional variant
  const cleaned = partName.trim();
  const m = cleaned.match(/^(STM32[A-Z0-9]{2}[0-9A-Z]{2}[A-Z][0-9A-Z])/);
  if (m) return m[1];
  return cleaned.slice(0, 11);
}

/**
 * Extracts all underlying GPIO names from a pin label.
 * Examples:
 *   "PA0" -> ["PA0"]
 *   "PA11 [PA9]" -> ["PA11", "PA9"]
 *   "PC14-OSC32_IN (PC14)" -> ["PC14"]
 *   "PC13-ANTI_TAMP" -> ["PC13"]
 *   "PA0-WKUP" -> ["PA0"]
 */
export function extractGpioNames(rawName: string): string[] {
  const matches = rawName.match(/\bP[A-K][0-9]{1,2}\b/g);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

export function normalizePinType(rawType: string | undefined, rawName: string): PinType {
  const t = (rawType ?? '').toLowerCase();
  const upperName = rawName.toUpperCase();
  if (t === 'power' || /^(VDD|VSS|VBAT|VREF|VCAP|VBUS|VLXSMPS|VDDSMPS|VSSSMPS)/.test(upperName)) {
    return 'power';
  }
  if (t === 'reset' || upperName === 'NRST') return 'reset';
  if (t === 'boot' || /^BOOT[0-9]?$/.test(upperName)) return 'boot';
  if (t === 'nc' || upperName === 'NC') return 'nc';
  if (t === 'monoio' || t === 'mono') return 'mono';
  if (t === 'i/o' || t === 'io') return 'io';
  return 'io';
}

export function classifyPeripheralKind(
  peripheralName: string,
  embassyKind?: string,
): PeripheralKind {
  const kind = (embassyKind ?? '').toLowerCase();
  const name = peripheralName.toUpperCase();

  if (kind === 'spi' || /^SPI\d/.test(name) || /^I2S\d/.test(name)) return 'spi';
  if (kind === 'i2c' || /^I2C\d/.test(name) || /^I3C\d/.test(name) || /^FMPI2C/.test(name)) return 'i2c';
  if (
    kind === 'usart' ||
    kind === 'uart' ||
    kind === 'lpuart' ||
    /^(USART|UART|LPUART)\d/.test(name)
  ) {
    return 'usart';
  }
  if (
    kind === 'timer' ||
    kind === 'tim' ||
    kind === 'lptim' ||
    kind === 'hrtim' ||
    /^(TIM|LPTIM|HRTIM)\d/.test(name)
  ) {
    return 'tim';
  }
  if (kind === 'adc' || /^ADC\d/.test(name)) return 'adc';
  if (kind === 'dac' || /^DAC\d/.test(name)) return 'dac';
  if (kind === 'can' || kind === 'fdcan' || /^(CAN|FDCAN)\d?/.test(name)) return 'can';
  if (
    kind === 'usb' ||
    kind === 'otg' ||
    /^USB/.test(name) ||
    /^OTG_/.test(name)
  ) {
    return 'usb';
  }
  if (
    name === 'SYS' ||
    name === 'DEBUG' ||
    name === 'RCC' ||
    kind === 'rcc'
  ) {
    return 'sys';
  }
  return 'other';
}

/**
 * Compares BGA/WLCSP row labels in JEDEC order: A..Z before AA..AZ.
 */
export function compareGridRows(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a.localeCompare(b);
}

/**
 * Derives PackageInfo (perimeter sides or BGA/WLCSP ordered rows & cols)
 * from package name and actual pin positions.
 */
export function buildPackageInfo(
  packageName: string,
  positions: string[],
): PackageInfo {
  const uniquePositions = Array.from(new Set(positions));
  const pinCount = uniquePositions.length;
  const upperPkg = packageName.toUpperCase();

  const hasAlphaGridPos = uniquePositions.some((pos) => /^[A-Z]{1,2}\d+$/.test(pos));
  const isGridPkg =
    hasAlphaGridPos ||
    /BGA|WLCSP|CSP|EWLCSP|TCSP/.test(upperPkg);

  if (isGridPkg) {
    const rowSet = new Set<string>();
    const colSet = new Set<number>();
    for (const pos of uniquePositions) {
      const m = pos.match(/^([A-Z]{1,2})(\d+)$/);
      if (m) {
        rowSet.add(m[1]);
        colSet.add(Number.parseInt(m[2], 10));
      }
    }
    const rows = Array.from(rowSet).sort(compareGridRows);
    const cols = Array.from(colSet).sort((a, b) => a - b);
    return {
      name: packageName,
      kind: 'grid',
      pinCount,
      rows,
      cols,
    };
  }

  // Perimeter package: derive [left, bottom, right, top]
  const isTwoSided = /^(TSSOP|SO|SOIC|DIP|PDIP|SSOP|MSOP|DFN|WSON|UDFN)/.test(upperPkg);
  if (isTwoSided) {
    const left = Math.ceil(pinCount / 2);
    const right = pinCount - left;
    return {
      name: packageName,
      kind: 'perimeter',
      pinCount,
      sides: [left, 0, right, 0],
    };
  }

  // 4-sided packages (LQFP, QFN, UFQFPN, UQFN, VFQFPN, TQFP, etc.)
  if (pinCount % 4 === 0) {
    const perSide = pinCount / 4;
    return {
      name: packageName,
      kind: 'perimeter',
      pinCount,
      sides: [perSide, perSide, perSide, perSide],
    };
  }

  // Rectangular 4-sided fallback (e.g., 28-pin, 36-pin, 42-pin, etc.)
  const base = Math.floor(pinCount / 4);
  const rem = pinCount % 4;
  const left = base + (rem >= 1 ? 1 : 0);
  const right = base + (rem >= 2 ? 1 : 0);
  const bottom = base + (rem >= 3 ? 1 : 0);
  const top = base;
  return {
    name: packageName,
    kind: 'perimeter',
    pinCount,
    sides: [left, bottom, right, top],
  };
}

/**
 * Formats Embassy core names ("cm4", "cm7", "cm0p", "cm33") into clean human labels.
 */
export function normalizeCoreName(rawCore: string | undefined): string {
  if (!rawCore) return 'Cortex-M';
  const cleaned = rawCore.replace(/^ARM\s+/i, '').trim();
  const lower = cleaned.toLowerCase();
  if (lower === 'cm0') return 'Cortex-M0';
  if (lower === 'cm0p' || lower === 'cm0+') return 'Cortex-M0+';
  if (lower === 'cm3') return 'Cortex-M3';
  if (lower === 'cm4') return 'Cortex-M4';
  if (lower === 'cm7') return 'Cortex-M7';
  if (lower === 'cm33') return 'Cortex-M33';
  if (lower === 'cm55') return 'Cortex-M55';
  return cleaned;
}

/**
 * Splits an ST XML signal name like "SYS_JTMS-SWDIO" or "SPI1_SCK" or "RCC_OSC_IN"
 * into { peripheral, signal }.
 */
export function parseXmlSignalName(rawSignal: string): { peripheral: string; signal: string } | null {
  if (!rawSignal || rawSignal === 'GPIO') return null;
  const idx = rawSignal.indexOf('_');
  if (idx <= 0 || idx === rawSignal.length - 1) return null;

  // Handle two-word peripheral prefixes like USB_OTG_FS_DM, USB_OTG_HS_DP
  const otgMatch = rawSignal.match(/^(USB_OTG_(?:FS|HS))_(.+)$/);
  if (otgMatch) {
    return { peripheral: otgMatch[1], signal: otgMatch[2] };
  }

  const peripheral = rawSignal.slice(0, idx);
  const signal = rawSignal.slice(idx + 1);
  return { peripheral, signal };
}

/**
 * Normalizes SYS debug signal names so SWD/JTAG mode templates match reliably across families.
 */
export function normalizeSysSignals(signal: string): string[] {
  if (signal === 'JTMS-SWDIO') return ['SWDIO', 'JTMS'];
  if (signal === 'JTCK-SWCLK') return ['SWCLK', 'JTCK'];
  if (signal === 'JTDO-SWO' || signal === 'JTDO-TRACESWO') return ['JTDO', 'SWO'];
  if (signal === 'JTRST') return ['NJTRST'];
  return [signal];
}
