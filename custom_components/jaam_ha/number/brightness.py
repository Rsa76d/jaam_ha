"""Brightness numbers for jaam_ha: map brightness levels, sensor sensitivity, display brightness."""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.jaam_ha.brightness import async_set_brightness_value, get_brightness_value
from custom_components.jaam_ha.entity import JaamHAEntity
from homeassistant.components.number import NumberEntity, NumberEntityDescription, NumberMode
from homeassistant.const import PERCENTAGE, EntityCategory

if TYPE_CHECKING:
    from custom_components.jaam_ha.coordinator import JaamHADataUpdateCoordinator


def _percent(key: str, icon: str, minimum: float = 0) -> NumberEntityDescription:
    return NumberEntityDescription(
        key=key,
        translation_key=key,
        icon=icon,
        native_min_value=minimum,
        native_max_value=100,
        native_step=1,
        native_unit_of_measurement=PERCENTAGE,
        mode=NumberMode.SLIDER,
        entity_category=EntityCategory.CONFIG,
        has_entity_name=True,
    )


ENTITY_DESCRIPTIONS = (
    _percent("brightness_max", "mdi:brightness-7"),
    _percent("brightness_min_day", "mdi:brightness-5"),
    _percent("brightness_min_night", "mdi:brightness-3"),
    NumberEntityDescription(
        key="light_sensor_sensitivity",
        translation_key="light_sensor_sensitivity",
        icon="mdi:tune-vertical",
        native_min_value=0.01,
        native_max_value=30,
        native_step=0.01,
        mode=NumberMode.SLIDER,
        entity_category=EntityCategory.CONFIG,
        has_entity_name=True,
    ),
    _percent("display_brightness", "mdi:monitor", minimum=1),
    _percent("display_brightness_min", "mdi:monitor-dashboard", minimum=1),
)

# Firmware keeps the order (min night <= min day <= max, display min <= display) and
# broadcasts the corrected values, so HA always shows what the device actually applied.


class JaamHABrightnessNumber(NumberEntity, JaamHAEntity):
    """Brightness setting number."""

    def __init__(
        self,
        coordinator: JaamHADataUpdateCoordinator,
        entity_description: NumberEntityDescription,
    ) -> None:
        """Initialize the number entity."""
        super().__init__(coordinator, entity_description)

    @property
    def available(self) -> bool:
        """Return if entity is available."""
        return (
            self.coordinator.last_update_success
            and get_brightness_value(self.coordinator.data, self.entity_description.key) is not None
        )

    @property
    def native_value(self) -> float | None:
        """Return the current value."""
        value = get_brightness_value(self.coordinator.data, self.entity_description.key)
        try:
            return float(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    async def async_set_native_value(self, value: float) -> None:
        """Set a new value."""
        if self.entity_description.key == "light_sensor_sensitivity":
            send: float | int = round(float(value), 2)
        else:
            send = round(value)
        await async_set_brightness_value(self.coordinator, self.entity_description.key, send)
