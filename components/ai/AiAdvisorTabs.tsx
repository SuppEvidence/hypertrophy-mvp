"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarRange, Dumbbell } from "lucide-react";

const tabs = [
  {
    href: "/ai-analysis/workouts",
    label: "Workout",
    description: "Session interpretation",
    icon: Dumbbell,
  },
  {
    href: "/ai-analysis/volume",
    label: "Volume",
    description: "Current-block decisions",
    icon: BarChart3,
  },
  {
    href: "/ai-analysis/mesocycle",
    label: "Meso",
    description: "Next-block review",
    icon: CalendarRange,
  },
];

export function AiAdvisorTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="AI Advisor sections"
      className="grid grid-cols-3 gap-1 rounded-2xl border border-white/[0.07] bg-slate-950/60 p-1.5"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 items-center justify-center gap-2 rounded-xl px-2 py-2.5 transition ${
              active
                ? "bg-orange-500/12 text-orange-200"
                : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"
            }`}
          >
            <Icon size={16} className="shrink-0" />
            <span className="min-w-0 text-left">
              <span className="block text-xs font-semibold sm:text-sm">
                {tab.label}
              </span>
              <span className="hidden truncate text-[10px] text-slate-500 sm:block">
                {tab.description}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
