import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
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
import { actions, useAppState } from "@/store/app-store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Configuración — SEO Fixer" },
      {
        name: "description",
        content: "Límites de rastreo, respeto de robots.txt, marca e idioma de las sugerencias.",
      },
      { property: "og:title", content: "Configuración — SEO Fixer" },
      { property: "og:description", content: "Preferencias de rastreo y de generación de sugerencias." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useAppState((s) => s.settings);

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Preferencias por defecto para nuevas auditorías. La app está preparada para migrar a autenticación y persistencia real: hoy los datos viven en este navegador."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-5 p-5">
          <h2 className="font-display text-base font-semibold">Control de rastreo</h2>

          <div className="grid gap-2 sm:max-w-xs">
            <Label>Límite de URLs por defecto</Label>
            <Select
              value={String(settings.defaultCrawlLimit)}
              onValueChange={(v) => actions.updateSettings({ defaultCrawlLimit: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[50, 100, 250, 500, 1000].map((l) => (
                  <SelectItem key={l} value={String(l)}>
                    {l} URLs
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Respetar robots.txt</p>
              <p className="text-xs text-muted-foreground">
                Detiene el rastreo si el sitio lo bloquea por completo.
              </p>
            </div>
            <Switch
              checked={settings.respectRobots}
              onCheckedChange={(v) => actions.updateSettings({ respectRobots: v })}
            />
          </div>
        </div>

        <div className="panel space-y-5 p-5">
          <h2 className="font-display text-base font-semibold">Sugerencias</h2>
          <div className="grid gap-2">
            <Label htmlFor="brand">Marca (se usa en titles sugeridos)</Label>
            <Input
              id="brand"
              value={settings.brandName}
              onChange={(e) => actions.updateSettings({ brandName: e.target.value })}
            />
          </div>
          <div className="grid gap-2 sm:max-w-xs">
            <Label>Idioma / mercado</Label>
            <Select
              value={settings.locale}
              onValueChange={(v) => actions.updateSettings({ locale: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es-AR">Español (Argentina)</SelectItem>
                <SelectItem value="es-ES">Español (España)</SelectItem>
                <SelectItem value="es-MX">Español (México)</SelectItem>
                <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="panel space-y-3 p-5 lg:col-span-2">
          <h2 className="font-display text-base font-semibold">Datos demo</h2>
          <p className="text-sm text-muted-foreground">
            Reiniciar borra auditorías, cambios e historial de este navegador y vuelve a generar la
            tienda demo Outdoor Patagonia.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              actions.resetDemo();
              toast.success("Datos reiniciados con la auditoría demo");
            }}
          >
            Reiniciar datos demo
          </Button>
        </div>
      </div>
    </>
  );
}
