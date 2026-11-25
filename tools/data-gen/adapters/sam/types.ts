/** Normalized intermediate records produced by the narrow ATDF readers. */

/** One `<variant>` element of an ATDF file. */
export interface AtdfVariant {
  ordercode: string;
  package: string;
  pinout: string;
  speedmax?: string;
  tempmin?: string;
  tempmax?: string;
  vccmin?: string;
  vccmax?: string;
}

/** One `<pin>` element of an ATDF `<pinout>`. */
export interface AtdfPin {
  position?: string;
  pad: string;
}

/** One named pinout of an ATDF part. */
export interface AtdfPinout {
  name: string;
  pins: AtdfPin[];
}

/** One `<signal>` element inside an ATDF module instance. */
export interface AtdfSignal {
  group: string;
  index?: string;
  function: string;
  pad: string;
}

/** A module instance and its declared signals. */
export interface AtdfInstance {
  name: string;
  signals: AtdfSignal[];
}

/** One `<memory-segment>` of the main address space. */
export interface AtdfMemorySegment {
  name: string;
  size?: string;
  type?: string;
}

/** Verified structural facts about the raw ATDF document. */
export interface AtdfShape {
  spdx: boolean;
  pinCount: number;
  signalCount: number;
}

/** A fully normalized ATDF device file. */
export interface AtdfDocument {
  stem: string;
  series?: string;
  architecture?: string;
  variants: AtdfVariant[];
  pinouts: AtdfPinout[];
  instances: AtdfInstance[];
  memories: AtdfMemorySegment[];
  interrupts: string[];
  params: string[];
  shape: AtdfShape;
}
