"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dumbbell,
  Gauge,
  Home,
  MoreHorizontal,
  TrendingUp,
} from "lucide-react";
import { clsx } from "clsx";

const primaryItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/log", label: "Train", icon: Dumbbell },
  { href: "/plan", label: "Plan", icon: Gauge },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

const planRoutes = ["/plan", "/programs", "/templates"];
const progressRoutes = [
  "/progress",
  "/metrics",
  "/performance",
  "/ai-analysis",
];
const moreRoutes = ["/more", "/exercises", "/settings", "/log/history"];

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";

  if (href === "/log") {
    return (
      (pathname === "/log" || pathname.startsWith("/log/")) &&
      !matchesRoute(pathname, "/log/history")
    );
  }

  if (href === "/plan") {
    return planRoutes.some((route) => matchesRoute(pathname, route));
  }

  if (href === "/progress") {
    return progressRoutes.some((route) => matchesRoute(pathname, route));
  }

  if (href === "/more") {
    return moreRoutes.some((route) => matchesRoute(pathname, route));
  }

  return matchesRoute(pathname, href);
}

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="space-y-1">
      {primaryItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);

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
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);

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
