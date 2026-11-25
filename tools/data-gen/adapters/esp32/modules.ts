/** First-party module manifest: names and flash evidence from acquired files. */
import type { GpioToolTarget, KicadSymbol, EspModule } from './types';
import { displayFamily } from './gpio-tool';

/** Known KiCad symbol aliases for first-party die names. */
export const SYMBOL_ALIASES: Record<string, string> = {
  'ESP32-C2': 'ESP8684',
};

/** Resolve a die display name to its fetched KiCad symbol name. */
export function symbolForFamily(display: string, symbols: Map<string, KicadSymbol>): string | null {
  const alias = SYMBOL_ALIASES[display] ?? display;
  return symbols.has(alias) ? alias : null;
}

/**
 * Derive module flash from the KiCad description or from the gpio-tool MPN
 * entry named in that description. No value is assigned without such evidence.
 */
export function buildEspModules(
  symbols: Map<string, KicadSymbol>,
  targets: Map<string, GpioToolTarget>,
): EspModule[] {
  const modules: EspModule[] = [];
  for (const symbol of symbols.values()) {
    // DevKit symbols describe boards, not MCU ICs; only chip modules belong in the catalog.
    if (!/(WROOM|MINI)/.test(symbol.name)) continue;
    let baseFamily = '';
    for (const family of targets.keys()) {
      if (symbol.name.startsWith(`${displayFamily(family)}-`) || symbol.name === displayFamily(family)) {
        if (displayFamily(family).length > baseFamily.length) baseFamily = family;
      }
    }
    if (!baseFamily) continue;
    const descriptionFlash = /(\d+)\s*MB\s*(?:SPI\s*)?flash/i.exec(symbol.description);
    const dieName = /integrates\s+([A-Z0-9-]+)/i.exec(symbol.description)?.[1];
    const socEntry = dieName
      ? Array.from(targets.get(baseFamily)?.soc.values() ?? []).find(
          (soc) => soc.name === dieName || soc.name.startsWith(dieName),
        )
      : undefined;
    const flashKb = descriptionFlash
      ? Number(descriptionFlash[1]) * 1024
      : socEntry?.flashKb ?? null;
    modules.push({
      id: symbol.name,
      baseFamily,
      symbol: symbol.name,
      flashKb,
      flashEvidence: descriptionFlash
        ? 'kicad-symbol-description'
        : socEntry?.flashKb
          ? 'gpio-tool-soc-comment'
          : 'none',
    });
  }
  return modules.sort((a, b) => a.id.localeCompare(b.id));
}
