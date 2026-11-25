# multi-vendor-ci-gates Delta

## MODIFIED Requirements

### Requirement: Multi-vendor documentation and attribution

`README.md` and `AGENTS.md` MUST document multi-vendor data generation, the gate commands, and the verification sequence. About owns the provenance reference: it MUST list all thirteen upstream sources with their licenses and render SHAs and counts from `meta.json`. Documentation MUST cover STM32, CH32, RP, ESP32, SAM, and Nordic generation and MUST NOT claim a landing technical footer.

#### Scenario: Documentation reflects shipped behavior

- **WHEN** the change is complete
- **THEN** README and AGENTS.md describe STM32, CH32, RP, ESP32, SAM, and Nordic generation, the About table lists all thirteen sources with licenses and live metadata, and no landing footer is claimed

#### Scenario: Footer omits a license

- **WHEN** any of the thirteen upstream licenses is missing from About or documentation
- **THEN** the documentation verification check fails

#### Scenario: ESP32 attribution data available

- **WHEN** `meta.json` is generated with the ESP32 adapter registered
- **THEN** the four added ESP32 sources carry license and SHA values that the About table and documentation checks can render

#### Scenario: SAM attribution data available

- **WHEN** `meta.json` is generated with the SAM adapter registered
- **THEN** the Microchip ATDF source carries an Apache-2.0 license and a SHA value that the About table and documentation checks can render

#### Scenario: Nordic attribution data available

- **WHEN** `meta.json` is generated with the Nordic adapter registered
- **THEN** the nrf-pacs source, the Nordic Zephyr and KiCad evidence records, and the `nordic` vendor summary carry license and SHA values that the About table and documentation checks can render
