import type { InputHTMLAttributes } from "react";
import { clsx } from "clsx";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function Field({ label, hint, className, ...props }: FieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input
        className={clsx(
          "min-h-12 w-full rounded-xl border border-slate-700/80 bg-slate-950/75 px-3 py-2 text-base text-slate-100 shadow-inner shadow-black/10 outline-none transition placeholder:text-slate-600 hover:border-slate-600 focus:border-orange-400/80 focus:ring-2 focus:ring-orange-500/10",
          className,
        )}
        {...props}
      />
      {hint ? <span className="block text-xs leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}
