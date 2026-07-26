import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";
import { Button } from "@/components/ui/Button";
import { requireUser } from "@/lib/auth/user";
import { DesktopNavigation, MobileNavigation } from "@/components/app/AppNavigation";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${compact ? "h-10 w-10" : "h-11 w-11"} grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-sm font-black tracking-[-0.04em] text-white shadow-[0_12px_28px_-12px_rgba(249,115,22,0.95)]`}>
        RFD
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400">Ripped Fat Dude</p>
        <p className={`${compact ? "text-base" : "text-lg"} truncate font-bold tracking-[-0.02em] text-slate-50`}>Hypertrophy Tracker</p>
      </div>
    </div>
  );
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen pb-24 text-slate-100 md:pb-0">
      <div className="mx-auto min-h-screen max-w-[1440px] md:grid md:grid-cols-[276px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen border-r border-white/[0.06] bg-slate-950/[0.72] px-4 py-5 backdrop-blur-xl md:flex md:flex-col">
          <div className="px-1">
            <BrandLockup />
          </div>

          <div className="mt-7 flex-1 overflow-y-auto pr-1">
            <DesktopNavigation />
          </div>

          <div className="mt-5 border-t border-white/[0.06] pt-4">
            {user.email ? <p className="mb-3 truncate px-2 text-xs text-slate-500">{user.email}</p> : null}
            <form action={signOut}>
              <Button variant="ghost" className="w-full justify-start gap-3 text-slate-400">
                <LogOut size={17} /> Sign out
              </Button>
            </form>
            <p className="mt-3 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">Version 1.0.0</p>
          </div>
        </aside>

        <main className="min-w-0 px-3 py-4 sm:px-5 md:px-8 md:py-7 lg:px-10">
          <div className="mb-5 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-slate-950/[0.55] p-3 shadow-sm backdrop-blur md:hidden">
            <BrandLockup compact />
            <form action={signOut}>
              <Button variant="ghost" className="h-10 min-h-10 w-10 px-0" aria-label="Sign out">
                <LogOut size={18} />
              </Button>
            </form>
          </div>
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <MobileNavigation />
    </div>
  );
}
