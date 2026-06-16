import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { getSettingsPageData } from "@/lib/server/settings";

export default async function SettingsPage({ searchParams }: { searchParams?: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const data = await getSettingsPageData();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Persistent app defaults and display preferences. These settings stay focused on logging, volume calculations, and recovery context."
      />

      {params?.saved ? (
        <div className="rounded-2xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-100">Settings saved.</div>
      ) : null}

      {params?.error ? (
        <div className="rounded-2xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-100">Unable to update that setting.</div>
      ) : null}

      <SettingsForm settings={data.settings} setTypes={data.setTypes} />
    </div>
  );
}
