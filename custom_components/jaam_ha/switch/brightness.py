"""Brightness switches for jaam_ha: display auto brightness, display off at night."""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.jaam_ha.brightness import async_set_brightness_value, get_brightness_value
from custom_components.jaam_ha.entity import JaamHAEntity
from homeassistant.components.switch import SwitchEntity, SwitchEntityDescription
from homeassistant.const import EntityCategory

if TYPE_CHECKING:
    from custom_components.jaam_ha.coordinator import JaamHADataUpdateCoordinator


ENTITY_DESCRIPTIONS = (
    SwitchEntityDescription(
        key="display_auto_brightness",
        translation_key="display_auto_brightness",
        icon="mdi:brightness-auto",
        entity_category=EntityCategory.CONFIG,
        has_entity_name=True,
    ),
    SwitchEntityDescription(
        key="display_off_at_night",
        translation_key="display_off_at_night",
        icon="mdi:monitor-off",
        entity_category=EntityCategory.CONFIG,
        has_entity_name=True,
    ),
)


class JaamHABrightnessSwitch(SwitchEntity, JaamHAEntity):
    """Brightness-related switch."""

    def __init__(
        self,
        coordinator: JaamHADataUpdateCoordinator,
        entity_description: SwitchEntityDescription,
    ) -> None:
        """Initialize the switch entity."""
        super().__init__(coordinator, entity_description)

    @property
    def available(self) -> bool:
        """Return if entity is available."""
        return (
            self.coordinator.last_update_success
            and get_brightness_value(self.coordinator.data, self.entity_description.key) is not None
        )

    @property
    def is_on(self) -> bool | None:
        """Return True if the switch is on."""
        value = get_brightness_value(self.coordinator.data, self.entity_description.key)
        return None if value is None else bool(value)

    async def async_turn_on(self, **kwargs) -> None:
        """Turn the switch on."""
        await async_set_brightness_value(self.coordinator, self.entity_description.key, True)

    async def async_turn_off(self, **kwargs) -> None:
        """Turn the switch off."""
        await async_set_brightness_value(self.coordinator, self.entity_description.key, False)
