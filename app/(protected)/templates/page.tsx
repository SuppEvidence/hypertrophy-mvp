import { PageHeader } from "@/components/ui/PageHeader";
import { TemplateBuilder } from "@/components/templates/TemplateBuilder";
import { getTemplateBuilderData } from "@/lib/server/templates";

type Props = {
  searchParams?: Promise<{
    programId?: string;
    templateId?: string;
  }>;
};

export default async function TemplatesPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await getTemplateBuilderData(params);

  return (
    <div className="space-y-5">
      <PageHeader title="Template builder" description="Persisted program templates and planned hypertrophy exposure." />
      <TemplateBuilder {...data} />
    </div>
  );
}
