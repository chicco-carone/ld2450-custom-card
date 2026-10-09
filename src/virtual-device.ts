import type { EntityMap, HassEntity } from "./types";

export const VIRTUAL_DEVICE_ID = "__ld2450_virtual_test_device__";

export function createVirtualDevice(): { entities: EntityMap; states: Record<string, HassEntity> } {
  const states: Record<string, HassEntity> = {};
  const state = (entityId: string, value: string, attributes: Record<string, unknown> = {}): string => {
    states[entityId] = { entity_id: entityId, state: value, attributes };
    return entityId;
  };

  const entities: EntityMap = {
    occupancy: state("binary_sensor.virtual_ld2450_occupancy", "on"),
    targetCount: state("sensor.virtual_ld2450_target_count", "3"),
    maxDistance: state("number.virtual_ld2450_maximum_distance", "6"),
    minAngle: state("number.virtual_ld2450_minimum_angle", "-90"),
    maxAngle: state("number.virtual_ld2450_maximum_angle", "90"),
    trackingMode: state("switch.virtual_ld2450_tracking", "on"),
    bluetooth: state("switch.virtual_ld2450_bluetooth", "off"),
    baudRate: state("select.virtual_ld2450_baud", "256000", { options: ["9600", "115200", "256000", "460800"] }),
    restart: state("button.virtual_ld2450_restart", "unknown"),
    factoryReset: state("button.virtual_ld2450_factory_reset", "unknown"),
    targets: [],
    zones: [],
  };

  const targetDefaults = [
    { x: -2.2, y: 3.8, speed: 0.28, distance: 4.4, angle: -30, resolution: 0.08 },
    { x: 0.4, y: 2.5, speed: 0.12, distance: 2.6, angle: 9, resolution: 0.06 },
    { x: 3.1, y: 4.7, speed: -0.2, distance: 5.6, angle: 34, resolution: 0.09 },
  ];
  for (const [index, values] of targetDefaults.entries()) {
    const target = index + 1;
    entities.targets.push({
      x: state(`sensor.virtual_target_${target}_x`, String(values.x)),
      y: state(`sensor.virtual_target_${target}_y`, String(values.y)),
      speed: state(`sensor.virtual_target_${target}_speed`, String(values.speed)),
      distance: state(`sensor.virtual_target_${target}_distance`, String(values.distance)),
      angle: state(`sensor.virtual_target_${target}_angle`, String(values.angle)),
      resolution: state(`sensor.virtual_target_${target}_resolution`, String(values.resolution)),
    });
  }

  const zoneDefaults = [
    [{ x: -6, y: 0 }, { x: -6, y: 6 }, { x: -2, y: 6 }, { x: -2, y: 0 }],
    [{ x: -2, y: 0 }, { x: -2, y: 6 }, { x: 2, y: 6 }, { x: 2, y: 0 }],
    [{ x: 2, y: 0 }, { x: 2, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 0 }],
  ];
  for (const [zoneIndex, points] of zoneDefaults.entries()) {
    const zone = zoneIndex + 1;
    entities.zones.push({
      occupancy: state(`binary_sensor.virtual_zone_${zone}_occupancy`, zone === 2 ? "on" : "off"),
      count: state(`sensor.virtual_zone_${zone}_count`, "1"),
      apply: state(`button.virtual_zone_${zone}_apply`, "unknown"),
      points: points.map((point, pointIndex) => ({
        x: state(`number.virtual_zone_${zone}_p${pointIndex + 1}_x`, String(point.x)),
        y: state(`number.virtual_zone_${zone}_p${pointIndex + 1}_y`, String(point.y)),
      })),
    });
  }

  return { entities, states };
}

export function animateVirtualTargets(entities: EntityMap, states: Record<string, HassEntity>, tick: number): void {
  const origins = [{ x: -2.2, y: 3.8 }, { x: 0.4, y: 2.5 }, { x: 3.1, y: 4.7 }];
  entities.targets.forEach((target, index) => {
    if (target.x) states[target.x].state = (origins[index].x + Math.sin(tick + index * 1.7) * 0.45).toFixed(2);
    if (target.y) states[target.y].state = (origins[index].y + Math.cos(tick * 0.7 + index) * 0.35).toFixed(2);
  });
}
