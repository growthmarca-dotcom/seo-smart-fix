import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  COMPANY_STATUS_LABELS,
  INDUSTRY_LABELS,
  validateCompanyInput,
  type CompanyInput,
  type CompanyStatus,
  type Industry,
} from "@/companies/model";

const EMPTY: CompanyInput = { tradeName: "", industry: "tourism-lodging", status: "prospect" };

type TextKey = "tradeName" | "legalName" | "website" | "contactName" | "email" | "phone" | "location";
const FIELDS: { key: TextKey; label: string; placeholder?: string; required?: boolean }[] = [
  { key: "tradeName", label: "Nombre comercial", required: true },
  { key: "legalName", label: "Razón social" },
  { key: "website", label: "Sitio web", placeholder: "ejemplo.com.ar" },
  { key: "location", label: "Localidad", placeholder: "San Martín de los Andes, Neuquén" },
  { key: "contactName", label: "Persona de contacto" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Teléfono" },
];

export function CompanyForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: CompanyInput;
  submitLabel: string;
  onSubmit: (input: CompanyInput) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState<CompanyInput>(initial ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateCompanyInput(value);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSubmit(value);
  };

  return (
    <form onSubmit={submit} className="panel space-y-5 p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`f-${f.key}`}>
              {f.label}
              {f.required && <span className="text-critical"> *</span>}
            </Label>
            <Input
              id={`f-${f.key}`}
              value={value[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => setValue((v) => ({ ...v, [f.key]: e.target.value }))}
              aria-invalid={!!errors[f.key]}
            />
            {errors[f.key] && <p className="text-xs text-critical">{errors[f.key]}</p>}
          </div>
        ))}
        <div className="space-y-1.5">
          <Label htmlFor="f-industry">
            Rubro <span className="text-critical">*</span>
          </Label>
          <select
            id="f-industry"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={value.industry}
            onChange={(e) => setValue((v) => ({ ...v, industry: e.target.value as Industry }))}
          >
            {Object.entries(INDUSTRY_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          {errors["industry"] && <p className="text-xs text-critical">{errors["industry"]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-status">Estado</Label>
          <select
            id="f-status"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={value.status}
            onChange={(e) => setValue((v) => ({ ...v, status: e.target.value as CompanyStatus }))}
          >
            {Object.entries(COMPANY_STATUS_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="f-notes">Notas internas</Label>
        <Textarea
          id="f-notes"
          rows={3}
          value={value.notes ?? ""}
          onChange={(e) => setValue((v) => ({ ...v, notes: e.target.value }))}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Los datos se guardan solo en este navegador mientras no exista guardado con usuarios.
      </p>
      <div className="flex gap-2">
        <Button type="submit">{submitLabel}</Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
