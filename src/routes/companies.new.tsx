import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { CompanyForm } from "@/components/company-form";
import { companyActions } from "@/store/app-store";

export const Route = createFileRoute("/companies/new")({
  head: () => ({
    meta: [
      { title: "Nueva empresa — MarCa Audit" },
      { name: "description", content: "Registrar una empresa y generar su roadmap inicial de trabajo." },
      { property: "og:title", content: "Nueva empresa — MarCa Audit" },
      { property: "og:description", content: "Alta de empresa con roadmap inicial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewCompany,
});

function NewCompany() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        title="Nueva empresa"
        description="Al guardar se genera un roadmap inicial según el rubro. Las tareas arrancan como pendientes."
      />
      <CompanyForm
        submitLabel="Registrar empresa"
        onSubmit={(input) => {
          const c = companyActions.create(input);
          navigate({ to: "/companies/$companyId", params: { companyId: c.id } });
        }}
        onCancel={() => navigate({ to: "/companies" })}
      />
    </>
  );
}
