"""Current brightness sensors (map and display) for jaam_ha."""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.jaam_ha.brightness import get_brightness_value
from custom_components.jaam_ha.entity import JaamHAEntity
from homeassistant.components.sensor import SensorEntity, SensorEntityDescription, SensorStateClass
from homeassistant.const import PERCENTAGE

if TYPE_CHECKING:
    from custom_components.jaam_ha.coordinator import JaamHADataUpdateCoordinator


ENTITY_DESCRIPTIONS = (
    SensorEntityDescription(
        key="brightness_current",
        translation_key="brightness_current",
        native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        icon="mdi:brightness-percent",
        has_entity_name=True,
    ),
    SensorEntityDescription(
        key="display_brightness_current",
        translation_key="display_brightness_current",
        native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        icon="mdi:monitor-shimmer",
        has_entity_name=True,
    ),
)


class JaamHABrightnessSensor(SensorEntity, JaamHAEntity):
    """Current map/display brightness, %."""

    def __init__(
        self,
        coordinator: JaamHADataUpdateCoordinator,
        entity_description: SensorEntityDescription,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, entity_description)

    @property
    def available(self) -> bool:
        """Return if entity is available."""
        return (
            self.coordinator.last_update_success
            and get_brightness_value(self.coordinator.data, self.entity_description.key) is not None
        )

    @property
    def native_value(self) -> int | None:
        """Return the current brightness."""
        value = get_brightness_value(self.coordinator.data, self.entity_description.key)
        try:
            return int(value) if value is not None else None
        except (TypeError, ValueError):
            return None
