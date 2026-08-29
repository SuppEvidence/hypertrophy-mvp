"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  ClipboardList,
  Database,
  Dumbbell,
  Home,
  MoreHorizontal,
  Settings,
  TrendingUp,
} from "lucide-react";
import { clsx } from "clsx";

const desktopItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/programs", label: "Programs", icon: ClipboardList },
  { href: "/exercises", label: "Exercises", icon: Database },
  { href: "/templates", label: "Templates", icon: BarChart3 },
  { href: "/log", label: "Log workout", icon: Dumbbell },
  { href: "/metrics", label: "Metrics", icon: Activity },
  { href: "/performance", label: "Performance", icon: TrendingUp },
  { href: "/ai-analysis", label: "AI Analytics", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];

const mobileItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/programs", label: "Programs", icon: ClipboardList },
  { href: "/templates", label: "Templates", icon: BarChart3 },
  { href: "/log", label: "Log", icon: Dumbbell },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

const moreRoutes = [
  "/more",
  "/exercises",
  "/metrics",
  "/performance",
  "/ai-analysis",
  "/settings",
  "/log/history",
];

function isDesktopActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isMobileActive(pathname: string, href: string) {
  if (href === "/more") {
    return moreRoutes.some(
      (route) =>
        pathname === route || pathname.startsWith(`${route}/`),
    );
  }
  if (href === "/dashboard") return pathname === href;
  if (href === "/log") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="space-y-1">
      {desktopItems.map((item) => {
        const Icon = item.icon;
        const active = isDesktopActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "group flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition",
              active
                ? "border-orange-400/20 bg-orange-500/10 text-orange-100 shadow-sm"
                : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900/70 hover:text-slate-100",
            )}
          >
            <span
              className={clsx(
                "grid h-8 w-8 place-items-center rounded-lg transition",
                active
                  ? "bg-orange-500 text-white"
                  : "bg-slate-900 text-slate-500 group-hover:text-slate-300",
              )}
            >
              <Icon size={17} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-slate-950/[0.92] px-2 pt-2 backdrop-blur-xl md:hidden"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const active = isMobileActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition",
                active
                  ? "bg-orange-500/12 text-orange-300"
                  : "text-slate-500 hover:bg-slate-900 hover:text-slate-200",
              )}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
