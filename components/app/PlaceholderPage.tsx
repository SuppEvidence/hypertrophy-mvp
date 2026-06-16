import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export function PlaceholderPage({
  title,
  description,
  nextSliceNote,
}: {
  title: string;
  description: string;
  nextSliceNote: string;
}) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} />
      <Card>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-200">Slice 1 status</p>
          <p className="text-sm leading-6 text-slate-400">
            Route, authenticated shell, and database foundation are active. Functional product behavior for this area is intentionally deferred.
          </p>
        </div>
      </Card>
      <Card className="border-slate-700 bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next implementation</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">{nextSliceNote}</p>
      </Card>
    </div>
  );
}
