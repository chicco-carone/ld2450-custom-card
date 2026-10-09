# LD2450 Zone Card

A Home Assistant custom card for the [TillFleisch ESPHome HLK-LD2450 component](https://github.com/TillFleisch/ESPHome-HLK-LD2450). It plots all three radar targets, edits three four-point convex zones, and exposes the sensor's controls.

The included ESPHome package is required. A frontend card cannot create firmware-side zones by itself. Once the package has been flashed, zone coordinates can be edited and restored without changing YAML or reflashing.

## Features

- Live X/Y map for three targets at a default 500 ms refresh
- Three independently colored convex four-point zones
- Mouse and touch corner dragging with numeric coordinate inputs
- Client-side polygon validation and explicit atomic save
- Zone occupancy and target counts
- Target speed, distance, and angle details
- Detection limits, tracking mode, Bluetooth, baud rate, restart, and factory reset controls
- Visual editor with ESPHome device discovery
- Responsive Home Assistant-themed layout

## Hardware

Connect the LD2450 to a hardware UART. The examples default to:

| LD2450 | ESP32 |
| --- | --- |
| TX | GPIO16 (RX) |
| RX | GPIO17 (TX) |
| GND | GND |
| 5V | 5V |

Use a reliable 5 V supply. The component author reports unstable behavior when powering some LD2450 modules from 3.3 V.

## ESPHome Setup

Copy or remotely include `packages/ld2450-zone-card.yaml` in your ESPHome configuration. `examples/ld2450-complete.yaml` is a complete ESP32 example and `examples/ld2450-sensor-only.yaml` shows the composable package block.

To include the released package remotely:

```yaml
packages:
  ld2450_zone_card:
    url: https://github.com/chicco-carone/ld2450-custom-card
    ref: v0.1.0
    files:
      - packages/ld2450-zone-card.yaml
```

HACS installs only the frontend card, not this ESPHome package.

The package supports these substitutions:

```yaml
substitutions:
  ld2450_rx_pin: GPIO16
  ld2450_tx_pin: GPIO17
  ld2450_target_update_interval: 500ms
  ld2450_flip_x_axis: "false"
  ld2450_fast_off_detection: "true"
  ld2450_zone_1_name: Left
  ld2450_zone_1_margin: 25cm
  ld2450_zone_1_timeout: 5s
```

Equivalent name, margin, and timeout substitutions exist for zones 2 and 3. Stable `LD2450 Zone 1` through `3` markers are retained in the child entity names for card discovery.

Compile and flash the device once. The package creates restored coordinate numbers and applies them during boot.

## HACS Installation

1. In HACS, open the three-dot menu → **Custom repositories**.
2. Add `https://github.com/chicco-carone/ld2450-custom-card` with type **Dashboard** (called **Lovelace** in older HACS versions).
3. Install **LD2450 Zone Card**.
4. Reload the browser after HACS adds the module resource.
5. Add the card from the dashboard card picker.
6. Select the ESPHome device flashed with the included package.

If HACS does not add the resource automatically, add `/hacsfiles/ld2450-custom-card/ld2450-custom-card.js` under **Settings → Dashboards → Resources** as a **JavaScript module** (enable advanced mode to see Resources).

For manual installation, download `ld2450-custom-card.js` from the [latest release](https://github.com/chicco-carone/ld2450-custom-card/releases/latest), copy it to `config/www/ld2450-custom-card.js`, and register `/local/ld2450-custom-card.js` as a JavaScript module resource. You can also build the file yourself with `bun run build`; the output is `dist/ld2450-custom-card.js`.

Minimal YAML card configuration:

```yaml
type: custom:ld2450-zone-card
device_id: HOME_ASSISTANT_DEVICE_REGISTRY_ID
title: Office radar
show_controls: true
display_mode: normal
```

Using the visual editor is recommended because it supplies the device registry ID.

Choose **Virtual LD2450 (UI test)** in the device selector to test the complete card without ESPHome hardware. The built-in virtual device animates three targets and supports local zone saves and controls; it does not create entities in Home Assistant.

Set `display_mode: compact` or choose **Compact** in the visual editor to reduce card padding, spacing, control size, and target-panel density without hiding features.

## Zone Editing

1. Select a zone below the map.
2. Drag its four handles or enter X/Y values.
3. Keep the polygon convex, non-intersecting, and inside X -6..6 m and Y 0..6 m.
4. Select **Save to ESPHome**.

The card writes the eight draft number entities and then presses one Apply button. ESPHome updates the complete polygon in one action, avoiding invalid intermediate shapes.

## Recorder

At 500 ms, target metrics generate frequent state changes. Exclude them from Recorder if historical graphs are unnecessary:

```yaml
recorder:
  exclude:
    entity_globs:
      - sensor.*ld2450_target_*_x_position
      - sensor.*ld2450_target_*_y_position
      - sensor.*ld2450_target_*_speed
      - sensor.*ld2450_target_*_distance
      - sensor.*ld2450_target_*_angle
      - sensor.*ld2450_target_*_distance_resolution
```

## Development

The frontend uses Bun, TypeScript, and Lit. ESPHome validation runs through uv.

```sh
bun install
bun run dev
bun run check
bun test
bun run build
uv run esphome config examples/ld2450-complete.yaml
```

Run all checks with `bun run validate`.

The built `dist/ld2450-custom-card.js` is committed so HACS can install the default branch too. Rebuild and commit it whenever the frontend changes. GitHub Actions checks types, tests, the bundle, ESPHome configuration, and HACS compatibility.

### Releases

Update the version in `package.json`, `pyproject.toml`, and the banner in `src/index.ts`, rebuild the bundle, and commit the changes. Push a matching tag (for example `v0.1.1`); the release workflow validates the project and publishes `ld2450-custom-card.js` as a GitHub release asset for HACS.

`bun run dev` starts a Vite server with hot module replacement and a simulated ESPHome device. Open the URL printed by Vite, normally `http://localhost:5173`. Target positions animate every 500 ms and the mock service layer supports zone saves and sensor controls.

## Notes

- Zone margins and target timeouts are firmware settings controlled through package substitutions.
- The card supports exactly three zones with four points each.
- Factory reset and restart actions require confirmation.
- The external component uses the `flo-rian/ESPHome-HLK-LD2450` compatibility branch `pr/esphome-2026-compat` for ESPHome 2026.7; that branch may change upstream.
