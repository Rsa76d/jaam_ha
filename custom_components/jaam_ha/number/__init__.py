"""Number platform for jaam_ha.

jaam_touch: screen brightness and sound volume numbers.
jaam_fusion: map/display brightness settings (appear only with firmware brightness support).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.jaam_ha.brightness import is_brightness_entity_supported
from custom_components.jaam_ha.const import (
    CONF_DEVICE_TYPE,
    DEFAULT_DEVICE_TYPE,
    DEVICE_TYPE_TOUCH,
    PARALLEL_UPDATES as PARALLEL_UPDATES,
)
from custom_components.jaam_ha.entity import async_setup_dynamic_entities
from homeassistant.components.number import NumberEntityDescription

from .brightness import ENTITY_DESCRIPTIONS as BRIGHTNESS_DESCRIPTIONS, JaamHABrightnessNumber
from .map_brightness import ENTITY_DESCRIPTIONS as MAP_BRIGHTNESS_DESCRIPTIONS, JaamHAMapBrightnessNumber
from .sound_volume import ENTITY_DESCRIPTIONS as SOUND_VOLUME_DESCRIPTIONS, JaamHASoundVolumeNumber

if TYPE_CHECKING:
    from custom_components.jaam_ha.data import JaamHAConfigEntry
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback

# Combine all entity descriptions from different modules
ENTITY_DESCRIPTIONS: tuple[NumberEntityDescription, ...] = (
    *BRIGHTNESS_DESCRIPTIONS,
    *SOUND_VOLUME_DESCRIPTIONS,
    *MAP_BRIGHTNESS_DESCRIPTIONS,
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: JaamHAConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the number platform."""
    coordinator = entry.runtime_data.coordinator

    if entry.data.get(CONF_DEVICE_TYPE, DEFAULT_DEVICE_TYPE) != DEVICE_TYPE_TOUCH:
        # jaam_fusion: map/display brightness numbers, only with firmware brightness support
        async_setup_dynamic_entities(
            hass,
            entry,
            coordinator,
            async_add_entities,
            domain="number",
            dynamic_descriptions={desc.key: (desc, JaamHAMapBrightnessNumber) for desc in MAP_BRIGHTNESS_DESCRIPTIONS},
            should_create=is_brightness_entity_supported,
        )
        return

    async_add_entities(
        JaamHABrightnessNumber(coordinator=coordinator, entity_description=entity_description)
        for entity_description in BRIGHTNESS_DESCRIPTIONS
    )
    async_add_entities(
        JaamHASoundVolumeNumber(coordinator=coordinator, entity_description=entity_description)
        for entity_description in SOUND_VOLUME_DESCRIPTIONS
    )
