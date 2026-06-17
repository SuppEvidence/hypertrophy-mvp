import Link from "next/link";
import { Activity, Database, Settings, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

const moreItems = [
  { href: "/exercises", label: "Exercise Database", description: "Searchable exercise catalog and custom exercise editor.", icon: Database },
  { href: "/metrics", label: "Metrics", description: "Optional recovery and body metric logging.", icon: Activity },
  { href: "/performance", label: "Exercise Performance", description: "Exercise-level exposure, e1RM, volume-load, and PR context.", icon: TrendingUp },
  { href: "/settings", label: "Settings", description: "User preferences and MVP configuration placeholder.", icon: Settings },
];

export default function MorePage() {
  return (
    <div className="space-y-5">
      <PageHeader title="More" description="Secondary app areas for the authenticated app shell." />
      <div className="space-y-3">
        {moreItems.map((item: any) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="transition hover:border-slate-600 hover:bg-slate-900">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-slate-700 bg-slate-950 p-2 text-slate-300">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-100">{item.label}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>
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
