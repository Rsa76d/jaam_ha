"""Select platform for jaam_ha."""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.jaam_ha.brightness import is_brightness_entity_supported
from custom_components.jaam_ha.const import PARALLEL_UPDATES as PARALLEL_UPDATES
from custom_components.jaam_ha.entity import async_setup_dynamic_entities
from homeassistant.components.select import SelectEntityDescription

from .brightness_mode import ENTITY_DESCRIPTIONS as BRIGHTNESS_MODE_DESCRIPTIONS, JaamHABrightnessModeSelect
from .display_mode import ENTITY_DESCRIPTIONS as DISPLAY_MODE_DESCRIPTIONS, JaamHADisplayModeSelect
from .map_mode import ENTITY_DESCRIPTIONS as MAP_MODE_DESCRIPTIONS, JaamHAMapModeSelect

if TYPE_CHECKING:
    from custom_components.jaam_ha.data import JaamHAConfigEntry
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback

# Combine all entity descriptions from different modules
ENTITY_DESCRIPTIONS: tuple[SelectEntityDescription, ...] = (
    *MAP_MODE_DESCRIPTIONS,
    *DISPLAY_MODE_DESCRIPTIONS,
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: JaamHAConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the select platform."""

    # Add map mode select
    async_add_entities(
        JaamHAMapModeSelect(
            coordinator=entry.runtime_data.coordinator,
            entity_description=entity_description,
        )
        for entity_description in MAP_MODE_DESCRIPTIONS
    )

    # Add display mode select
    async_add_entities(
        JaamHADisplayModeSelect(
            coordinator=entry.runtime_data.coordinator,
            entity_description=entity_description,
        )
        for entity_description in DISPLAY_MODE_DESCRIPTIONS
    )

    # Brightness mode select - only with firmware brightness support
    async_setup_dynamic_entities(
        hass,
        entry,
        entry.runtime_data.coordinator,
        async_add_entities,
        domain="select",
        dynamic_descriptions={desc.key: (desc, JaamHABrightnessModeSelect) for desc in BRIGHTNESS_MODE_DESCRIPTIONS},
        should_create=is_brightness_entity_supported,
    )
