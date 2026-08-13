import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, SEVERITY_LABELS } from "@/seo/rules";
import { scoreLabel } from "@/seo/engine";
import type { Category, PageType, Severity } from "@/seo/types";

const SEVERITY_CLASSES: Record<Severity, string> = {
  critical: "bg-critical-soft text-critical border-critical/30",
  important: "bg-important-soft text-important-foreground border-important/40",
  improvement: "bg-improvement-soft text-improvement border-improvement/30",
  ok: "bg-okay-soft text-okay border-okay/30",
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        SEVERITY_CLASSES[severity],
        className,
      )}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {CATEGORY_LABELS[category]}
    </span>
  );
}

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  home: "Home",
  product: "Producto",
  category: "Categoría",
  article: "Artículo",
  landing: "Landing",
  contact: "Contacto",
  other: "Otra",
};

export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-accent/50 bg-accent/20 px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
      Datos demo
    </span>
  );
}

export function ScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(score, 100)) / 100);
  const tone =
    score >= 85 ? "var(--okay)" : score >= 70 ? "var(--primary)" : score >= 50 ? "var(--important)" : "var(--critical)";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold">{score}</span>
        <span className="text-[11px] font-medium text-muted-foreground">{scoreLabel(score)}</span>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "critical" | "important" | "okay";
  icon?: ReactNode;
}) {
  const toneClass = {
    default: "text-foreground",
    critical: "text-critical",
    important: "text-important-foreground",
    okay: "text-okay",
  }[tone];

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon}
      </div>
      <div className={cn("mt-2 font-display text-2xl font-bold", toneClass)}>{value}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-14 text-center">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
