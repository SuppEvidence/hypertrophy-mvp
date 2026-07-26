import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export function PlaceholderPage({ title, description, nextSliceNote }: { title: string; description: string; nextSliceNote: string }) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} />
      <Card>
        <p className="text-sm font-semibold text-slate-200">Feature status</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">This area is available in the application shell but does not yet contain an active workflow.</p>
      </Card>
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-400">Planned scope</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">{nextSliceNote}</p>
      </Card>
    </div>
  );
}
