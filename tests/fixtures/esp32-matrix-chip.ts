import type { ChipData, PinInfo } from '../../src/core/types';

/**
 * Synthetic GPIO-matrix chip used only for host-side unit tests. Values are
 * constructed to exercise routing rules; no catalog data is transcribed here.
 * The adapter in `tools/data-gen` is the sole source of emitted ESP32 facts.
 */

function gpio(pos: string, num: number, extra: Partial<PinInfo> = {}): PinInfo {
  return { pos, name: `GPIO${num}`, type: 'io', signals: [], ...extra };
}

/** A matrix chip with fan-out outputs, single-source inputs, and electrical tags. */
export function makeMatrixChip(): ChipData {
  return {
    id: 'MATRIXTEST',
    vendor: 'esp32',
    muxModel: 'gpio-matrix',
    family: 'MATRIX',
    core: 'Synthetic',
    flashKb: 0,
    ramKb: 520,
    matrixRouteCapacity: 8,
    package: {
      name: 'QFN-32',
      kind: 'perimeter',
      pinCount: 26,
      sides: [7, 0, 7, 0],
    },
    pins: [
      gpio('1', 0, {
        tags: ['strapping'],
        signals: [
          {
            peripheral: 'UART0',
            signal: 'TX',
            af: null,
            funcLabel: 'U0TXD',
            direction: 'output',
            speedCritical: true,
            directRoute: true,
          },
          { peripheral: 'ADC2', signal: 'CH0', af: null, funcLabel: 'ADC2_CH0', direction: 'input' },
        ],
      }),
      gpio('2', 1, {
        signals: [
          {
            peripheral: 'UART0',
            signal: 'TX',
            af: null,
            funcLabel: 'U0TXD',
            direction: 'output',
            speedCritical: true,
          },
        ],
      }),
      gpio('3', 2, {
        tags: ['strapping'],
        signals: [
          { peripheral: 'UART0', signal: 'TX', af: null, direction: 'output' },
        ],
      }),
      gpio('4', 34, {
        tags: ['input-only'],
        signals: [
          { peripheral: 'UART0', signal: 'RX', af: null, direction: 'input' },
          { peripheral: 'SPI2', signal: 'MOSI', af: null, direction: 'output' },
        ],
      }),
      gpio('5', 35, {
        tags: ['input-only'],
        signals: [{ peripheral: 'UART0', signal: 'RX', af: null, direction: 'input' }],
      }),
      gpio('6', 32, {
        tags: ['adc', 'rtc', 'lp'],
        signals: [{ peripheral: 'ADC2', signal: 'CH1', af: null, direction: 'input' }],
      }),
      gpio('7', 4, {
        tags: ['flash'],
        signals: [
          {
            peripheral: 'LEDC',
            signal: 'PWM0A',
            af: null,
            resourceId: 'LEDC0A',
            direction: 'output',
          },
        ],
      }),
      gpio('8', 5, {
        tags: ['psram'],
        signals: [
          {
            peripheral: 'LEDC',
            signal: 'PWM0B',
            af: null,
            resourceId: 'LEDC0B',
            direction: 'output',
          },
        ],
      }),
      gpio('9', 12, {
        tags: ['strapping', 'cap-restricted'],
        signals: [
          {
            peripheral: 'SPI2',
            signal: 'MOSI',
            af: null,
            funcLabel: 'SPI2_MOSI',
            direction: 'output',
          },
        ],
      }),
      ...Array.from({ length: 15 }, (_, i) => {
        const num = 10 + i;
        const signals = [
          {
            peripheral: 'UART0',
            signal: 'TX',
            af: null,
            direction: 'output' as const,
            ...(num === 10 ? { directRoute: true } : {}),
          },
        ];
        if (num === 11) {
          signals.push({ peripheral: 'SPI2', signal: 'MOSI', af: null, direction: 'output' });
        }
        return gpio(String(num), num, { signals });
      }),
    ],
    peripherals: {
      UART0: { kind: 'usart', signals: ['TX', 'RX'] },
      ADC2: { kind: 'adc', signals: ['CH0', 'CH1'] },
      LEDC: { kind: 'pwm', signals: ['PWM0A', 'PWM0B'] },
      SPI2: { kind: 'spi', signals: ['MOSI'] },
      WIFI: { kind: 'other', signals: ['STA'] },
    },
  };
}
