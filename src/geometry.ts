import type { Point } from "./types";

export const MAP_BOUNDS = { minX: -6, maxX: 6, minY: 0, maxY: 6 } as const;

/** Returns a radar detection sector, with 0 degrees pointing forward along +Y. */
export function fovSector(minAngle: number, maxAngle: number, distance: number): Point[] {
  const start = Math.max(-90, Math.min(90, Math.min(minAngle, maxAngle)));
  const end = Math.max(-90, Math.min(90, Math.max(minAngle, maxAngle)));
  const radius = Math.max(0, distance);
  const steps = Math.max(1, Math.ceil((end - start) / 3));
  return [{ x: 0, y: 0 }, ...Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (start + ((end - start) * index) / steps) * (Math.PI / 180);
    return { x: radius * Math.sin(angle), y: radius * Math.cos(angle) };
  })];
}

export function polygonArea(points: Point[]): number {
  return Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
}

export function validatePolygon(points: Point[]): string | undefined {
  if (points.length !== 4) return "A zone must have four points.";
  if (points.some(({ x, y }) => x < -6 || x > 6 || y < 0 || y > 6)) {
    return "Points must stay inside X -6..6 m and Y 0..6 m.";
  }
  if (polygonArea(points) < 0.01) return "The zone is too small.";

  let direction = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const c = points[(index + 2) % points.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 0.0001) continue;
    const current = Math.sign(cross);
    if (direction && direction !== current) return "The zone must be convex and non-intersecting.";
    direction = current;
  }
  return direction ? undefined : "The zone points cannot be collinear.";
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  return polygon.some((start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    const cross = (point.x - start.x) * (end.y - start.y) - (point.y - start.y) * (end.x - start.x);
    const dot = (point.x - start.x) * (point.x - end.x) + (point.y - start.y) * (point.y - end.y);
    return Math.abs(cross) < 0.0001 && dot <= 0;
  }) || polygon.reduce((inside, start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    return (start.y > point.y) !== (end.y > point.y)
      && point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x
      ? !inside
      : inside;
  }, false);
}

export function toSvg(point: Point, width = 1200, height = 600): Point {
  return {
    x: ((point.x - MAP_BOUNDS.minX) / (MAP_BOUNDS.maxX - MAP_BOUNDS.minX)) * width,
    y: height - ((point.y - MAP_BOUNDS.minY) / (MAP_BOUNDS.maxY - MAP_BOUNDS.minY)) * height,
  };
}

export function fromSvg(point: Point, width = 1200, height = 600): Point {
  return {
    x: Math.round((MAP_BOUNDS.minX + (point.x / width) * 12) * 10) / 10,
    y: Math.round((MAP_BOUNDS.minY + ((height - point.y) / height) * 6) * 10) / 10,
  };
}
