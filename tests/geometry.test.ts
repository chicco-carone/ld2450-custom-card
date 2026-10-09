import { describe, expect, test } from "bun:test";
import { fovSector, fromSvg, polygonArea, toSvg, validatePolygon } from "../src/geometry";

describe("polygon validation", () => {
  test("accepts a convex rectangle", () => {
    expect(validatePolygon([{ x: -2, y: 0 }, { x: -2, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 0 }])).toBeUndefined();
  });

  test("rejects concave and out-of-range polygons", () => {
    expect(validatePolygon([{ x: -2, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 0 }, { x: 0, y: 1 }])).toContain("convex");
    expect(validatePolygon([{ x: -7, y: 0 }, { x: -2, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 0 }])).toContain("inside");
  });

  test("calculates area and round-trips map coordinates", () => {
    expect(polygonArea([{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 0 }])).toBe(4);
    expect(fromSvg(toSvg({ x: 1.2, y: 3.4 }))).toEqual({ x: 1.2, y: 3.4 });
  });

  test("creates an asymmetric FOV sector with forward-facing angles", () => {
    const sector = fovSector(-30, 60, 4);
    expect(sector[0]).toEqual({ x: 0, y: 0 });
    expect(sector[1].x).toBeCloseTo(-2);
    expect(sector[1].y).toBeCloseTo(3.46);
    expect(sector.at(-1)?.x).toBeCloseTo(3.46);
    expect(sector.at(-1)?.y).toBeCloseTo(2);
  });
});
