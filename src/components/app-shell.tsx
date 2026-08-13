import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  History,
  LayoutDashboard,
  Menu,
  PlugZap,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/store/app-store";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/audits/new", label: "Nueva auditoría", icon: Sparkles },
  { to: "/audits", label: "Auditorías", icon: BarChart3 },
  { to: "/changes", label: "Sugerencias y cambios", icon: ClipboardCheck },
  { to: "/integrations", label: "Integraciones", icon: PlugZap },
  { to: "/rules", label: "Reglas SEO", icon: ShieldCheck },
  { to: "/history", label: "Historial", icon: History },
  { to: "/settings", label: "Configuración", icon: Settings },
] as const;

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pending = useAppState((s) => s.changes.filter((c) => c.status === "pending").length);

  return (
    <div className="flex h-full flex-col gap-6 bg-sidebar p-4 text-sidebar-foreground">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-2.5 px-2 pt-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Search className="size-5" />
        </span>
        <span className="leading-tight">
          <span className="block font-display text-base font-bold">SEO Fixer</span>
          <span className="block text-[11px] text-sidebar-foreground/60">
            Auditoría & optimización
          </span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
              {to === "/changes" && pending > 0 && (
                <span className="ml-auto rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-primary-foreground">
                  {pending}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs text-sidebar-foreground/70">
        <Activity className="mb-1.5 size-4 text-sidebar-primary" />
        Motor SEO universal. Las plataformas se conectan como módulos independientes.
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-sidebar-border lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent />
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="Menú">
            <Menu className="size-5" />
          </Button>
          <span className="font-display font-bold">SEO Fixer</span>
        </header>
        {open && (
          <div className="border-b border-sidebar-border lg:hidden">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        )}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
