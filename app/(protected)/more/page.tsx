import Link from "next/link";
import { Database, History, Settings } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

const moreItems = [
  {
    href: "/exercises",
    label: "Exercise database",
    description:
      "Exercise catalog, movement classifications, muscle mappings, and custom exercises.",
    icon: Database,
  },
  {
    href: "/log/history",
    label: "Training history",
    description: "View, edit, or delete persisted workout sessions.",
    icon: History,
  },
  {
    href: "/settings",
    label: "Settings",
    description:
      "Units, metric visibility, custom set types, and application preferences.",
    icon: Settings,
  },
];

type MoreItem = (typeof moreItems)[number];

export default function MorePage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="More"
        description="Library, workout history, and settings. Analytics now live under Progress; programming lives under Plan."
      />

      <div className="space-y-3">
        {moreItems.map((item: MoreItem) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="transition hover:border-slate-600 hover:bg-slate-900">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-slate-300">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-100">
                      {item.label}
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
    </div>
  );
}
