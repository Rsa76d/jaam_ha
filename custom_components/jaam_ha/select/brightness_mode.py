"""Brightness mode select for jaam_ha."""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.jaam_ha.brightness import (
    BRIGHTNESS_MODES,
    async_set_brightness_value,
    get_brightness_data,
    get_brightness_value,
)
from custom_components.jaam_ha.entity import JaamHAEntity
from homeassistant.components.select import SelectEntity, SelectEntityDescription
from homeassistant.const import EntityCategory

if TYPE_CHECKING:
    from custom_components.jaam_ha.coordinator import JaamHADataUpdateCoordinator


ENTITY_DESCRIPTIONS = (
    SelectEntityDescription(
        key="brightness_mode",
        translation_key="brightness_mode",
        icon="mdi:brightness-auto",
        entity_category=EntityCategory.CONFIG,
        has_entity_name=True,
    ),
)


class JaamHABrightnessModeSelect(SelectEntity, JaamHAEntity):
    """Brightness mode: off / day-night / light sensor."""

    def __init__(
        self,
        coordinator: JaamHADataUpdateCoordinator,
        entity_description: SelectEntityDescription,
    ) -> None:
        """Initialize the select entity."""
        super().__init__(coordinator, entity_description)

    @property
    def available(self) -> bool:
        """Return if entity is available."""
        return (
            self.coordinator.last_update_success
            and get_brightness_value(self.coordinator.data, self.entity_description.key) is not None
        )

    @property
    def options(self) -> list[str]:
        """Return available modes; the sensor mode only when a light sensor is present."""
        brightness = get_brightness_data(self.coordinator.data) or {}
        options = ["off", "day_night"]
        if brightness.get("sensor") or brightness.get("mode") == BRIGHTNESS_MODES["sensor"]:
            options.append("sensor")
        return options

    @property
    def current_option(self) -> str | None:
        """Return the current mode."""
        mode = get_brightness_value(self.coordinator.data, self.entity_description.key)
        for option, mode_id in BRIGHTNESS_MODES.items():
            if mode_id == mode:
                return option
        return None

    async def async_select_option(self, option: str) -> None:
        """Change the brightness mode."""
        if option not in BRIGHTNESS_MODES:
            return
        await async_set_brightness_value(self.coordinator, self.entity_description.key, BRIGHTNESS_MODES[option])
