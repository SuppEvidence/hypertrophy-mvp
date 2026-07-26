"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { clsx } from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  pendingText?: string;
  showPendingState?: boolean;
};

const variants = {
  primary:
    "border border-orange-400/80 bg-orange-500 text-white shadow-[0_10px_28px_-14px_rgba(249,115,22,0.9)] hover:border-orange-300 hover:bg-orange-400",
  secondary:
    "border border-slate-700/80 bg-slate-800/80 text-slate-100 shadow-sm hover:border-slate-600 hover:bg-slate-700/90",
  ghost: "border border-transparent bg-transparent text-slate-300 hover:border-slate-800 hover:bg-slate-900/70 hover:text-white",
  danger: "border border-red-800/80 bg-red-950/70 text-red-100 hover:border-red-700 hover:bg-red-900/80",
};

function textFromChildren(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textFromChildren).join(" ").trim();
  if (children && typeof children === "object" && "props" in children) {
    return textFromChildren((children as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

function inferPendingText(children: ReactNode) {
  const label = textFromChildren(children).trim().toLowerCase();

  if (!label) return null;
  if (label.startsWith("save")) return "Saving…";
  if (label.startsWith("create")) return "Creating…";
  if (label.startsWith("duplicate")) return "Duplicating…";
  if (label.startsWith("add")) return "Adding…";
  if (label.startsWith("start")) return "Starting…";
  if (label.startsWith("finish")) return "Finishing…";
  if (label.startsWith("delete") || label.startsWith("confirm delete")) return "Deleting…";
  if (label.startsWith("remove")) return "Removing…";
  if (label.startsWith("archive")) return "Archiving…";
  if (label.startsWith("restore")) return "Restoring…";
  if (label.startsWith("apply")) return "Applying…";
  if (label.startsWith("load")) return "Loading…";
  if (label.startsWith("login")) return "Logging in…";
  if (label.startsWith("set active")) return "Updating…";
  if (label.startsWith("hide")) return "Updating…";

  return "Working…";
}

export function Button({
  className,
  variant = "primary",
  pendingText,
  showPendingState = true,
  disabled,
  type,
  name,
  value,
  children,
  ...props
}: ButtonProps) {
  const status = useFormStatus();
  const isSubmitButton = type !== "button";
  const submittedValue = name && status.data ? status.data.get(name) : null;
  const isTriggeredButton = !name || submittedValue === null || String(submittedValue) === String(value ?? "");
  const isPending = showPendingState && isSubmitButton && status.pending;
  const showPendingContent = isPending && isTriggeredButton;
  const resolvedPendingText = pendingText ?? inferPendingText(children);

  return (
    <button
      type={type}
      name={name}
      value={value}
      disabled={disabled || isPending}
      aria-busy={showPendingContent || undefined}
      className={clsx(
        "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition duration-150 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        variants[variant],
        className,
      )}
      {...props}
    >
      {showPendingContent ? (
        <>
          <LoaderCircle size={16} className="mr-2 shrink-0 animate-spin" aria-hidden="true" />
          {resolvedPendingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
