/** Normalized intermediate records produced by the pure ESP32 source readers. */

/** One GPIO record from an `esp-gpio-tool` target YAML. */
export interface GpioToolGpio {
  gpio: number;
  powerDomain: string;
  rtc: boolean;
  functions: string[];
  strappingNote?: string;
  /** At-reset pull state, verbatim from first-party evidence. */
  atReset?: 'PUP' | 'PDOWN';
  isOutput: boolean;
}

/** One MPN entry from the `soc:` map of a target YAML. */
export interface GpioToolSoc {
  name: string;
  reservedPins: number[];
  notConnected: number[];
  flashKb: number | null;
  psram: boolean;
}

/** One target YAML converted to plain records. */
export interface GpioToolTarget {
  family: string;
  displayName: string;
  sramKb: number;
  wifi: boolean;
  adc2WifiConflict: boolean;
  gpios: Map<number, GpioToolGpio>;
  soc: Map<string, GpioToolSoc>;
}

/** A numbered function from an `esp-hal` gpio.toml pin entry. */
export interface MetadataFunction {
  id: number;
  name: string;
}

/** One GPIO record from an `esp-hal` gpio.toml. */
export interface MetadataGpio {
  pin: number;
  functions: MetadataFunction[];
  analog: string[];
  lp: string[];
  limitations: string[];
}

/** One matrix signal from an `esp-hal` input_signals or output_signals table. */
export interface MetadataSignal {
  name: string;
  id: number | null;
}

/** One device's combined gpio.toml and soc.toml facts. */
export interface MetadataDevice {
  family: string;
  arch: string;
  cores: number;
  funcInSelOffset: number;
  gpios: Map<number, MetadataGpio>;
  inputSignals: MetadataSignal[];
  outputSignals: MetadataSignal[];
  dmaChannels: number;
}

/** One pin of an Espressif KiCad symbol. */
export interface KicadSymbolPin {
  number: string;
  name: string;
  electrical: string;
}

/** One top-level symbol from `Espressif.kicad_sym`. */
export interface KicadSymbol {
  name: string;
  description: string;
  footprint: string;
  pins: KicadSymbolPin[];
}

/** Physical pad numbers from one footprint. */
export interface KicadFootprint {
  name: string;
  numberedPads: string[];
  hasExposedPad: boolean;
}

/** Signal-count evidence from the pinned `gpio_sig_map.h`. */
export interface EspIdfSignalCounts {
  family: string;
  inputCount: number;
  outputCount: number;
  /** Pin signal names appearing in both the header and esp-metadata. */
  matchedNames: Set<string>;
}

/** A named module or MPN and its first-party flash evidence. */
export interface EspModule {
  id: string;
  baseFamily: string;
  symbol: string;
  flashKb: number | null;
  flashEvidence: string;
}
