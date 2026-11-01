import { describe, expect, it } from "vitest";
import { CONTROLS } from "@/diagnosis/dimensions";
import { SEO_CONTROL_ID } from "@/diagnosis/scoring";
import { WORK_AREAS, suggestedAreasFor } from "./work-areas";

describe("áreas de trabajo", () => {
  it("cada control referenciado existe en el catálogo y no es SEO ni integración", () => {
    const byId = new Map(CONTROLS.map((c) => [c.id, c]));
    for (const a of WORK_AREAS)
      for (const id of a.suggestedFor) {
        expect(byId.has(id), `${a.id}→${id}`).toBe(true);
        expect(id).not.toBe(SEO_CONTROL_ID);
        expect(byId.get(id)!.source).not.toBe("integration");
      }
  });
  it("ChatGPT Ads está inactiva y no se sugiere", () => {
    expect(WORK_AREAS.find((a) => a.id === "chatgpt-ads")!.active).toBe(false);
    expect(suggestedAreasFor("opp-channels").map((a) => a.id)).not.toContain("chatgpt-ads");
  });
  it("WhatsApp sugiere WhatsApp Business", () => {
    expect(suggestedAreasFor("ch-whatsapp").map((a) => a.id)).toContain("whatsapp");
  });
});
