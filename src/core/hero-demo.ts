/**
 * Vendor-neutral hero demo builder. Derives a small, conflict-free demo
 * assignment set from the peripherals actually available on a generated chip
 * instead of assuming STM32 signal names.
 */

import { allocatePeripheralMode, createEmptyWorkspace, getModesForPeripheral } from './solver';
import type { ChipData, WorkspaceState } from './types';

interface DemoRecipe {
  peripheral: string;
  modes: string[];
  labels?: Record<string, string>;
}

const DEMO_RECIPES: DemoRecipe[] = [
  {
    peripheral: 'SYS',
    modes: ['swd', 'jtag'],
    labels: { SWDIO: 'DBG_DATA', SWCLK: 'DBG_CLK' },
  },
  {
    peripheral: 'SPI1',
    modes: ['full_duplex'],
    labels: { SCK: 'BUS_CLK', MISO: 'BUS_MISO', MOSI: 'BUS_MOSI' },
  },
  {
    peripheral: 'UART0',
    modes: ['async'],
    labels: { TX: 'DBG_TX', RX: 'DBG_RX' },
  },
  {
    peripheral: 'USART1',
    modes: ['async'],
    labels: { TX: 'DBG_TX', RX: 'DBG_RX' },
  },
  {
    peripheral: 'USART2',
    modes: ['async'],
    labels: { TX: 'DBG_TX', RX: 'DBG_RX' },
  },
  {
    peripheral: 'SPI0',
    modes: ['full_duplex'],
    labels: { SCK: 'BUS_CLK', RX: 'BUS_MISO', TX: 'BUS_MOSI' },
  },
  {
    peripheral: 'I2C0',
    modes: ['i2c'],
    labels: { SCL: 'I2C_SCL', SDA: 'I2C_SDA' },
  },
  {
    peripheral: 'TIM1',
    modes: ['pwm_3phase_comp', 'pwm_2ch', 'pwm_1ch'],
    labels: {
      CH1: 'MOTOR_UH',
      CH1N: 'MOTOR_UL',
      CH2: 'MOTOR_VH',
      CH2N: 'MOTOR_VL',
      CH3: 'MOTOR_WH',
      CH3N: 'MOTOR_WL',
    },
  },
  {
    peripheral: 'I2C1',
    modes: ['i2c'],
    labels: { SCL: 'I2C_SCL', SDA: 'I2C_SDA' },
  },
  {
    peripheral: 'UART1',
    modes: ['async'],
    labels: { TX: 'DBG_TX', RX: 'DBG_RX' },
  },
  {
    peripheral: 'SPI1',
    modes: ['half_duplex'],
    labels: { SCK: 'BUS_CLK', MOSI: 'BUS_MOSI' },
  },
];

const MAX_DEMO_PERIPHERALS = 4;

/**
 * Build the hero demo state for any generated chip. Only peripherals present
 * on the chip and modes valid for their kind are activated.
 */
export function buildHeroDemoState(chip: ChipData): WorkspaceState {
  let state = createEmptyWorkspace(chip.id);
  let activated = 0;

  for (const recipe of DEMO_RECIPES) {
    if (activated >= MAX_DEMO_PERIPHERALS) break;
    const info = chip.peripherals[recipe.peripheral];
    if (!info) continue;

    const available = getModesForPeripheral(chip, recipe.peripheral);
    const mode = recipe.modes.find((id) => available.some((m) => m.id === id));
    if (!mode) continue;

    const before = Object.keys(state.assignments).length;
    state = allocatePeripheralMode(chip, state, recipe.peripheral, mode).state;
    if (Object.keys(state.assignments).length === before && !state.peripheralModes[recipe.peripheral]) {
      continue;
    }
    activated += 1;

    if (recipe.labels) {
      for (const [pos, asgn] of Object.entries(state.assignments)) {
        if (asgn.peripheral === recipe.peripheral && recipe.labels[asgn.signal]) {
          state.labels[pos] = recipe.labels[asgn.signal];
        }
      }
    }
  }

  return state;
}
