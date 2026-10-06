"""End-to-end tests for brightness entities against an emulated JAAM device (WebSocket)."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from aiohttp import web
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.jaam_ha.const import CONF_HOST, CONF_PORT, DOMAIN
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

CHIP = "0ce38f7d7850"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Enable custom integrations."""
    return


class FakeJaam:
    """Minimal JAAM firmware emulator: initial_state + set_brightness with order enforcement."""

    def __init__(self, with_brightness: bool = True, sensor: bool = True) -> None:
        self.with_brightness = with_brightness
        self.clients: list[web.WebSocketResponse] = []
        self.received: list[dict[str, Any]] = []
        self.brightness: dict[str, Any] = {
            "mode": 2, "smooth": True, "max": 80, "min_day": 20, "min_night": 3, "sensitivity": 1.0,
            "current": 55, "display": 100, "display_auto": False, "display_min": 10,
            "display_off_at_night": False, "display_current": 100, "sensor": sensor,
        }

    def initial_state(self) -> dict[str, Any]:
        state: dict[str, Any] = {
            "type": "initial_state", "connected": True, "chip_id": CHIP, "fw_version": "5.1.2-b3-lux2",
            "device_name": "JAAM", "map_mode_id": 1, "display_mode_id": 9, "home_region": 1,
            "home_alert_flags": 0, "home_district_temp": 17, "used_memory": 100, "uptime": 10,
            "wifi_uptime": 10, "wifi_signal": -50, "websocket_status": True, "websocket_uptime": 10,
            "cpu_temp": 40.0, "night_mode": False, "map_enabled": True, "display_enabled": True,
            "lamp": {"color": "#ffffff", "brightness": 50},
            "supported_sensors": ["night_mode", "map", "display", "light_level"], "light_level": 42.0,
            "supported_map_modes": [0, 1], "supported_display_modes": [0, 9],
        }
        if self.with_brightness:
            state["brightness"] = dict(self.brightness)
            state["home_energy"] = 4       # не вистачає
            state["home_radiation"] = 120  # нЗв/год
        return state

    def apply(self, key: str, value: Any) -> None:
        b = self.brightness
        if key in ("smooth", "display_auto", "display_off_at_night"):
            b[key] = bool(value)
        elif key == "sensitivity":
            b[key] = max(0.1, min(30.0, float(value)))
        else:
            b[key] = int(value)
        # як у прошивці: мала ніч <= мала день <= велика, мін. дисплея <= дисплей
        b["min_day"] = min(b["min_day"], b["max"])
        b["min_night"] = min(b["min_night"], b["min_day"])
        b["display_min"] = min(b["display_min"], b["display"])

    async def broadcast(self, message: dict[str, Any]) -> None:
        for ws in list(self.clients):
            if not ws.closed:
                await ws.send_str(json.dumps(message))

    async def handler(self, request: web.Request) -> web.WebSocketResponse:
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        self.clients.append(ws)
        await ws.send_str(json.dumps(self.initial_state()))
        async for msg in ws:
            data = json.loads(msg.data)
            self.received.append(data)
            if data.get("type") == "set_brightness" and self.with_brightness:
                self.apply(data["key"], data["value"])
                await self.broadcast({"type": "brightness_change", "brightness": dict(self.brightness)})
        self.clients.remove(ws)
        return ws


async def _setup(hass: HomeAssistant, aiohttp_server, fake: FakeJaam) -> tuple[MockConfigEntry, Any]:
    app = web.Application()
    app.router.add_get("/", fake.handler)
    server = await aiohttp_server(app)
    entry = MockConfigEntry(domain=DOMAIN, data={CONF_HOST: "127.0.0.1", CONF_PORT: server.port}, unique_id=CHIP)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry, server


def _eid(hass: HomeAssistant, domain: str, key: str) -> str | None:
    return er.async_get(hass).async_get_entity_id(domain, DOMAIN, f"jaam_{CHIP}_{key}")


async def _settle(hass: HomeAssistant) -> None:
    for _ in range(5):
        await asyncio.sleep(0.05)
        await hass.async_block_till_done()


