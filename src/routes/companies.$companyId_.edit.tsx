import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { CompanyForm } from "@/components/company-form";
import { EmptyState } from "@/components/seo-ui";
import { companyActions, useCompany } from "@/store/app-store";

export const Route = createFileRoute("/companies/$companyId_/edit")({
  head: () => ({
    meta: [
      { title: "Editar empresa — MarCa Audit" },
      { name: "description", content: "Editar los datos de la ficha de una empresa." },
      { property: "og:title", content: "Editar empresa — MarCa Audit" },
      { property: "og:description", content: "Edición de ficha de empresa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditCompany,
});

function EditCompany() {
  const { companyId } = Route.useParams();
  const company = useCompany(companyId);
  const navigate = useNavigate();
  const back = () => navigate({ to: "/companies/$companyId", params: { companyId } });
  if (!company) return <EmptyState title="Empresa no encontrada" description="Puede que se haya eliminado o que esté guardada en otro navegador." />;
  const { id: _i, createdAt: _c, updatedAt: _u, auditIds: _a, ...initial } = company;
  return (
    <>
      <PageHeader title={`Editar ${company.tradeName}`} description="Cambiar el rubro no regenera el roadmap existente." />
      <CompanyForm
        key={company.id}
        initial={initial}
        submitLabel="Guardar cambios"
        onSubmit={(input) => {
          companyActions.update(companyId, input);
          back();
        }}
        onCancel={back}
      />
    </>
  );
}
