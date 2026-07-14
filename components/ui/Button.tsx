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
  primary: "bg-slate-100 text-slate-950 hover:bg-white",
  secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700",
  ghost: "bg-transparent text-slate-300 hover:bg-slate-900",
  danger: "bg-red-950 text-red-100 border border-red-900 hover:bg-red-900",
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
        "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
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
      ) : children}
    </button>
  );
}
