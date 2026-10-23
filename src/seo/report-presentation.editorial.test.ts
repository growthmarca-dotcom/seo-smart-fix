import { describe, expect, it } from "vitest";
import type { Diagnostic } from "./diagnostics";
import type { PageSnapshot } from "./types";
import { MANUAL_VALIDATION_LABELS, MANUAL_VALIDATION_RULES, isShortMetaDescription, reportRecommendation } from "./report-presentation";

const diag = (o: Partial<Diagnostic>): Diagnostic =>
  ({ key: "k", pageId: "p1", pageUrl: "https://x.com/a", ruleId: "x", current: "", detected: "", evidence: [], ...o }) as Diagnostic;
const page = (o: Partial<PageSnapshot> = {}) => ({ id: "p1", url: "https://x.com/a", ...o }) as PageSnapshot;
const rec = (ruleId: string, o: Partial<Diagnostic> = {}, p?: PageSnapshot) =>
  reportRecommendation(diag({ ruleId, ...o }), p, false)!.text;

describe("correcciones editoriales del informe", () => {
  it("meta description larga (texto con 'recortarse') no recomienda ampliar", () => {
    const d = diag({ ruleId: "meta-description-length", detected: "La descripción supera la longitud recomendada y puede recortarse." });
    expect(isShortMetaDescription(d, undefined)).toBe(false);
    expect(rec("meta-description-length", { detected: d.detected })).toContain("160 caracteres o menos");
    expect(rec("meta-description-length", {}, page({ metaDescription: "a".repeat(205) }))).not.toMatch(/Ampliar/);
  });
  it("meta description corta recomienda ampliar", () => {
    expect(rec("meta-description-length", { detected: "La descripción es más corta de lo recomendado." })).toMatch(/^Ampliar/);
    expect(rec("meta-description-length", {}, page({ metaDescription: "corta" }))).toMatch(/^Ampliar/);
  });
  it("h1-missing da una acción y no el title de la página", () => {
    const t = rec("h1-missing", { suggestion: "Contacto | MarCa" } as Partial<Diagnostic>, page({ title: "Contacto | MarCa" }));
    expect(t).toContain("H1");
    expect(t).not.toContain("Contacto | MarCa");
  });
  it("SEO local no exige dirección u horarios a todo negocio", () => {
    expect(rec("local-nap")).toMatch(/remota/);
    expect(rec("local-nap")).toMatch(/si corresponde/);
    expect(rec("local-business-schema")).toMatch(/solo si existen/);
  });
  it("ALT sin ejemplos de producto y admite ALT vacío decorativo", () => {
    const t = rec("images-alt");
    expect(t).not.toMatch(/vista frontal|producto/i);
    expect(t).toMatch(/decorativa.*ALT vacío/);
  });
  it("nombres de archivo: no asegura que se puedan renombrar", () => {
    const t = rec("image-filenames");
    expect(t).toMatch(/Cuando la plataforma lo permita/);
    expect(t).toMatch(/no puede editarse/);
    expect(t).not.toMatch(/Hostinger/);
  });
  it("title duplicado no sugiere eliminar ni habla de plantilla", () => {
    const t = rec("duplicate-title");
    expect(t).toMatch(/title único/);
    expect(t).not.toMatch(/eliminar|plantilla/i);
  });
  it("orphan-page va a validación manual en el plan", () => {
    expect(MANUAL_VALIDATION_RULES.has("orphan-page")).toBe(true);
    expect(MANUAL_VALIDATION_LABELS["orphan-page"]).toBe("Validación manual: posibles páginas huérfanas");
  });
});
