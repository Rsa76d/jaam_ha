"""Home region energy system status and radiation level sensors for jaam_ha.

Available with firmware that reports `home_energy` / `home_radiation` (e.g. 5.1.2-b3-lux3).
Both values come from the JAAM server for the device's home region; 0 means "no data".
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from custom_components.jaam_ha.entity import JaamHAEntity
from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorEntityDescription, SensorStateClass

if TYPE_CHECKING:
    from custom_components.jaam_ha.coordinator import JaamHADataUpdateCoordinator

# Firmware EnergyStatus codes -> sensor states
ENERGY_STATES: dict[int, str] = {
    3: "sufficient",
    4: "insufficient",
    10: "significant_shortage",
    9: "outage",
}
ENERGY_UNKNOWN = "unknown"
ENERGY_OPTIONS = [*ENERGY_STATES.values(), ENERGY_UNKNOWN]

# Firmware RadiationConfig thresholds, nSv/h
RADIATION_LEVELS: tuple[tuple[int, str], ...] = (
    (300, "normal"),
    (600, "elevated"),
    (1000, "high"),
)
RADIATION_VERY_HIGH = "very_high"

RADIATION_UNIT = "nSv/h"

ENTITY_DESCRIPTIONS = (
    SensorEntityDescription(
        key="home_energy",
        translation_key="home_energy",
        device_class=SensorDeviceClass.ENUM,
        options=ENERGY_OPTIONS,
        icon="mdi:transmission-tower",
        has_entity_name=True,
    ),
    SensorEntityDescription(
        key="home_radiation",
        translation_key="home_radiation",
        native_unit_of_measurement=RADIATION_UNIT,
        state_class=SensorStateClass.MEASUREMENT,
        icon="mdi:radioactive",
        has_entity_name=True,
    ),
)


def radiation_level(value: int) -> str:
    """Return the firmware status name for a radiation value (nSv/h)."""
    for limit, name in RADIATION_LEVELS:
        if value < limit:
            return name
    return RADIATION_VERY_HIGH


class JaamHAHomeEnergyRadiationSensor(SensorEntity, JaamHAEntity):
    """Energy system status / radiation level in the home region."""

    def __init__(
        self,
        coordinator: JaamHADataUpdateCoordinator,
        entity_description: SensorEntityDescription,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, entity_description)

    def _raw(self) -> int | None:
        value = (self.coordinator.data or {}).get(self.entity_description.key)
        try:
            return int(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    @property
    def available(self) -> bool:
        """Return if entity is available."""
        return self.coordinator.last_update_success and self._raw() is not None

    @property
    def native_value(self) -> str | int | None:
        """Return the state: energy status name, or radiation in nSv/h (None if no data)."""
        raw = self._raw()
        if raw is None:
            return None
        if self.entity_description.key == "home_energy":
            return ENERGY_STATES.get(raw, ENERGY_UNKNOWN)
        return raw if raw > 0 else None

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        """Return the raw code (energy) or the level name (radiation)."""
        raw = self._raw()
        if raw is None:
            return None
        if self.entity_description.key == "home_energy":
            return {"status_code": raw}
        return {"level": radiation_level(raw) if raw > 0 else None}
