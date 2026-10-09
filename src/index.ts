import { Ld2450ZoneCard } from "./card";
import { Ld2450ZoneCardEditor } from "./editor";

if (!customElements.get("ld2450-zone-card")) customElements.define("ld2450-zone-card", Ld2450ZoneCard);
if (!customElements.get("ld2450-zone-card-editor")) customElements.define("ld2450-zone-card-editor", Ld2450ZoneCardEditor);

window.customCards = window.customCards ?? [];
window.customCards.push({
  type: "ld2450-zone-card",
  name: "LD2450 Zone Card",
  description: "Live three-target map and ESPHome polygon zone editor",
  preview: true,
});

console.info("%c LD2450 ZONE CARD %c 0.1.0 ", "color:white;background:#087ea4;font-weight:700", "color:#087ea4;background:#e0f2fe");
