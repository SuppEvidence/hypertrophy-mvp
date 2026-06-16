import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, BarChart3, Database, Dumbbell, Home, LogOut, Settings, ClipboardList, MoreHorizontal, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/auth/server";
import { ensureProfile } from "@/lib/auth/profile";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/Button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/programs", label: "Programs", icon: ClipboardList },
  { href: "/exercises", label: "Exercises", icon: Database },
  { href: "/templates", label: "Templates", icon: BarChart3 },
  { href: "/log", label: "Log", icon: Dumbbell },
  { href: "/metrics", label: "Metrics", icon: Activity },
  { href: "/performance", label: "Performance", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
];

const mobileNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/programs", label: "Programs", icon: ClipboardList },
  { href: "/templates", label: "Templates", icon: BarChart3 },
  { href: "/log", label: "Log", icon: Dumbbell },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await ensureProfile(user);

  const [muscleCount, movementCount, setTypeCount, exerciseCount] = await Promise.all([
    prisma.muscle.count(),
    prisma.movementGroup.count(),
    prisma.setType.count(),
    prisma.exercise.count({ where: { isSeed: true } }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 pb-24 text-slate-100 md:pb-0">
      <div className="mx-auto flex min-h-screen max-w-6xl md:grid md:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-slate-800 bg-slate-950/95 p-4 md:block">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Hypertrophy</p>
            <h1 className="mt-1 text-xl font-bold">Tracker MVP</h1>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-900 hover:text-white"
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-xs text-slate-400">
            <p className="font-semibold text-slate-200">Seed foundation</p>
            <p>{muscleCount} muscles</p>
            <p>{movementCount} movement groups</p>
            <p>{setTypeCount} set types</p>
            <p>{exerciseCount} seed exercises</p>
          </div>
          <form action={signOut} className="mt-4">
            <Button variant="secondary" className="w-full gap-2">
              <LogOut size={16} /> Logout
            </Button>
          </form>
        </aside>

        <main className="w-full px-4 py-5 md:px-8 md:py-8">
          <div className="mb-5 flex items-center justify-between md:hidden">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Hypertrophy</p>
              <p className="text-lg font-bold">Tracker MVP</p>
            </div>
            <form action={signOut}>
              <Button variant="ghost" className="px-3">
                <LogOut size={18} />
              </Button>
            </form>
          </div>
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 px-2 py-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium text-slate-400 hover:bg-slate-900 hover:text-white"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
