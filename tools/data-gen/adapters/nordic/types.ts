/** Normalized intermediate records from the Nordic SVD, DTS, pinctrl, and KiCad readers. */

/** Peripheral inventory from one CMSIS-SVD file. */
export interface SvdDevice {
  name: string;
  series: string;
  cpuNames: string[];
  peripherals: string[];
  interrupts: string[];
  addressBlockBytes: Record<string, number>;
}

/** GPIO port counts and flash size from a Zephyr device tree. */
export interface DeviceTree {
  file: string;
  gpioPorts: Array<{ port: number; ngpios: number | null }>;
  flashKb: number | null;
  ramKb: number | null;
  interrupts: string[];
  peripherals: string[];
}

/** One PSEL function from the Zephyr pinctrl binding/header. */
export interface PselFunction {
  funcLabel: string;
  peripheral: string;
  signal: string;
  /** PSEL arguments found in binding examples, when present. */
  examples: string[];
}

/** One physical pin from a KiCad Nordic symbol. */
export interface KicadPin {
  number: string;
  name: string;
  electrical: string;
}

/** One Nordic symbol and its physical pins. */
export interface KicadSymbol {
  name: string;
  footprint: string;
  pins: KicadPin[];
  hasExposedPad: boolean;
}
