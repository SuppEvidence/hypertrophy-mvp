import { AuthForm } from "@/components/auth/AuthForm";

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">Start tracking</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-50">Create account</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Build your program, define the stimulus, and keep every workout connected to the plan.</p>
      </div>
      <AuthForm mode="signup" />
    </div>
  );
}
