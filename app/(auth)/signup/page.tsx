import { AuthForm } from "@/components/auth/AuthForm";

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Hypertrophy Tracker</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-50">Create account</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Real authentication and user-owned data foundation for the production MVP.</p>
      </div>
      <AuthForm mode="signup" />
    </div>
  );
}
