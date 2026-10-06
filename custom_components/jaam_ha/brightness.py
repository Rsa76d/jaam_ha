"""Shared helpers for brightness entities (map smooth brightness + display brightness).

The firmware (JAAM Fusion with brightness support, e.g. 5.1.2-b3-lux2) sends a `brightness`
object in `initial_state` and in `brightness_change` broadcasts::

    {
        "mode": 0..2,             # 0 - off, 1 - day/night, 2 - light sensor
        "smooth": bool,           # smooth brightness instead of threshold (sensor mode)
        "max": 0..100,            # big brightness (bright light)
        "min_day": 0..100,        # small brightness, day hours (darkness)
        "min_night": 0..100,      # small brightness, night hours (darkness)
        "sensitivity": 0.1..30,   # light sensor sensitivity
        "current": 0..100,        # current map brightness
        "display": 1..100,        # display brightness (max in auto mode)
        "display_auto": bool,     # display auto brightness
        "display_min": 1..100,    # display min brightness (auto mode)
        "display_off_at_night": bool,
        "display_current": 1..100,
        "sensor": bool            # light sensor available
    }

Entities are created only when the firmware reports this object, so the integration keeps
working unchanged with stock firmware. Values are changed with the `set_brightness` command.
"""

from __future__ import annotations

from typing import Any

BRIGHTNESS_DATA_KEY = "brightness"

# entity key -> (field in the `brightness` object, requires light sensor)
BRIGHTNESS_FIELDS: dict[str, tuple[str, bool]] = {
    "brightness_mode": ("mode", False),
    "brightness_smooth": ("smooth", True),
    "brightness_max": ("max", True),
    "brightness_min_day": ("min_day", True),
    "brightness_min_night": ("min_night", True),
    "light_sensor_sensitivity": ("sensitivity", True),
    "brightness_current": ("current", False),
    "display_brightness": ("display", False),
    "display_auto_brightness": ("display_auto", True),
    "display_brightness_min": ("display_min", True),
    "display_off_at_night": ("display_off_at_night", False),
    "display_brightness_current": ("display_current", False),
}

# Brightness mode options (select) -> firmware mode id
BRIGHTNESS_MODES: dict[str, int] = {
    "off": 0,
    "day_night": 1,
    "sensor": 2,
}


def get_brightness_data(data: dict[str, Any] | None) -> dict[str, Any] | None:
    """Return the brightness object from coordinator data, if the firmware supports it."""
    if not data:
        return None
    value = data.get(BRIGHTNESS_DATA_KEY)
    return value if isinstance(value, dict) else None


def is_brightness_entity_supported(key: str, data: dict[str, Any]) -> bool:
    """Entity exists only if firmware reports brightness (and the light sensor, when needed)."""
    brightness = get_brightness_data(data)
    if brightness is None or key not in BRIGHTNESS_FIELDS:
        return False
    field, requires_sensor = BRIGHTNESS_FIELDS[key]
    if field not in brightness:
        return False
    return not requires_sensor or bool(brightness.get("sensor"))


def get_brightness_value(data: dict[str, Any] | None, key: str) -> Any:
    """Return the value of the brightness field for an entity key."""
    brightness = get_brightness_data(data)
    if brightness is None or key not in BRIGHTNESS_FIELDS:
        return None
    return brightness.get(BRIGHTNESS_FIELDS[key][0])


async def async_set_brightness_value(coordinator: Any, key: str, value: Any) -> None:
    """Send a brightness setting to the device; the device answers with brightness_change."""
    field = BRIGHTNESS_FIELDS[key][0]
    client = coordinator.config_entry.runtime_data.client
    await client.async_set_brightness(field, value)
