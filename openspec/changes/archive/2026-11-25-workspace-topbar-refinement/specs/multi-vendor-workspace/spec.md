# Spec Delta

## MODIFIED Requirements

### Requirement: Catalog discovery is vendor aware

Quick search and the MCU switcher SHALL expose vendor filter tabs and
vendor-aware family/package filters, and SHALL restrict results and the MCU list
to the selected vendor and filters. The vendor set SHALL include `esp32` in
addition to the existing three vendors, and the compatible-MCU finder SHALL
offer the same vendor filter options. The MCU switcher SHALL remain available
from the global top bar on workspace and shared routes with that same vendor
filter behavior.

#### Scenario: Filter to RP parts

- **WHEN** a user selects the RP vendor tab and searches by family or package
- **THEN** only RP chips matching the family/package filters are listed

#### Scenario: Clear vendor filter

- **WHEN** the user clears the vendor tab
- **THEN** chips from all vendors are listed again

#### Scenario: Filter to ESP32 parts

- **WHEN** a user selects the ESP32 vendor tab and searches by family or package
- **THEN** only ESP32 chips matching the family/package filters are listed

#### Scenario: Compatible-MCU vendor options

- **WHEN** the compatible-MCU finder vendor filter is opened
- **THEN** it offers STM32, CH32, RP, and ESP32 and can restrict candidates to ESP32

#### Scenario: MCU switcher from the global bar

- **WHEN** a workspace or shared route is opened and the user activates the MCU switcher in the global bar
- **THEN** the same vendor-filtered MCU list opens as from the previous workspace toolbar

#### Scenario: Chip pill retained in the workspace action cluster

- **WHEN** the left-edge title shows the project name on a workspace or shared route
- **THEN** the chip-id switcher button is still present in the workspace action cluster and still opens the vendor-filtered MCU list

#### Scenario: Chip id is not duplicated at the left edge

- **WHEN** a workspace route is opened with a loaded chip and a named project
- **THEN** the chip id appears in the switcher pill and not in a separate left-edge route title
