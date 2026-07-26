import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">Welcome back</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-50">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Continue to your current program, weekly plan, and training log.</p>
      </div>
      <AuthForm mode="login" />
    </div>
  );
}
