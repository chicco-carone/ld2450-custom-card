export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown> & {
    friendly_name?: string;
    unit_of_measurement?: string;
    min?: number;
    max?: number;
    step?: number;
  };
}

export interface RegistryEntity {
  ei: string;
  di?: string;
  entity_id?: string;
  device_id?: string;
  en?: string;
  hn?: string;
  pl?: string;
  name?: string;
  original_name?: string;
  unique_id?: string;
  disabled_by?: string | null;
}

export interface RegistryDevice {
  id: string;
  name?: string;
  name_by_user?: string;
  manufacturer?: string;
  model?: string;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: { entity_id: string | string[] },
  ): Promise<unknown>;
  callWS<T>(message: Record<string, unknown>): Promise<T>;
}

export interface CardConfig {
  type: string;
  device_id?: string;
  title?: string;
  show_controls?: boolean;
  display_mode?: "normal" | "compact";
}

export interface Point {
  x: number;
  y: number;
}

export type TargetMetric = "x" | "y" | "speed" | "distance" | "angle" | "resolution";

export interface EntityMap {
  targets: Array<Partial<Record<TargetMetric, string>>>;
  zones: Array<{
    occupancy?: string;
    count?: string;
    apply?: string;
    points: Array<{ x?: string; y?: string }>;
  }>;
  occupancy?: string;
  targetCount?: string;
  maxDistance?: string;
  minAngle?: string;
  maxAngle?: string;
  trackingMode?: string;
  bluetooth?: string;
  baudRate?: string;
  restart?: string;
  factoryReset?: string;
}

declare global {
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string; preview?: boolean }>;
  }
}
