import Link from "next/link";
import {
  ClipboardList,
  LayoutTemplate,
  SlidersHorizontal,
} from "lucide-react";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

const planItems = [
  {
    href: "/plan/week", title: "Plan this week", description: "Set available days and have the coach distribute work across the entire week.", icon: ClipboardList, primary: true,
  },
  {
    href: "/plan/blocks",
    title: "Mesocycle planning",
    description: "Review the coach's next-block advice and schedule the next mesocycle and priorities ahead of time.",
    icon: ClipboardList,
    primary: true,
  },
  {
    href: "/plan/mesocycle",
    title: "Adjust current mesocycle",
    description:
      "Change movement patterns or set counts for future workouts in the current block without touching the base templates.",
    icon: SlidersHorizontal,
    primary: false,
  },
  {
    href: "/programs",
    title: "Program settings",
    description:
      "Edit your reusable program, templates, rotation, and deeper programming controls.",
    icon: ClipboardList,
    primary: false,
  },
  {
    href: "/templates",
    title: "Base templates",
    description:
      "Permanent workout structure, slot limits, rep ranges, set plans, and exercise pools.",
    icon: LayoutTemplate,
    primary: false,
  },
];

export default function PlanPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Plan"
        description="Schedule your next training block, adjust the current one, or edit the reusable program."
      />

      <div className="grid gap-3 md:grid-cols-2">
        {planItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={item.primary ? "md:col-span-2" : ""}
            >
              <Card
                className={`h-full transition hover:border-slate-600 hover:bg-slate-900 ${
                  item.primary
                    ? "border-orange-400/15 bg-gradient-to-br from-slate-900 to-orange-950/10"
                    : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`rounded-xl border p-2.5 ${
                      item.primary
                        ? "border-orange-400/15 bg-orange-500/10 text-orange-300"
                        : "border-slate-700 bg-slate-950 text-slate-400"
                    }`}
                  >
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
    </div>
  );
}
