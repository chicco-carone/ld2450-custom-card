import { LitElement, css, html } from "lit";
import type { CardConfig, HomeAssistant, RegistryDevice, RegistryEntity } from "./types";
import { VIRTUAL_DEVICE_ID } from "./virtual-device";

export class Ld2450ZoneCardEditor extends LitElement {
  static properties = { hass: { attribute: false }, _config: { state: true }, _devices: { state: true } };
  hass?: HomeAssistant;
  private _config: CardConfig = { type: "custom:ld2450-zone-card", show_controls: true };
  private _devices: RegistryDevice[] = [];
  private _loaded = false;

  setConfig(config: CardConfig): void { this._config = { show_controls: true, ...config }; }

  protected updated(): void {
    if (this.hass && !this._loaded) {
      this._loaded = true;
      void Promise.all([
        this.hass.callWS<RegistryDevice[]>({ type: "config/device_registry/list" }),
        this.hass.callWS<RegistryEntity[]>({ type: "config/entity_registry/list" }),
      ]).then(([devices, entities]) => {
        const signatures = new Map<string, Set<string>>();
        for (const entity of entities) {
          const deviceId = entity.device_id ?? entity.di;
          if (!deviceId || entity.disabled_by) continue;
          const name = String(entity.original_name ?? entity.name ?? entity.en ?? entity.hn ?? "").toLowerCase();
          const found = signatures.get(deviceId) ?? new Set<string>();
          if (name.includes("ld2450 target 1 x position")) found.add("target");
          if (name.includes("ld2450 zone 1 point 1 x")) found.add("zone");
          signatures.set(deviceId, found);
        }
        this._devices = devices.filter((device) => signatures.get(device.id)?.size === 2);
      });
    }
  }

  private _change(key: keyof CardConfig, value: string | boolean): void {
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
  }

  protected render() {
    return html`<div>
      <label>ESPHome device<select .value=${this._config.device_id ?? ""} @change=${(event: Event) => this._change("device_id", (event.target as HTMLSelectElement).value)}>
        <option value="">Select a device</option>
        <option value=${VIRTUAL_DEVICE_ID}>Virtual LD2450 (UI test)</option>
        ${this._devices.map((device) => html`<option value=${device.id}>${device.name_by_user ?? device.name ?? device.id}</option>`)}
      </select></label>
      <label>Card title<input .value=${this._config.title ?? ""} placeholder="LD2450 Live Map" @input=${(event: Event) => this._change("title", (event.target as HTMLInputElement).value)}></label>
      <label>Display density<select .value=${this._config.display_mode ?? "normal"} @change=${(event: Event) => this._change("display_mode", (event.target as HTMLSelectElement).value)}>
        <option value="normal">Normal</option>
        <option value="compact">Compact</option>
      </select></label>
      <label class="check"><input type="checkbox" .checked=${this._config.show_controls !== false} @change=${(event: Event) => this._change("show_controls", (event.target as HTMLInputElement).checked)}> Show advanced sensor controls</label>
    </div>`;
  }

  static styles = css`div{display:grid;gap:16px;padding:8px 0}label{display:grid;gap:6px;color:var(--primary-text-color);font-weight:500}input,select{box-sizing:border-box;width:100%;padding:10px;border:1px solid var(--divider-color);border-radius:8px;background:var(--card-background-color);color:var(--primary-text-color)}.check{display:flex;align-items:center}.check input{width:auto}`;
}
