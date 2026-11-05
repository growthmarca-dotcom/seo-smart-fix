import type { ProposalItem, ProposalTotals, TotalsBlock } from "../model";
import { missingNames, money } from "./proposal-view";

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className={`flex justify-between gap-3 ${strong ? "font-semibold" : ""}`}><span>{label}</span><span className="tabular-nums">{value}</span></div>
);

function DirectRows({ c, d }: { c: string; d: TotalsBlock["direct"] }) {
  if (!d.total) return null;
  return (
    <div className="mt-2 rounded-md border border-dashed border-border p-2 text-xs">
      <p className="mb-1 font-medium">Pagos directos del cliente (no facturados por MarCa)</p>
      {Object.entries(d.adSpendByPlatform).map(([k, v]) => <Row key={`a${k}`} label={`Publicidad · ${k || "sin plataforma"}`} value={money(c, v)} />)}
      {Object.entries(d.externalByProvider).map(([k, v]) => <Row key={`e${k}`} label={`Licencias/gastos · ${k || "sin proveedor"}`} value={money(c, v)} />)}
    </div>
  );
}

function BlockCard({ b, items }: { b: TotalsBlock; items: ProposalItem[] }) {
  const c = b.currency;
  const rec = b.modality === "recurring";
  const suf = rec ? " / mes" : "";
  const miss = missingNames(b, items);
  const per = b.period;
  return (
    <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
      <p className="font-display font-semibold">{c} · {rec ? "Servicios recurrentes" : "Trabajos puntuales"}</p>
      {b.incomplete ? (
        <p role="alert" className="text-destructive">Cálculo incompleto: falta precio en {miss.join(", ") || "algún concepto"}.</p>
      ) : (
        <>
          <Row label={`Honorarios propios${suf}`} value={money(c, b.subtotals.ownFee)} />
          <Row label={`Colaboradores${suf}`} value={money(c, b.subtotals.collaborator)} />
          <Row label={`Coordinación${suf}`} value={money(c, b.subtotals.coordination)} />
          <Row label={`Licencias/gastos facturados por MarCa${suf}`} value={money(c, b.subtotals.externalBilled)} />
          {b.discounts.map((d) => <Row key={d.label} label={`Descuento · ${d.label}${suf}`} value={`− ${money(c, d.amountCents)}`} />)}
          {b.discountCapped && <p className="text-xs text-muted-foreground">Los descuentos se limitaron para no superar los honorarios.</p>}
          <Row label={`Base imponible${suf}`} value={money(c, b.billedTotal)} />
          {b.vatPercent !== undefined && <Row label={`IVA ${b.vatPercent}%${suf}`} value={money(c, b.vatCents)} />}
          <Row strong label={`Total facturado por MarCa${suf}`} value={money(c, b.billedTotalWithVat)} />
        </>
      )}
      {rec && per && (
        <div className="mt-2 border-t border-border pt-2">
          {per.incomplete ? (
            <p role="alert" className="text-destructive">Total del período incompleto: faltan {per.missingMonthsItemIds.length ? "meses" : "precios"} en {miss.join(", ") || "algún concepto"}.</p>
          ) : (
            <>
              {per.discountTotal ? <Row label="Descuentos aplicados en el período" value={`− ${money(c, per.discountTotal)}`} /> : null}
              <Row label="Base imponible del período" value={money(c, per.billedTotal)} />
              {b.vatPercent !== undefined && <Row label="IVA del período" value={money(c, per.vatCents)} />}
              <Row strong label={`Total facturado del período${per.months ? ` (hasta ${per.months} meses)` : ""}`} value={money(c, per.billedTotalWithVat)} />
            </>
          )}
        </div>
      )}
      <DirectRows c={c} d={b.direct} />
    </div>
  );
}

/** Desglose por moneda y modalidad. Solo muestra valores de `computeTotals`; nunca suma monedas. */
export function TotalsBreakdown({ totals, items }: { totals: ProposalTotals; items: ProposalItem[] }) {
  if (totals.blocks.length === 0) return <p className="text-sm text-muted-foreground">Agregá conceptos para ver el desglose.</p>;
  return (
    <div className="space-y-3">
      {totals.multiCurrency && <p className="text-xs text-muted-foreground">Hay varias monedas: cada una se muestra por separado, sin total combinado.</p>}
      {totals.blocks.map((b) => <BlockCard key={`${b.currency}-${b.modality}`} b={b} items={items} />)}
    </div>
  );
}
