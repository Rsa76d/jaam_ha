"""Number platform for jaam_ha (brightness settings)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.jaam_ha.brightness import is_brightness_entity_supported
from custom_components.jaam_ha.const import PARALLEL_UPDATES as PARALLEL_UPDATES
from custom_components.jaam_ha.entity import async_setup_dynamic_entities

from .brightness import ENTITY_DESCRIPTIONS as BRIGHTNESS_DESCRIPTIONS, JaamHABrightnessNumber

if TYPE_CHECKING:
    from custom_components.jaam_ha.data import JaamHAConfigEntry
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback


ENTITY_DESCRIPTIONS = BRIGHTNESS_DESCRIPTIONS


async def async_setup_entry(
    hass: HomeAssistant,
    entry: JaamHAConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the number platform; entities appear only with firmware brightness support."""
    async_setup_dynamic_entities(
        hass,
        entry,
        entry.runtime_data.coordinator,
        async_add_entities,
        domain="number",
        dynamic_descriptions={desc.key: (desc, JaamHABrightnessNumber) for desc in BRIGHTNESS_DESCRIPTIONS},
        should_create=is_brightness_entity_supported,
    )
