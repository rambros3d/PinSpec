/**
 * Curated official ST board presets for seeding a PinCraft workspace.
 *
 * Source: STMicroelectronics/STM32_open_pin_data, `boards/*.ioc` (BSD-3-Clause).
 * Pin assignments, labels and lock flags below are transcribed from those
 * board configuration files and joined to catalog part IDs. This is a small
 * hand-verified subset; the 281 upstream board files remain read-only
 * reference data and are not shipped with the static site.
 */
import {
  buildWorkspaceFromPins,
  type IocImportResult,
  type IocPinEntry,
} from '../core/importers/ioc';
import type { CatalogIndexEntry, ChipData } from '../core/types';

/** One official ST board configuration keyed by its concrete catalog MCU ID. */
export interface BoardPreset {
  /** Stable local identifier used in the UI. */
  id: string;
  /** Board name from the upstream `board` field. */
  board: string;
  /** Concrete MCU ID from the catalog. */
  mcuId: string;
  /** Upstream template part ID with its temperature wildcard. */
  sourcePartId: string;
  /** Package declared in the upstream board file. */
  package: string;
  /** Short, factual description of the board family. */
  description: string;
  /** Pin declarations keyed by normalized GPIO name. */
  pins: IocPinEntry[];
}

/** Curated Nucleo presets that resolve to catalog-covered STM32 parts. */
export const BOARD_PRESETS: readonly BoardPreset[] = [
  {
    id: 'nucleo-f401re',
    board: 'NUCLEO-F401RE',
    mcuId: 'STM32F401RET6',
    sourcePartId: 'STM32F401RETx',
    package: 'LQFP64',
    description: 'STM32F4 Nucleo board with USART2, SWD, user LED and button.',
    pins: [
      { pinName: 'PA13', locked: true, label: 'TMS', mode: 'Trace_Asynchronous_SW', signal: 'SYS_JTMS-SWDIO' },
      { pinName: 'PA14', locked: true, label: 'TCK', mode: 'Trace_Asynchronous_SW', signal: 'SYS_JTCK-SWCLK' },
      { pinName: 'PA2', locked: true, label: 'USART_TX', mode: 'Asynchronous', signal: 'USART2_TX' },
      { pinName: 'PA3', locked: true, label: 'USART_RX', mode: 'Asynchronous', signal: 'USART2_RX' },
      { pinName: 'PA5', locked: true, label: 'LD2 [Green Led]', signal: 'GPIO_Output' },
      { pinName: 'PB3', locked: true, label: 'SWO', mode: 'Trace_Asynchronous_SW', signal: 'SYS_JTDO-SWO' },
      { pinName: 'PC13', locked: true, label: 'B1 [Blue PushButton]', signal: 'GPXTI13' },
      { pinName: 'PC14', locked: true, mode: 'LSE-External-Oscillator', signal: 'RCC_OSC32_IN' },
      { pinName: 'PC15', locked: true, mode: 'LSE-External-Oscillator', signal: 'RCC_OSC32_OUT' },
      { pinName: 'PH0', locked: true, mode: 'HSE-External-Clock-Source', signal: 'RCC_OSC_IN' },
      { pinName: 'PH1', locked: true, mode: 'HSE-External-Clock-Source', signal: 'RCC_OSC_OUT' },
    ],
  },
  {
    id: 'nucleo-f411re',
    board: 'NUCLEO-F411RE',
    mcuId: 'STM32F411RET6',
    sourcePartId: 'STM32F411RETx',
    package: 'LQFP64',
    description: 'STM32F4 Nucleo board with USART2, SWD, user LED and button.',
    pins: [
      { pinName: 'PA13', locked: true, label: 'TMS', mode: 'Serial-Wire', signal: 'SYS_JTMS-SWDIO' },
      { pinName: 'PA14', locked: true, label: 'TCK', mode: 'Serial-Wire', signal: 'SYS_JTCK-SWCLK' },
      { pinName: 'PA2', locked: true, label: 'USART_TX', mode: 'Asynchronous', signal: 'USART2_TX' },
      { pinName: 'PA3', locked: true, label: 'USART_RX', mode: 'Asynchronous', signal: 'USART2_RX' },
      { pinName: 'PA5', locked: true, label: 'LD2 [Green Led]', signal: 'GPIO_Output' },
      { pinName: 'PB3', locked: true, label: 'SWO', signal: 'SYS_JTDO-SWO' },
      { pinName: 'PC13', locked: true, label: 'B1 [Blue PushButton]', signal: 'GPXTI13' },
      { pinName: 'PC14', locked: true, mode: 'LSE-External-Oscillator', signal: 'RCC_OSC32_IN' },
      { pinName: 'PC15', locked: true, mode: 'LSE-External-Oscillator', signal: 'RCC_OSC32_OUT' },
      { pinName: 'PH0', locked: true, mode: 'HSE-External-Clock-Source', signal: 'RCC_OSC_IN' },
      { pinName: 'PH1', locked: true, mode: 'HSE-External-Clock-Source', signal: 'RCC_OSC_OUT' },
    ],
  },
  {
    id: 'nucleo-f103rb',
    board: 'NUCLEO-F103RB',
    mcuId: 'STM32F103RBT6',
    sourcePartId: 'STM32F103RBTx',
    package: 'LQFP64',
    description: 'STM32F1 Nucleo board with AFIO debug signals and LSE/HSE oscillators.',
    pins: [
      { pinName: 'PA13', locked: true, label: 'TMS', mode: 'Serial_Wire', signal: 'SYS_JTMS-SWDIO' },
      { pinName: 'PA14', locked: true, label: 'TCK', mode: 'Serial_Wire', signal: 'SYS_JTCK-SWCLK' },
      { pinName: 'PA2', locked: true, label: 'USART_TX', mode: 'Asynchronous', signal: 'USART2_TX' },
      { pinName: 'PA3', locked: true, label: 'USART_RX', mode: 'Asynchronous', signal: 'USART2_RX' },
      { pinName: 'PA5', locked: true, label: 'LD2 [Green Led]', signal: 'GPIO_Output' },
      { pinName: 'PB3', locked: true, label: 'SWO', signal: 'SYS_JTDO-TRACESWO' },
      { pinName: 'PC13', locked: true, label: 'B1 [Blue PushButton]', signal: 'GPXTI13' },
      { pinName: 'PC14', locked: true, mode: 'LSE-External-Oscillator', signal: 'RCC_OSC32_IN' },
      { pinName: 'PC15', locked: true, mode: 'LSE-External-Oscillator', signal: 'RCC_OSC32_OUT' },
      { pinName: 'PD0', locked: true, mode: 'HSE-External-Clock-Source', signal: 'RCC_OSC_IN' },
      { pinName: 'PD1', locked: true, mode: 'HSE-External-Clock-Source', signal: 'RCC_OSC_OUT' },
    ],
  },
  {
    id: 'nucleo-f446re',
    board: 'NUCLEO-F446RE',
    mcuId: 'STM32F446RET6',
    sourcePartId: 'STM32F446RETx',
    package: 'LQFP64',
    description: 'STM32F4 Nucleo board with USART2, SWD, user LED and button.',
    pins: [
      { pinName: 'PA13', locked: true, label: 'TMS', mode: 'Serial-Wire', signal: 'SYS_JTMS-SWDIO' },
      { pinName: 'PA14', locked: true, label: 'TCK', mode: 'Serial-Wire', signal: 'SYS_JTCK-SWCLK' },
      { pinName: 'PA2', locked: true, label: 'USART_TX', mode: 'Asynchronous', signal: 'USART2_TX' },
      { pinName: 'PA3', locked: true, label: 'USART_RX', mode: 'Asynchronous', signal: 'USART2_RX' },
      { pinName: 'PA5', locked: true, label: 'LD2 [Green Led]', signal: 'GPIO_Output' },
      { pinName: 'PB3', locked: true, label: 'SWO', signal: 'SYS_JTDO-SWO' },
      { pinName: 'PC13', locked: true, label: 'B1 [Blue PushButton]', signal: 'GPXTI13' },
      { pinName: 'PC14', locked: true, mode: 'LSE-External-Oscillator', signal: 'RCC_OSC32_IN' },
      { pinName: 'PC15', locked: true, mode: 'LSE-External-Oscillator', signal: 'RCC_OSC32_OUT' },
      { pinName: 'PH0', locked: true, mode: 'HSE-External-Oscillator', signal: 'RCC_OSC_IN' },
      { pinName: 'PH1', locked: true, mode: 'HSE-External-Oscillator', signal: 'RCC_OSC_OUT' },
    ],
  },
  {
    id: 'nucleo-l476rg',
    board: 'NUCLEO-L476RG',
    mcuId: 'STM32L476RGT6',
    sourcePartId: 'STM32L476RGTx',
    package: 'LQFP64',
    description: 'STM32L4 Nucleo board with USART2, SWD, user LED and button.',
    pins: [
      { pinName: 'PA13', locked: true, label: 'TMS', mode: 'Serial-Wire', signal: 'SYS_JTMS-SWDIO' },
      { pinName: 'PA14', locked: true, label: 'TCK', mode: 'Serial-Wire', signal: 'SYS_JTCK-SWCLK' },
      { pinName: 'PA2', locked: true, label: 'USART_TX', mode: 'Asynchronous', signal: 'USART2_TX' },
      { pinName: 'PA3', locked: true, label: 'USART_RX', mode: 'Asynchronous', signal: 'USART2_RX' },
      { pinName: 'PA5', locked: true, label: 'LD2 [green Led]', signal: 'GPIO_Output' },
      { pinName: 'PB3', locked: true, label: 'SWO', signal: 'SYS_JTDO-SWO' },
      { pinName: 'PC13', locked: true, label: 'B1 [Blue PushButton]', signal: 'GPXTI13' },
      { pinName: 'PC14', locked: true, mode: 'LSE-External-Oscillator', signal: 'RCC_OSC32_IN' },
      { pinName: 'PC15', locked: true, mode: 'LSE-External-Oscillator', signal: 'RCC_OSC32_OUT' },
      { pinName: 'PH0', locked: true, signal: 'RCC_OSC_IN' },
      { pinName: 'PH1', locked: true, signal: 'RCC_OSC_OUT' },
    ],
  },
  {
    id: 'nucleo-g474re',
    board: 'NUCLEO-G474RE',
    mcuId: 'STM32G474RET6',
    sourcePartId: 'STM32G474RETx',
    package: 'LQFP64',
    description: 'STM32G4 Nucleo board with LPUART1, SWD, user LED and button.',
    pins: [
      { pinName: 'PA13', locked: true, label: 'T_SWDIO', mode: 'Trace_Asynchronous_SW', signal: 'SYS_JTMS-SWDIO' },
      { pinName: 'PA14', locked: true, label: 'T_SWCLK', mode: 'Trace_Asynchronous_SW', signal: 'SYS_JTCK-SWCLK' },
      { pinName: 'PA2', locked: true, label: 'LPUART1_TX [STLINKV3E_VCP_RX]', mode: 'Asynchronous', signal: 'LPUART1_TX' },
      { pinName: 'PA3', locked: true, label: 'LPUART1_RX [STLINKV3E_VCP_TX]', mode: 'Asynchronous', signal: 'LPUART1_RX' },
      { pinName: 'PA5', locked: true, label: 'LD2 [green led]', signal: 'GPIO_Output' },
      { pinName: 'PB3', locked: true, label: 'T_SWO', mode: 'Trace_Asynchronous_SW', signal: 'SYS_JTDO-SWO' },
      { pinName: 'PC13', locked: true, label: 'B1 [blue push button]', signal: 'GPXTI13' },
      { pinName: 'PC14', locked: true, label: 'RCC_OSC32_IN', mode: 'LSE-External-Oscillator', signal: 'RCC_OSC32_IN' },
      { pinName: 'PC15', locked: true, label: 'RCC_OSC32_OUT', mode: 'LSE-External-Oscillator', signal: 'RCC_OSC32_OUT' },
      { pinName: 'PF0', locked: true, label: 'RCC_OSC_IN', mode: 'HSE-External-Oscillator', signal: 'RCC_OSC_IN' },
      { pinName: 'PF1', locked: true, label: 'RCC_OSC_OUT', mode: 'HSE-External-Oscillator', signal: 'RCC_OSC_OUT' },
    ],
  },
];

