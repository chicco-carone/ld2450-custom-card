import "../src/index";
import type { CardConfig, HassEntity, HomeAssistant, RegistryDevice, RegistryEntity } from "../src/types";

const deviceId = "mock-ld2450-device";
const states: Record<string, HassEntity> = {};
const registry: RegistryEntity[] = [];

function add(domain: string, id: string, name: string, state: string, attributes: Record<string, unknown> = {}): string {
  const entityId = `${domain}.${id}`;
  states[entityId] = { entity_id: entityId, state, attributes: { friendly_name: name, ...attributes } };
  registry.push({ ei: entityId, entity_id: entityId, di: deviceId, device_id: deviceId, original_name: name });
  return entityId;
}

add("binary_sensor", "ld2450_occupancy", "LD2450 Occupancy", "on");
add("sensor", "ld2450_target_count", "LD2450 Target Count", "3");
add("number", "ld2450_maximum_distance", "LD2450 Maximum Distance", "6", { min: 0, max: 6, step: 0.1 });
add("number", "ld2450_minimum_angle", "LD2450 Minimum Angle", "-90", { min: -90, max: 90, step: 1 });
add("number", "ld2450_maximum_angle", "LD2450 Maximum Angle", "90", { min: -90, max: 90, step: 1 });
add("switch", "ld2450_tracking", "LD2450 Multiple Target Tracking", "on");
add("switch", "ld2450_bluetooth", "LD2450 Bluetooth", "off");
add("select", "ld2450_baud", "LD2450 Baud Rate", "256000", { options: ["9600", "115200", "256000", "460800"] });
add("button", "ld2450_restart", "LD2450 Restart Sensor", "unknown");
add("button", "ld2450_factory_reset", "LD2450 Factory Reset Sensor", "unknown");

const metricDefaults = [
  { x: -2.2, y: 3.8, speed: 0.28, distance: 4.4, angle: -30, resolution: 0.08 },
  { x: 0.4, y: 2.5, speed: 0.12, distance: 2.6, angle: 9, resolution: 0.06 },
  { x: 3.1, y: 4.7, speed: -0.2, distance: 5.6, angle: 34, resolution: 0.09 },
];
for (const [index, metrics] of metricDefaults.entries()) {
  const target = index + 1;
  add("sensor", `target_${target}_x`, `LD2450 Target ${target} X Position`, String(metrics.x));
  add("sensor", `target_${target}_y`, `LD2450 Target ${target} Y Position`, String(metrics.y));
  add("sensor", `target_${target}_speed`, `LD2450 Target ${target} Speed`, String(metrics.speed));
  add("sensor", `target_${target}_distance`, `LD2450 Target ${target} Distance`, String(metrics.distance));
  add("sensor", `target_${target}_angle`, `LD2450 Target ${target} Angle`, String(metrics.angle));
  add("sensor", `target_${target}_resolution`, `LD2450 Target ${target} Distance Resolution`, String(metrics.resolution));
}

const zoneDefaults = [
  [{ x: -6, y: 0 }, { x: -6, y: 6 }, { x: -2, y: 6 }, { x: -2, y: 0 }],
  [{ x: -2, y: 0 }, { x: -2, y: 6 }, { x: 2, y: 6 }, { x: 2, y: 0 }],
  [{ x: 2, y: 0 }, { x: 2, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 0 }],
];
for (const [zoneIndex, points] of zoneDefaults.entries()) {
  const zone = zoneIndex + 1;
  add("binary_sensor", `zone_${zone}_occupancy`, `LD2450 Zone ${zone} Occupancy`, zone === 2 ? "on" : "off");
  add("sensor", `zone_${zone}_count`, `LD2450 Zone ${zone} Target Count`, zone === 2 ? "1" : String(zone === 1 ? 1 : 1));
  add("button", `zone_${zone}_apply`, `LD2450 Zone ${zone} Apply`, "unknown");
  for (const [pointIndex, point] of points.entries()) {
    add("number", `zone_${zone}_p${pointIndex + 1}_x`, `LD2450 Zone ${zone} Point ${pointIndex + 1} X`, String(point.x));
    add("number", `zone_${zone}_p${pointIndex + 1}_y`, `LD2450 Zone ${zone} Point ${pointIndex + 1} Y`, String(point.y));
  }
}

const hass: HomeAssistant = {
  states,
  async callWS<T>(message: Record<string, unknown>): Promise<T> {
    if (message.type === "config/entity_registry/list") return registry as T;
    if (message.type === "config/device_registry/list") {
      return [{ id: deviceId, name: "LD2450 Preview", manufacturer: "ESPHome", model: "HLK-LD2450" }] as RegistryDevice[] as T;
    }
    return [] as T;
  },
  async callService(domain, service, data = {}, target = { entity_id: [] }): Promise<void> {
    const ids = Array.isArray(target.entity_id) ? target.entity_id : [target.entity_id];
    for (const entityId of ids) {
      if (!states[entityId]) continue;
      if (domain === "number" && service === "set_value") states[entityId].state = String(data.value);
      if (domain === "select" && service === "select_option") states[entityId].state = String(data.option);
      if (domain === "switch" && service === "toggle") states[entityId].state = states[entityId].state === "on" ? "off" : "on";
    }
    refresh();
  },
};

interface PreviewCard extends HTMLElement {
  hass: HomeAssistant;
  setConfig(config: CardConfig): void;
}

const card = document.querySelector<PreviewCard>("#preview")!;
card.setConfig({ type: "custom:ld2450-zone-card", device_id: deviceId, title: "Office Presence Radar", show_controls: true });

function refresh(): void {
  card.hass = { ...hass, states: { ...states } };
}
refresh();

let tick = 0;
setInterval(() => {
  tick += 0.15;
  for (let index = 0; index < 3; index += 1) {
    const target = index + 1;
    states[`sensor.target_${target}_x`].state = (metricDefaults[index].x + Math.sin(tick + index * 1.7) * 0.45).toFixed(2);
    states[`sensor.target_${target}_y`].state = (metricDefaults[index].y + Math.cos(tick * 0.7 + index) * 0.35).toFixed(2);
  }
  refresh();
}, 500);
