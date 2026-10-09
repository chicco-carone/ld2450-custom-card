import { LitElement, css, html, nothing, svg } from "lit";
import { discoverEntities } from "./discovery";
import { fovSector, fromSvg, pointInPolygon, toSvg, validatePolygon } from "./geometry";
import type { CardConfig, EntityMap, HomeAssistant, Point } from "./types";
import { animateVirtualTargets, createVirtualDevice, VIRTUAL_DEVICE_ID } from "./virtual-device";

const colors = ["#00a6fb", "#f59e0b", "#a855f7"];
const emptyEntities = (): EntityMap => ({
  targets: [{}, {}, {}],
  zones: [0, 1, 2].map(() => ({ points: [{}, {}, {}, {}] })),
});

export class Ld2450ZoneCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _entities: { state: true },
    _drafts: { state: true },
    _editingZone: { state: true },
    _message: { state: true },
    _saving: { state: true },
    _fullscreen: { state: true },
  };

  hass?: HomeAssistant;
  private _config?: CardConfig;
  private _entities: EntityMap = emptyEntities();
  private _drafts: Point[][] = [[], [], []];
  private _editingZone?: number;
  private _message = "";
  private _saving = false;
  private _fullscreen = false;
  private _loadedDevice?: string;
  private _virtualStates?: ReturnType<typeof createVirtualDevice>["states"];
  private _virtualTimer?: number;
  private _virtualTick = 0;
  private _zoneDrag?: { pointerId: number; point: Point };
  private readonly _fullscreenChanged = (): void => {
    this._fullscreen = Boolean(document.fullscreenElement);
  };

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("fullscreenchange", this._fullscreenChanged);
  }

  disconnectedCallback(): void {
    document.removeEventListener("fullscreenchange", this._fullscreenChanged);
    this._stopVirtualDevice();
    super.disconnectedCallback();
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("ld2450-zone-card-editor");
  }

  static getStubConfig(): CardConfig {
    return { type: "custom:ld2450-zone-card", title: "LD2450 Live Map", show_controls: true };
  }

  setConfig(config: CardConfig): void {
    if (!config) throw new Error("Card configuration is required.");
    this._config = { show_controls: true, display_mode: "normal", ...config };
  }

  getCardSize(): number {
    return 8;
  }

  protected updated(): void {
    const device = this._config?.device_id;
    if (this.hass && device && device !== this._loadedDevice) {
      this._loadedDevice = device;
      this._stopVirtualDevice();
      if (device === VIRTUAL_DEVICE_ID) {
        const virtual = createVirtualDevice();
        this._entities = virtual.entities;
        this._virtualStates = virtual.states;
        this._drafts = this._readAllZones();
        this._virtualTimer = window.setInterval(() => {
          this._virtualTick += 0.15;
          animateVirtualTargets(this._entities, virtual.states, this._virtualTick);
          this.requestUpdate();
        }, 500);
        return;
      }
      void discoverEntities(this.hass, device)
        .then((entities) => {
          this._entities = entities;
          this._drafts = this._readAllZones();
        })
        .catch((error: unknown) => {
          this._message = `Entity discovery failed: ${String(error)}`;
        });
    }
  }

  private _number(entityId?: string): number | undefined {
    if (!this.hass || !entityId) return undefined;
    const value = Number((this._virtualStates ?? this.hass.states)[entityId]?.state);
    return Number.isFinite(value) ? value : undefined;
  }

  private _readAllZones(): Point[][] {
    return this._entities.zones.map((zone) => zone.points.map((point) => ({
      x: this._number(point.x) ?? 0,
      y: this._number(point.y) ?? 0,
    })));
  }

  private _zonePoints(index: number): Point[] {
    if (this._editingZone !== undefined && this._drafts[index].length === 4) return this._drafts[index];
    return this._entities.zones[index].points.map((point) => ({
      x: this._number(point.x) ?? 0,
      y: this._number(point.y) ?? 0,
    }));
  }

  private _state(entityId?: string): string {
    const states = this._virtualStates ?? this.hass?.states;
    return entityId && states?.[entityId] ? states[entityId].state : "unavailable";
  }

  private _formattedState(entityId?: string): string {
    const value = Number(this._state(entityId));
    return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : this._state(entityId);
  }

  private _targetZone(target: EntityMap["targets"][number]): string {
    const x = this._number(target.x);
    const y = this._number(target.y);
    if (x === undefined || y === undefined) return "Not tracked";
    const zones = this._entities.zones
      .map((_, index) => index)
      .filter((index) => pointInPolygon({ x, y }, this._zonePoints(index)))
      .map((index) => `Zone ${index + 1}`);
    return zones.length ? zones.join(", ") : "Outside zones";
  }

  private _stopVirtualDevice(): void {
    if (this._virtualTimer !== undefined) window.clearInterval(this._virtualTimer);
    this._virtualTimer = undefined;
    this._virtualStates = undefined;
  }

  private _beginEdit(index: number): void {
    this._drafts = this._drafts.map((points, zoneIndex) => (
      zoneIndex === index && points.length !== 4 ? this._zonePoints(index).map((p) => ({ ...p })) : points
    ));
    this._editingZone = index;
    this._message = "Edit zones, then save all changes to ESPHome.";
  }

  private _cancelEdit(): void {
    this._drafts = this._readAllZones();
    this._editingZone = undefined;
    this._message = "Changes discarded.";
  }

  private _drag(event: PointerEvent, zoneIndex: number, pointIndex: number): void {
    if (this._editingZone !== zoneIndex) return;
    const svgElement = (event.currentTarget as SVGCircleElement).ownerSVGElement;
    if (!svgElement) return;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    const point = this._mapPoint(event, svgElement);
    const drafts = this._drafts.map((zone) => zone.map((item) => ({ ...item })));
    drafts[zoneIndex][pointIndex] = point;
    this._drafts = drafts;
  }

  private _mapPoint(event: PointerEvent, svgElement: SVGSVGElement): Point {
    const bounds = svgElement.getBoundingClientRect();
    const point = fromSvg({
      x: ((event.clientX - bounds.left) / bounds.width) * 1200,
      y: ((event.clientY - bounds.top) / bounds.height) * 600,
    });
    return {
      x: Math.max(-6, Math.min(6, Math.round(point.x * 10) / 10)),
      y: Math.max(0, Math.min(6, Math.round(point.y * 10) / 10)),
    };
  }

  private _startZoneDrag(event: PointerEvent, zoneIndex: number): void {
    if (this._editingZone !== zoneIndex) return;
    const svgElement = (event.currentTarget as SVGPolygonElement).ownerSVGElement;
    if (!svgElement) return;
    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    this._zoneDrag = { pointerId: event.pointerId, point: this._mapPoint(event, svgElement) };
  }

  private _moveZone(event: PointerEvent, zoneIndex: number): void {
    if (this._editingZone !== zoneIndex || this._zoneDrag?.pointerId !== event.pointerId) return;
    const svgElement = (event.currentTarget as SVGPolygonElement).ownerSVGElement;
    if (!svgElement) return;
    const point = this._mapPoint(event, svgElement);
    const points = this._drafts[zoneIndex];
    const minX = Math.min(...points.map((item) => item.x));
    const maxX = Math.max(...points.map((item) => item.x));
    const minY = Math.min(...points.map((item) => item.y));
    const maxY = Math.max(...points.map((item) => item.y));
    const x = Math.max(-6 - minX, Math.min(6 - maxX, point.x - this._zoneDrag.point.x));
    const y = Math.max(-minY, Math.min(6 - maxY, point.y - this._zoneDrag.point.y));
    const drafts = this._drafts.map((zone) => zone.map((item) => ({ ...item })));
    drafts[zoneIndex] = points.map((item) => ({
      x: Math.round((item.x + x) * 10) / 10,
      y: Math.round((item.y + y) * 10) / 10,
    }));
    this._drafts = drafts;
    this._zoneDrag = { pointerId: event.pointerId, point };
  }

  private _stopZoneDrag(event: PointerEvent): void {
    if (this._zoneDrag?.pointerId === event.pointerId) this._zoneDrag = undefined;
  }

  private _changeCoordinate(zone: number, point: number, axis: "x" | "y", value: string): void {
    const drafts = this._drafts.map((zonePoints) => zonePoints.map((item) => ({ ...item })));
    drafts[zone][point][axis] = Number(value);
    this._drafts = drafts;
  }

  private async _saveZones(): Promise<void> {
    if (!this.hass) return;
    const errors = this._drafts.map((points) => validatePolygon(points));
    const invalidZone = errors.findIndex((error) => error);
    if (invalidZone !== -1) {
      this._message = `Zone ${invalidZone + 1}: ${errors[invalidZone]}`;
      return;
    }
    if (this._entities.zones.some((zone) => !zone.apply || zone.points.some((point) => !point.x || !point.y))) {
      this._message = "This device is missing editable zone entities.";
      return;
    }

    this._saving = true;
    this._message = "Saving all zones...";
    try {
      if (this._virtualStates) {
        this._entities.zones.forEach((zone, zoneIndex) => zone.points.forEach((point, pointIndex) => {
          this._virtualStates![point.x!].state = String(this._drafts[zoneIndex][pointIndex].x);
          this._virtualStates![point.y!].state = String(this._drafts[zoneIndex][pointIndex].y);
        }));
        this._message = "All zones saved to the virtual device.";
        return;
      }
      await Promise.all(this._entities.zones.flatMap((zone, zoneIndex) => zone.points.flatMap((point, pointIndex) => (
        (["x", "y"] as const).map((axis) => this.hass!.callService(
          "number",
          "set_value",
          { value: this._drafts[zoneIndex][pointIndex][axis] },
          { entity_id: point[axis]! },
        ))
      ))));
      await Promise.all(this._entities.zones.map((zone) => this.hass!.callService("button", "press", {}, { entity_id: zone.apply! })));
      this._message = "All zones saved to ESPHome.";
    } catch (error) {
      this._message = `Zone save failed: ${String(error)}`;
    } finally {
      this._saving = false;
    }
  }

  private async _toggle(entityId?: string): Promise<void> {
    if (entityId && this._virtualStates?.[entityId]) {
      this._virtualStates[entityId].state = this._virtualStates[entityId].state === "on" ? "off" : "on";
      this.requestUpdate();
      return;
    }
    if (entityId) await this.hass?.callService("switch", "toggle", {}, { entity_id: entityId });
  }

  private async _setNumber(entityId: string | undefined, value: string): Promise<void> {
    if (entityId && this._virtualStates?.[entityId]) {
      this._virtualStates[entityId].state = value;
      this.requestUpdate();
      return;
    }
    if (entityId && Number.isFinite(Number(value))) {
      await this.hass?.callService("number", "set_value", { value: Number(value) }, { entity_id: entityId });
    }
  }

  private async _select(entityId: string | undefined, option: string): Promise<void> {
    if (entityId && this._virtualStates?.[entityId]) {
      this._virtualStates[entityId].state = option;
      this.requestUpdate();
      return;
    }
    if (entityId) await this.hass?.callService("select", "select_option", { option }, { entity_id: entityId });
  }

  private async _press(entityId: string | undefined, warning: string): Promise<void> {
    if (entityId && window.confirm(warning)) {
      await this.hass?.callService("button", "press", {}, { entity_id: entityId });
    }
  }

  private async _toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    const map = this.renderRoot.querySelector<HTMLElement>(".map-wrap");
    await map?.requestFullscreen();
  }

  private _map() {
    const verticalLines = Array.from({ length: 13 }, (_, i) => i * 100);
    const horizontalLines = Array.from({ length: 7 }, (_, i) => i * 100);
    const maxDistance = this._number(this._entities.maxDistance);
    const minAngle = this._number(this._entities.minAngle);
    const maxAngle = this._number(this._entities.maxAngle);
    const fov = maxDistance !== undefined && minAngle !== undefined && maxAngle !== undefined
      ? fovSector(minAngle, maxAngle, maxDistance).map((point) => toSvg(point))
      : undefined;
    return html`
      <div class="map-wrap">
        <button class="fullscreen" @click=${this._toggleFullscreen} title=${this._fullscreen ? "Exit fullscreen" : "Open map fullscreen"} aria-label=${this._fullscreen ? "Exit fullscreen" : "Open map fullscreen"}>
          ${this._fullscreen
            ? html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg><span>Exit fullscreen</span>`
            : html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></svg><span>Fullscreen</span>`}
        </button>
        <svg class="map" viewBox="0 0 1200 600" role="img" aria-label="LD2450 live target map">
          <defs><clipPath id="map-bounds"><rect width="1200" height="600" /></clipPath></defs>
          <g class="grid">
            ${verticalLines.map((x) => svg`<line x1=${x} y1="0" x2=${x} y2="600" />`)}
            ${horizontalLines.map((y) => svg`<line x1="0" y1=${y} x2="1200" y2=${y} />`)}
          </g>
          <line class="axis" x1="600" y1="0" x2="600" y2="600" />
          ${fov ? svg`<g class="fov" clip-path="url(#map-bounds)">
            <polygon points=${fov.map((point) => `${point.x},${point.y}`).join(" ")} />
            <polyline points=${fov.slice(1).map((point) => `${point.x},${point.y}`).join(" ")} />
          </g>` : nothing}
           ${this._entities.zones.map((zone, zoneIndex) => {
             const points = this._zonePoints(zoneIndex);
             const screen = points.map((point) => toSvg(point));
             const active = this._state(zone.occupancy) === "on";
             return svg`
               <polygon class="zone ${active ? "occupied" : ""}" style="--zone:${colors[zoneIndex]}" points=${screen.map((p) => `${p.x},${p.y}`).join(" ")} />
               <text class="zone-label" x=${screen.reduce((sum, p) => sum + p.x, 0) / 4} y=${screen.reduce((sum, p) => sum + p.y, 0) / 4}>Z${zoneIndex + 1} · ${this._state(zone.count)}</text>
             `;
           })}
           ${this._editingZone !== undefined ? (() => {
             const zoneIndex = this._editingZone!;
             const screen = this._zonePoints(zoneIndex).map((point) => toSvg(point));
             return svg`<polygon class="zone-drag-area" points=${screen.map((p) => `${p.x},${p.y}`).join(" ")}
               @pointerdown=${(event: PointerEvent) => this._startZoneDrag(event, zoneIndex)}
               @pointermove=${(event: PointerEvent) => this._moveZone(event, zoneIndex)}
               @pointerup=${this._stopZoneDrag}
               @pointercancel=${this._stopZoneDrag} />`;
           })() : nothing}
           ${this._editingZone !== undefined ? (() => {
             const zoneIndex = this._editingZone!;
             return this._zonePoints(zoneIndex).map((point, pointIndex) => {
               const screen = toSvg(point);
               return svg`
                 <circle class="handle" style="--zone:${colors[zoneIndex]}" cx=${screen.x} cy=${screen.y} r="15"
                   @pointerdown=${(event: PointerEvent) => this._drag(event, zoneIndex, pointIndex)}
                   @pointermove=${(event: PointerEvent) => event.buttons && this._drag(event, zoneIndex, pointIndex)} />
               `;
             });
           })() : nothing}
           ${this._entities.targets.map((target, index) => {
            const x = this._number(target.x);
            const y = this._number(target.y);
            if (x === undefined || y === undefined || x < -6 || x > 6 || y < 0 || y > 6) return nothing;
             const point = toSvg({ x, y });
             return svg`
               <line class="target-line" style="--target:${colors[index]}" x1="600" y1="600" x2=${point.x} y2=${point.y} />
               <g class="target" style="--target:${colors[index]}" transform="translate(${point.x} ${point.y})">
                <circle class="target-pulse" r="26" /><circle r="11" />
                <text x="18" y="-14">T${index + 1}</text>
              </g>
            `;
          })}
           <g class="sensor" transform="translate(600 600)"><path d="M-28 0 L0 -25 L28 0 Z"/><path class="forward" d="M0 -45 V-100 M-12 -88 L0 -100 L12 -88"/><text x="40" y="-10">RADAR (0, 0)</text></g>
           <text class="scale" x="12" y="24">6 m</text><text class="scale" x="12" y="588">0 m</text>
           <text class="scale" x="8" y="575">-6 m</text><text class="scale" x="1135" y="575">+6 m</text>
           <text class="axis-label" x="612" y="38">Y: FORWARD</text>
           <text class="axis-label" x="24" y="548">X: LEFT</text><text class="axis-label" x="1080" y="548">X: RIGHT</text>
           ${fov ? svg`<text class="fov-label" x="618" y="570">DETECTION AREA: ${minAngle}° to ${maxAngle}°, ${maxDistance} m</text>` : nothing}
        </svg>
      </div>`;
  }

  private _zoneEditor() {
    if (this._editingZone === undefined) return nothing;
    const zone = this._editingZone;
    const error = validatePolygon(this._drafts[zone]);
    const hasErrors = this._drafts.some((points) => validatePolygon(points));
    return html`<section class="zone-editor">
      <div class="section-title"><strong>Editing Zone ${zone + 1}</strong><span class=${error ? "error" : "valid"}>${error ?? "Valid convex polygon"}</span></div>
      <div class="coordinates">
        ${this._drafts[zone].map((point, index) => html`<label>P${index + 1}
          <input type="number" min="-6" max="6" step="0.1" .value=${String(point.x)} @change=${(event: Event) => this._changeCoordinate(zone, index, "x", (event.target as HTMLInputElement).value)} aria-label="Point ${index + 1} X">
          <input type="number" min="0" max="6" step="0.1" .value=${String(point.y)} @change=${(event: Event) => this._changeCoordinate(zone, index, "y", (event.target as HTMLInputElement).value)} aria-label="Point ${index + 1} Y">
        </label>`)}
      </div>
      <div class="actions"><button @click=${this._cancelEdit}>Cancel</button><button class="primary" ?disabled=${hasErrors || this._saving} @click=${this._saveZones}>Save all zones to ESPHome</button></div>
    </section>`;
  }

  private _details() {
    return html`<div class="details">
      ${this._entities.targets.map((target, index) => html`<article class="target-card" style="--target:${colors[index]}">
        <div class="target-heading"><span></span><strong>Target ${index + 1}</strong><b>${this._number(target.x) === undefined ? "Not tracked" : "Tracked"}</b></div>
        <dl><div><dt>X / Y</dt><dd>${this._formattedState(target.x)} / ${this._formattedState(target.y)} m</dd></div><div><dt>Distance</dt><dd>${this._formattedState(target.distance)} m</dd></div><div><dt>Speed</dt><dd>${this._formattedState(target.speed)} m/s</dd></div><div><dt>Angle</dt><dd>${this._formattedState(target.angle)}°</dd></div><div><dt>Zone</dt><dd>${this._targetZone(target)}</dd></div></dl>
      </article>`)}
    </div>`;
  }

  private _controls() {
    if (!this._config?.show_controls) return nothing;
    const availableStates = this._virtualStates ?? this.hass?.states;
    const baudOptions: string[] = this._entities.baudRate
      ? (availableStates?.[this._entities.baudRate]?.attributes.options as string[] | undefined) ?? []
      : [];
    return html`<details class="controls"><summary>Sensor controls</summary><div class="control-grid">
      <button @click=${() => this._toggle(this._entities.trackingMode)}>Multi-target: ${this._state(this._entities.trackingMode)}</button>
      <button @click=${() => this._toggle(this._entities.bluetooth)}>Bluetooth: ${this._state(this._entities.bluetooth)}</button>
      <label>Maximum distance<input type="number" min="0" max="6" step="0.1" .value=${this._state(this._entities.maxDistance)} @change=${(event: Event) => this._setNumber(this._entities.maxDistance, (event.target as HTMLInputElement).value)}></label>
      <label>Minimum angle<input type="number" min="-90" max="90" step="1" .value=${this._state(this._entities.minAngle)} @change=${(event: Event) => this._setNumber(this._entities.minAngle, (event.target as HTMLInputElement).value)}></label>
      <label>Maximum angle<input type="number" min="-90" max="90" step="1" .value=${this._state(this._entities.maxAngle)} @change=${(event: Event) => this._setNumber(this._entities.maxAngle, (event.target as HTMLInputElement).value)}></label>
      <label>Baud rate<select .value=${this._state(this._entities.baudRate)} @change=${(event: Event) => this._select(this._entities.baudRate, (event.target as HTMLSelectElement).value)}>${baudOptions.map((option) => html`<option value=${option}>${option}</option>`)}</select></label>
      <button @click=${() => this._press(this._entities.restart, "Restart the LD2450 sensor?")}>Restart sensor</button>
      <button class="danger" @click=${() => this._press(this._entities.factoryReset, "Factory-reset the LD2450 sensor? This cannot be undone.")}>Factory reset</button>
    </div></details>`;
  }

  protected render() {
    if (!this._config?.device_id) return html`<ha-card><div class="empty"><strong>Select an ESPHome device</strong><p>Open the card editor and choose the device using the LD2450 package.</p></div></ha-card>`;
    return html`<ha-card class=${this._config.display_mode === "compact" ? "compact" : ""}>
      <header><div><p class="eyebrow">LIVE SPATIAL TRACKING</p><h2>${this._config.title ?? "LD2450 Live Map"}</h2></div><div class="status"><span class=${this._state(this._entities.occupancy) === "on" ? "live" : ""}></span>${this._state(this._entities.targetCount)} targets</div></header>
      ${this._map()}
      <nav class="zones">${this._entities.zones.map((zone, index) => html`<button style="--zone:${colors[index]}" class=${this._editingZone === index ? "selected" : ""} @click=${() => this._beginEdit(index)}><i></i>Zone ${index + 1}<small>${this._state(zone.occupancy)}</small></button>`)}</nav>
      ${this._zoneEditor()}
      ${this._message ? html`<p class="message" role="status">${this._message}</p>` : nothing}
      ${this._details()}
      ${this._controls()}
    </ha-card>`;
  }

  static styles = css`
    :host { --muted: var(--secondary-text-color, #64748b); display: block; }
    ha-card { container-type:inline-size; overflow: hidden; padding: 20px; background: var(--ha-card-background, var(--card-background-color)); }
    header { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:16px; }
    h2 { margin:2px 0 0; font-size:24px; letter-spacing:-.03em; }
    .eyebrow { color:var(--primary-color); font-size:10px; font-weight:800; letter-spacing:.16em; margin:0; }
    .status { background:var(--secondary-background-color); border-radius:999px; padding:8px 12px; font-size:12px; font-weight:700; }
    .status span { display:inline-block; width:8px; height:8px; margin-right:7px; border-radius:50%; background:var(--disabled-text-color); }
    .status span.live { background:#22c55e; box-shadow:0 0 0 4px color-mix(in srgb, #22c55e 18%, transparent); }
    .map-wrap { position:relative; border:1px solid var(--divider-color); border-radius:14px; overflow:hidden; background:color-mix(in srgb, var(--primary-background-color) 94%, var(--primary-color)); }
    .map-wrap:fullscreen { box-sizing:border-box; display:flex; align-items:center; width:100vw; height:100vh; padding:24px; border:0; border-radius:0; background:var(--primary-background-color); }
    .map { display:block; width:100%; touch-action:none; }
    .map-wrap:fullscreen .map { max-width:100%; max-height:100%; }
    .fullscreen { position:absolute; z-index:2; top:10px; right:10px; display:flex; align-items:center; gap:6px; padding:7px 9px; border-color:color-mix(in srgb, var(--divider-color) 75%, transparent); background:color-mix(in srgb, var(--card-background-color) 88%, transparent); box-shadow:0 2px 8px rgb(15 23 42 / 12%); backdrop-filter:blur(8px); font-size:11px; font-weight:700; }
    .fullscreen svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
    .map-wrap:fullscreen .fullscreen { top:18px; right:18px; }
    .grid line { stroke:var(--divider-color); stroke-width:1; }
    .axis { stroke:var(--secondary-text-color); stroke-width:2; stroke-dasharray:8 8; opacity:.65; }
    .fov polygon { fill:color-mix(in srgb, var(--primary-color) 13%, transparent); }
    .fov polyline { fill:none; stroke:var(--primary-color); stroke-width:3; stroke-dasharray:10 8; opacity:.8; }
    .zone { fill:color-mix(in srgb, var(--zone) 9%, transparent); stroke:var(--zone); stroke-width:3; stroke-dasharray:9 7; transition:fill .2s; }
    .zone.occupied { fill:color-mix(in srgb, var(--zone) 25%, transparent); stroke-width:5; }
    .zone-label { fill:var(--primary-text-color); font-size:18px; font-weight:800; text-anchor:middle; pointer-events:none; }
    .zone-drag-area { fill:transparent; cursor:move; }
    .handle { fill:var(--zone); stroke:var(--card-background-color); stroke-width:6; cursor:grab; }
    .target circle:not(.target-pulse) { fill:var(--target); stroke:white; stroke-width:4; }
    .target-pulse { fill:color-mix(in srgb, var(--target) 18%, transparent); stroke:var(--target); stroke-width:2; }
    .target-line { stroke:var(--target); stroke-width:2; stroke-dasharray:5 7; opacity:.5; pointer-events:none; }
    .target text { fill:var(--target); font-size:21px; font-weight:900; paint-order:stroke; stroke:var(--card-background-color); stroke-width:5px; }
    .sensor path { fill:var(--primary-text-color); } .sensor .forward { fill:none; stroke:var(--primary-text-color); stroke-width:4; stroke-linecap:round; stroke-linejoin:round; } .sensor text,.scale { fill:var(--muted); font-size:15px; font-weight:700; }
    .axis-label,.fov-label { fill:var(--muted); font-size:13px; font-weight:800; letter-spacing:.08em; }
    .fov-label { fill:var(--primary-color); letter-spacing:.04em; }
    .zones { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:12px; }
    button { border:1px solid var(--divider-color); border-radius:10px; color:var(--primary-text-color); background:var(--secondary-background-color); padding:10px 12px; cursor:pointer; font:inherit; }
    button:hover { border-color:var(--primary-color); } button:disabled { opacity:.45; cursor:not-allowed; }
    .zones button { min-width:0; display:flex; align-items:center; gap:8px; text-align:left; }
    .zones button.selected { outline:2px solid var(--zone); } .zones i,.target-heading span { width:9px;height:9px;border-radius:50%;background:var(--zone); }
    .zones small { min-width:0; margin-left:auto; color:var(--muted); overflow:hidden; text-overflow:ellipsis; text-transform:uppercase; white-space:nowrap; }
    .zone-editor { margin-top:12px; padding:14px; border:1px solid var(--divider-color); border-radius:12px; }
    .section-title,.actions { display:flex; justify-content:space-between; align-items:center; gap:12px; }
    .error { color:var(--error-color,#ef4444); } .valid { color:#16a34a; }
    .coordinates { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:12px 0; }
    .coordinates label { font-size:11px; color:var(--muted); font-weight:700; }
    input { box-sizing:border-box; width:100%; margin-top:4px; border:1px solid var(--divider-color); border-radius:7px; background:var(--primary-background-color); color:var(--primary-text-color); padding:7px; }
    .actions { justify-content:flex-end; } .primary { color:var(--text-primary-color,#fff); background:var(--primary-color); border-color:var(--primary-color); }
    .message { margin:12px 0 0; color:var(--muted); font-size:12px; }
    .details { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:14px; }
    .target-card { min-width:0; border:1px solid var(--divider-color); border-top:3px solid var(--target); border-radius:10px; padding:12px; }
    .target-heading { display:flex; align-items:center; gap:7px; } .target-heading span { background:var(--target); } .target-heading b { margin-left:auto; color:var(--muted); font-size:10px; text-transform:uppercase; }
    dl { min-width:0; margin:10px 0 0; } dl div { display:flex; flex-wrap:wrap; justify-content:space-between; gap:4px 8px; padding:3px 0; } dt { color:var(--muted); } dd { min-width:0; margin:0; font-weight:700; overflow-wrap:anywhere; text-align:right; }
    .controls { margin-top:14px; border-top:1px solid var(--divider-color); padding-top:12px; } summary { cursor:pointer; font-weight:700; }
    .control-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:10px; } .control-grid label { color:var(--muted); font-size:11px; font-weight:700; } select { box-sizing:border-box; width:100%; margin-top:4px; border:1px solid var(--divider-color); border-radius:7px; background:var(--primary-background-color); color:var(--primary-text-color); padding:7px; }
    .danger { color:var(--error-color,#ef4444); } .empty { padding:28px; text-align:center; } .empty p { color:var(--muted); }
    ha-card.compact { padding:12px; }
    .compact header { margin-bottom:8px; }
    .compact h2 { font-size:20px; }
    .compact .status { padding:5px 9px; }
    .compact .zones { gap:5px; margin-top:7px; }
    .compact .zones button { gap:6px; padding:6px 8px; border-radius:7px; font-size:12px; }
    .compact .zone-editor { margin-top:7px; padding:9px; }
    .compact .coordinates { gap:5px; margin:7px 0; }
    .compact input,.compact select { padding:5px; }
    .compact .message { margin-top:7px; }
    .compact .details { gap:6px; margin-top:8px; }
    .compact .target-card { padding:8px; border-radius:7px; }
    .compact dl { margin-top:5px; font-size:12px; }
    .compact dl div { padding:1px 0; }
    .compact .controls { margin-top:8px; padding-top:8px; }
    .compact .control-grid { gap:5px; margin-top:6px; }
    .compact .control-grid button { padding:6px 8px; font-size:12px; }
    @container (max-width:760px) { .details,.zones{grid-template-columns:repeat(2,minmax(0,1fr))} }
    @container (max-width:480px) { ha-card{padding:14px}.details,.zones{grid-template-columns:1fr}.coordinates,.control-grid{grid-template-columns:repeat(2,minmax(0,1fr))} h2{font-size:20px}.zone-label{font-size:25px}.target text{font-size:28px}.fullscreen span{display:none} }
  `;
}
