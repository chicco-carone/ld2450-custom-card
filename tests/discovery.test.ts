import { expect, test } from "bun:test";
import { mapEntities } from "../src/discovery";
import type { HomeAssistant, RegistryEntity } from "../src/types";

test("maps stable package entity names", () => {
  const entities: RegistryEntity[] = [
    { ei: "sensor.radar_t1_x", di: "device", original_name: "LD2450 Target 1 X Position" },
    { ei: "sensor.radar_t1_y", di: "device", original_name: "LD2450 Target 1 Y Position" },
    { ei: "number.zone_2_p3_x", di: "device", original_name: "LD2450 Zone 2 Point 3 X" },
    { ei: "button.zone_2_apply", di: "device", original_name: "LD2450 Zone 2 Apply" },
    { ei: "binary_sensor.radar", di: "device", original_name: "LD2450 Occupancy" },
  ];
  const hass = { states: {}, callService: async () => {}, callWS: async () => [] } as HomeAssistant;
  const map = mapEntities(entities, hass);
  expect(map.targets[0].x).toBe("sensor.radar_t1_x");
  expect(map.targets[0].y).toBe("sensor.radar_t1_y");
  expect(map.zones[1].points[2].x).toBe("number.zone_2_p3_x");
  expect(map.zones[1].apply).toBe("button.zone_2_apply");
  expect(map.occupancy).toBe("binary_sensor.radar");
});
