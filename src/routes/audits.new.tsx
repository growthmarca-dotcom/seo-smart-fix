import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-shell";
import { DemoBadge } from "@/components/seo-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CONNECTORS, getConnector } from "@/seo/connectors";
import { buildDemoSite, DEMO_ROOT_URL, DEMO_STORE_NAME } from "@/seo/demo";
import { analyzeUrlFn, crawlSiteFn } from "@/lib/crawl.functions";
import { actions, createAuditFromSite, useAppState } from "@/store/app-store";
import type { PlatformId, SiteContext } from "@/seo/types";

export const Route = createFileRoute("/audits/new")({
  head: () => ({
    meta: [
      { title: "Nueva auditoría SEO — SEO Fixer" },
      {
        name: "description",
        content:
          "Auditá cualquier sitio a partir de su URL raíz: descubrimiento por sitemap, rastreo interno y análisis página por página.",
      },
      { property: "og:title", content: "Nueva auditoría SEO — SEO Fixer" },
      {
        property: "og:description",
        content: "Descubrimiento por sitemap, rastreo interno y análisis por URL.",
      },
    ],
  }),
  component: NewAudit,
});

const LIMITS = [50, 100, 250, 500, 1000];

function NewAudit() {
  const navigate = useNavigate();
  const settings = useAppState((s) => s.settings);
  const crawl = useServerFn(crawlSiteFn);
  const analyzeOne = useServerFn(analyzeUrlFn);

  const [platform, setPlatform] = useState<PlatformId>("generic-web");
  const [rootUrl, setRootUrl] = useState("");
  const [singleUrl, setSingleUrl] = useState("");
  const [limit, setLimit] = useState(settings.defaultCrawlLimit);
  const [respectRobots, setRespectRobots] = useState(settings.respectRobots);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ discovered: number; analyzed: number; issues: number } | null>(
    null,
  );
  const [errors, setErrors] = useState<string[]>([]);

  const connector = getConnector(platform);

  function finish(site: SiteContext, name: string, isDemo: boolean) {
    const audit = createAuditFromSite(site, {
      name,
      platform: site.platform,
      rootUrl: site.rootUrl,
      isDemo,
      crawlLimit: limit,
      respectRobots,
    });
    actions.addAudit(audit);
    setProgress({
      discovered: site.coverage?.discovered ?? site.pages.length,
      analyzed: site.pages.length,
      issues: audit.findings.length,
    });
    toast.success(`Auditoría lista: ${audit.findings.length} hallazgos en ${audit.pages.length} URLs`);
    void navigate({ to: "/audits/$auditId", params: { auditId: audit.id } });
  }

  async function runSiteAudit() {
    if (!rootUrl.trim()) {
      toast.error("Ingresá una URL raíz.");
      return;
    }
    setRunning(true);
    setErrors([]);
    setProgress({ discovered: 0, analyzed: 0, issues: 0 });
    try {
      const res = await crawl({ data: { rootUrl: rootUrl.trim(), limit, respectRobots } });
      if (!res.ok) {
        toast.error(res.error);
        setErrors([res.error]);
        return;
      }
      const r = res.result;
      if (r.pages.length === 0) {
        setErrors(r.errors.length ? r.errors : ["No se pudo obtener ninguna página del sitio."]);
        toast.error("El rastreo no devolvió páginas analizables.");
        return;
      }
      setErrors(r.errors);
      const site: SiteContext = {
        rootUrl: r.pages[0]!.url,
        platform,
        robotsTxt: {
          found: r.robotsFound,
          disallowsAll: r.robotsDisallowAll,
          sitemapDeclared: r.sitemapFound,
          state: r.robotsState,
        },
        sitemap: { found: r.sitemapFound, urlCount: r.sitemapUrlCount, docs: r.sitemapDocs },
        pages: r.pages,
        brokenLinks: r.brokenLinks,
        coverage: r.coverage,
      };

      finish(site, `${new URL(r.pages[0]!.url).host} — ${new Date().toLocaleDateString("es-AR")}`, false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error inesperado durante el rastreo.");
    } finally {
      setRunning(false);
    }
  }

  async function runSingleUrl() {
    if (!singleUrl.trim()) {
      toast.error("Ingresá la URL a analizar.");
      return;
    }
    setRunning(true);
    setErrors([]);
    try {
      const res = await analyzeOne({ data: { url: singleUrl.trim() } });
      if (!res.ok || !res.page) {
        toast.error(!res.ok ? res.error : "No se pudo analizar la URL.");
        return;
      }
      const site: SiteContext = {
        rootUrl: res.page.url,
        platform,
        pages: [res.page],
      };
      finish(site, `URL puntual — ${res.page.path}`, false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setRunning(false);
    }
  }

  function runDemo() {
    finish(buildDemoSite(platform), `${DEMO_STORE_NAME} — ${new Date().toLocaleDateString("es-AR")}`, true);
  }

  return (
    <>
      <PageHeader
        title="Nueva auditoría"
        description="Elegí el origen de los datos. El motor de análisis es el mismo para todas las plataformas."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="panel p-5">
          <div className="mb-5 grid gap-2 sm:max-w-xs">
            <Label>Conector / plataforma</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as PlatformId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONNECTORS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.status !== "available" ? " (pendiente de credenciales)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{connector?.description}</p>
          </div>

          {connector?.status !== "available" ? (
            <div className="rounded-lg border border-important/40 bg-important-soft/60 p-4 text-sm">
              <p className="font-semibold">Conector aún no autorizado</p>
              <p className="mt-1 text-muted-foreground">
                {connector?.name} requiere credenciales y autorización OAuth reales. La arquitectura
                del conector ya está definida (campos legibles y modificables). Mientras tanto podés
                auditar la tienda por su web pública o usar los datos demo.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setPlatform("generic-web")}>
                  Auditar como web pública
                </Button>
                <Button variant="secondary" onClick={runDemo}>
                  <Sparkles className="mr-1 size-4" /> Probar con datos demo
                </Button>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="site">
              <TabsList>
                <TabsTrigger value="site">Sitio completo</TabsTrigger>
                <TabsTrigger value="url">URL puntual</TabsTrigger>
                <TabsTrigger value="demo">Demo</TabsTrigger>
              </TabsList>

              <TabsContent value="site" className="mt-5 space-y-5">
                <div className="grid gap-2">
                  <Label htmlFor="rootUrl">URL raíz</Label>
                  <Input
                    id="rootUrl"
                    placeholder="https://mitienda.com"
                    value={rootUrl}
                    onChange={(e) => setRootUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se buscará sitemap.xml y se rastrearán enlaces internos del mismo dominio.
                  </p>
                </div>

                <div className="grid gap-2 sm:max-w-xs">
                  <Label>Límite de URLs</Label>
                  <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIMITS.map((l) => (
                        <SelectItem key={l} value={String(l)}>
                          {l} URLs
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Evita rastreos indiscriminados. El rastreo se detiene al alcanzar el límite.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Respetar robots.txt</p>
                    <p className="text-xs text-muted-foreground">
                      Las rutas bloqueadas se omiten y se informan; solo se detiene si bloquea todo el sitio.
                      Si robots.txt no se puede leer, solo se analiza la página de inicio.
                    </p>
                  </div>
                  <Switch checked={respectRobots} onCheckedChange={setRespectRobots} />
                </div>

                <Button onClick={runSiteAudit} disabled={running}>
                  {running ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <Play className="mr-1 size-4" />
                  )}
                  {running ? "Rastreando…" : "Iniciar auditoría"}
                </Button>
              </TabsContent>

              <TabsContent value="url" className="mt-5 space-y-5">
                <div className="grid gap-2">
                  <Label htmlFor="singleUrl">URL a analizar</Label>
                  <Input
                    id="singleUrl"
                    placeholder="https://mitienda.com/productos/campera"
                    value={singleUrl}
                    onChange={(e) => setSingleUrl(e.target.value)}
                  />
                </div>
                <Button onClick={runSingleUrl} disabled={running}>
                  {running ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <Play className="mr-1 size-4" />
                  )}
                  Analizar URL
                </Button>
              </TabsContent>

              <TabsContent value="demo" className="mt-5 space-y-4">
                <div className="flex items-center gap-2">
                  <DemoBadge />
                  <span className="text-sm font-medium">{DEMO_STORE_NAME}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tienda ficticia con productos, categorías y artículos ya cargados en{" "}
                  {DEMO_ROOT_URL}. Ideal para recorrer el flujo completo: resultados → detalle →
                  sugerencia → aprobación → historial.
                </p>
                <Button onClick={runDemo}>
                  <Sparkles className="mr-1 size-4" /> Generar auditoría demo
                </Button>
              </TabsContent>
            </Tabs>
          )}

          {progress && (
            <div className="mt-6 grid gap-3 rounded-lg border border-border bg-muted/50 p-4 sm:grid-cols-3">
              <ProgressStat label="URLs descubiertas" value={progress.discovered} />
              <ProgressStat label="URLs analizadas" value={progress.analyzed} />
              <ProgressStat label="Problemas encontrados" value={progress.issues} />
            </div>
          )}

          {errors.length > 0 && (
            <div className="mt-4 rounded-lg border border-critical/30 bg-critical-soft/60 p-4 text-xs">
              <p className="mb-1 font-semibold text-critical">Errores durante el rastreo</p>
              <ul className="space-y-1 text-muted-foreground">
                {errors.slice(0, 8).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="panel h-fit p-5">
          <h2 className="font-display text-base font-semibold">Qué se analiza</h2>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            {[
              "On-page: title, meta description, headings, URL, contenido, imágenes y ALT",
              "Técnico: indexabilidad, robots.txt, sitemap, canonical, códigos HTTP, redirecciones, profundidad",
              "Datos estructurados: detección y validación básica de Schema.org",
              "Rendimiento/UX: viewport móvil, peso de página e imágenes",
              "SEO local: NAP y marcado LocalBusiness",
              "Contenido y enlazado interno: duplicados, thin content, anchors",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {t}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}

function ProgressStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold">{value}</p>
    </div>
  );
}
