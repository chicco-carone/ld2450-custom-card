import type { EntityMap, HomeAssistant, RegistryEntity } from "./types";

const emptyMap = (): EntityMap => ({
  targets: Array.from({ length: 3 }, () => ({})),
  zones: Array.from({ length: 3 }, () => ({ points: Array.from({ length: 4 }, () => ({})) })),
});

function displayName(entity: RegistryEntity, hass: HomeAssistant): string {
  const entityId = entity.ei ?? entity.entity_id!;
  const state = hass.states[entityId];
  return String(entity.name ?? entity.original_name ?? entity.en ?? entity.hn ?? state?.attributes.friendly_name ?? entityId).toLowerCase();
}

export async function discoverEntities(hass: HomeAssistant, deviceId: string): Promise<EntityMap> {
  const entities = await hass.callWS<RegistryEntity[]>({ type: "config/entity_registry/list" });
  return mapEntities(entities.filter((entity) => (entity.di ?? entity.device_id) === deviceId && !entity.disabled_by), hass);
}

export function mapEntities(entities: RegistryEntity[], hass: HomeAssistant): EntityMap {
  const map = emptyMap();
  const assign = (field: keyof EntityMap, entity: RegistryEntity) => {
    (map as unknown as Record<string, string>)[field] = entity.ei;
  };

  for (const entity of entities) {
    entity.ei = entity.ei ?? entity.entity_id!;
    const name = displayName(entity, hass);
    const target = name.match(/ld2450 target ([123]) (x position|y position|speed|distance resolution|angle|distance)$/);
    if (target) {
      const metric = ({
        "x position": "x",
        "y position": "y",
        speed: "speed",
        distance: "distance",
        angle: "angle",
        "distance resolution": "resolution",
      } as const)[target[2] as "x position"];
      map.targets[Number(target[1]) - 1][metric] = entity.ei;
      continue;
    }

    const point = name.match(/ld2450 zone ([123]) point ([1234]) ([xy])$/);
    if (point) {
      map.zones[Number(point[1]) - 1].points[Number(point[2]) - 1][point[3] as "x" | "y"] = entity.ei;
      continue;
    }

    const zone = name.match(/ld2450 zone ([123])(?: (occupancy|target count|apply))?/);
    if (zone) {
      const domain = entity.ei.split(".")[0];
      const kind = zone[2] ?? (domain === "binary_sensor" ? "occupancy" : domain === "sensor" ? "target count" : undefined);
      if (!kind) continue;
      const key = kind === "target count" ? "count" : kind;
      map.zones[Number(zone[1]) - 1][key as "occupancy" | "count" | "apply"] = entity.ei;
      continue;
    }

    if (name === "ld2450 occupancy") assign("occupancy", entity);
    else if (name === "ld2450 target count") assign("targetCount", entity);
    else if (name === "ld2450 maximum distance") assign("maxDistance", entity);
    else if (name === "ld2450 minimum angle") assign("minAngle", entity);
    else if (name === "ld2450 maximum angle") assign("maxAngle", entity);
    else if (name === "ld2450 multiple target tracking") assign("trackingMode", entity);
    else if (name === "ld2450 bluetooth") assign("bluetooth", entity);
    else if (name === "ld2450 baud rate") assign("baudRate", entity);
    else if (name === "ld2450 restart sensor") assign("restart", entity);
    else if (name === "ld2450 factory reset sensor") assign("factoryReset", entity);
  }
  return map;
}