/** Look up a preset by its stable identifier. */
export function getBoardPreset(id: string): BoardPreset | undefined {
  return BOARD_PRESETS.find((preset) => preset.id === id);
}

/** List presets targeting a specific catalog MCU. */
export function findBoardPresets(mcuId: string): BoardPreset[] {
  const target = mcuId.trim().toUpperCase();
  return BOARD_PRESETS.filter((preset) => preset.mcuId.toUpperCase() === target);
}

/**
 * Confirm a preset's MCU is present in the catalog before a workspace opens,
 * so an unavailable part reports a clear message instead of a broken view.
 */
export function resolveBoardPreset(
  preset: BoardPreset,
  index: CatalogIndexEntry[],
): { ok: true; mcuId: string } | { ok: false; error: string } {
  const mcuId = preset.mcuId.toUpperCase();
  if (index.some((entry) => entry.id.toUpperCase() === mcuId)) {
    return { ok: true, mcuId };
  }
  return {
    ok: false,
    error: `Board preset ${preset.board} targets ${preset.mcuId}, which is not in the catalog.`,
  };
}

/** Build a version-2 workspace state for a preset against a loaded chip shard. */
export function buildBoardPresetState(
  preset: BoardPreset,
  chip: ChipData,
): IocImportResult {
  return buildWorkspaceFromPins(preset.pins, { chip, mcuId: chip.id });
}