async def test_brightness_entities_and_controls(hass: HomeAssistant, socket_enabled, aiohttp_server) -> None:
    """Entities appear, show values, send commands and follow firmware-side clamping."""
    fake = FakeJaam()
    entry, _ = await _setup(hass, aiohttp_server, fake)

    expected = {
        "sensor": ["brightness_current", "display_brightness_current"],
        "select": ["brightness_mode"],
        "switch": ["brightness_smooth", "display_auto_brightness", "display_off_at_night"],
        "number": ["brightness_max", "brightness_min_day", "brightness_min_night",
                   "light_sensor_sensitivity", "display_brightness", "display_brightness_min"],
    }
    for domain, keys in expected.items():
        for key in keys:
            assert _eid(hass, domain, key), f"{domain}.{key} missing"

    assert hass.states.get(_eid(hass, "sensor", "brightness_current")).state == "55"
    assert hass.states.get(_eid(hass, "select", "brightness_mode")).state == "sensor"
    assert hass.states.get(_eid(hass, "switch", "brightness_smooth")).state == "on"
    assert float(hass.states.get(_eid(hass, "number", "brightness_max")).state) == 80

    # "Мала ніч" вище "Малої день" -> прошивка обмежує до 20, HA показує застосоване
    await hass.services.async_call("number", "set_value",
                                   {"entity_id": _eid(hass, "number", "brightness_min_night"), "value": 50}, blocking=True)
    await _settle(hass)
    assert fake.received[-1] == {"type": "set_brightness", "key": "min_night", "value": 50}
    assert float(hass.states.get(_eid(hass, "number", "brightness_min_night")).state) == 20

    # "Велика" нижче мінімумів -> ланцюжок
    await hass.services.async_call("number", "set_value",
                                   {"entity_id": _eid(hass, "number", "brightness_max"), "value": 10}, blocking=True)
    await _settle(hass)
    assert float(hass.states.get(_eid(hass, "number", "brightness_min_day")).state) == 10
    assert float(hass.states.get(_eid(hass, "number", "brightness_min_night")).state) == 10

    # чутливість - дробове значення
    await hass.services.async_call("number", "set_value",
                                   {"entity_id": _eid(hass, "number", "light_sensor_sensitivity"), "value": 2.5}, blocking=True)
    await _settle(hass)
    assert fake.received[-1]["value"] == 2.5
    assert float(hass.states.get(_eid(hass, "number", "light_sensor_sensitivity")).state) == 2.5

    # режим і перемикачі
    await hass.services.async_call("select", "select_option",
                                   {"entity_id": _eid(hass, "select", "brightness_mode"), "option": "day_night"}, blocking=True)
    await hass.services.async_call("switch", "turn_on",
                                   {"entity_id": _eid(hass, "switch", "display_auto_brightness")}, blocking=True)
    await _settle(hass)
    assert {"type": "set_brightness", "key": "mode", "value": 1} in fake.received
    assert hass.states.get(_eid(hass, "select", "brightness_mode")).state == "day_night"
    assert hass.states.get(_eid(hass, "switch", "display_auto_brightness")).state == "on"

    # поточна яскравість оновлюється подією
    fake.brightness["current"] = 33
    await fake.broadcast({"type": "brightness_change", "brightness": dict(fake.brightness)})
    await _settle(hass)
    assert hass.states.get(_eid(hass, "sensor", "brightness_current")).state == "33"

    # датчик зник -> сутності, що від нього залежать, прибираються; решта лишається
    fake.brightness["sensor"] = False
    await fake.broadcast({"type": "brightness_change", "brightness": dict(fake.brightness)})
    await _settle(hass)
    assert _eid(hass, "switch", "brightness_smooth") is None
    assert _eid(hass, "number", "brightness_max") is None
    assert _eid(hass, "number", "display_brightness") is not None
    assert hass.states.get(_eid(hass, "select", "brightness_mode")).attributes["options"] == ["off", "day_night"]

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()


async def test_home_energy_and_radiation(hass: HomeAssistant, socket_enabled, aiohttp_server) -> None:
    """Energy system status and radiation level of the home region."""
    fake = FakeJaam()
    entry, _ = await _setup(hass, aiohttp_server, fake)

    energy = hass.states.get(_eid(hass, "sensor", "home_energy"))
    radiation = hass.states.get(_eid(hass, "sensor", "home_radiation"))
    assert energy.state == "insufficient"
    assert energy.attributes["status_code"] == 4
    assert radiation.state == "120"
    assert radiation.attributes["unit_of_measurement"] == "nSv/h"
    assert radiation.attributes["level"] == "normal"

    await fake.broadcast({"type": "home_energy_radiation_change", "home_energy": 9, "home_radiation": 750})
    await _settle(hass)
    assert hass.states.get(_eid(hass, "sensor", "home_energy")).state == "outage"
    radiation = hass.states.get(_eid(hass, "sensor", "home_radiation"))
    assert radiation.state == "750"
    assert radiation.attributes["level"] == "high"

    # немає даних
    await fake.broadcast({"type": "home_energy_radiation_change", "home_energy": 0, "home_radiation": 0})
    await _settle(hass)
    assert hass.states.get(_eid(hass, "sensor", "home_energy")).state == "unknown"
    assert hass.states.get(_eid(hass, "sensor", "home_radiation")).state == "unknown"

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()


async def test_stock_firmware_has_no_brightness_entities(hass: HomeAssistant, socket_enabled, aiohttp_server) -> None:
    """With stock firmware (no brightness object) nothing new appears and existing entities work."""
    fake = FakeJaam(with_brightness=False)
    entry, _ = await _setup(hass, aiohttp_server, fake)

    for domain, key in (("number", "brightness_max"), ("select", "brightness_mode"),
                        ("switch", "brightness_smooth"), ("sensor", "brightness_current"),
                        ("sensor", "home_energy"), ("sensor", "home_radiation")):
        assert _eid(hass, domain, key) is None
    # наявні сутності на місці
    assert _eid(hass, "switch", "night_mode") is not None
    assert _eid(hass, "select", "map_mode") is not None

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
