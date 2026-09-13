import Link from "next/link";
import { ClipboardList, LayoutTemplate } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

const planItems = [
  {
    href: "/programs",
    title: "Programs & mesocycles",
    description:
      "Current program, priorities, volume targets, weekly planning, and mesocycle management.",
    icon: ClipboardList,
  },
  {
    href: "/templates",
    title: "Base templates",
    description:
      "Workout structures, movement slots, set limits, rep ranges, and exercise pools.",
    icon: LayoutTemplate,
  },
];

export default function PlanPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Plan"
        description="Manage the current training block or open the deeper base-template setup when you actually need it."
      />

      <div className="grid gap-3 md:grid-cols-2">
        {planItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full transition hover:border-slate-600 hover:bg-slate-900">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-orange-400/10 bg-orange-500/[0.08] p-2.5 text-orange-300">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-100">
                      {item.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="border-dashed bg-slate-950/25">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
          Next planning upgrade
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          A dedicated current-mesocycle adjustment view will sit here later,
          so ordinary set/slot changes do not require opening the full base
          template editor.
        </p>
      </Card>
    </div>
  );
}
