import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { isEdtSetType } from "@/lib/coaching/set-type-classification";

type Profile = {
  preference: "NEUTRAL" | "PREFERRED" | "AVOID";
  intensifierPreference: "DEFAULT" | "NONE" | "ONLY_SELECTED";
  allowedIntensifierIds: string[];
  notes: string | null;
} | null;

export function ExerciseCoachingProfileForm({ profile, setTypes, action }: {
  profile: Profile;
  setTypes: Array<{ id: string; name: string; slug: string; isIntensifier: boolean }>;
  action: (formData: FormData) => Promise<void>;
}) {
  const inputClass = "min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100";
  return (
    <Card>
      <form action={action} className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Coach exercise profile</h2>
          <p className="mt-1 text-sm text-slate-400">Your preferences apply to this exercise, including seed exercises. They guide future workout proposals without changing past logs or templates.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-slate-400">Exercise preference
            <select name="preference" defaultValue={profile?.preference ?? "NEUTRAL"} className={inputClass}>
              <option value="NEUTRAL">Neutral</option><option value="PREFERRED">Preferred</option><option value="AVOID">Avoid in new suggestions</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-400">New advanced set type suggestions
            <select name="intensifierPreference" defaultValue={profile?.intensifierPreference ?? "DEFAULT"} className={inputClass}>
              <option value="DEFAULT">Use conservative exercise rules</option>
              <option value="NONE">No new advanced set types</option>
              <option value="ONLY_SELECTED">Only selected types below</option>
            </select>
          </label>
        </div>
        <fieldset className="space-y-1">
          <legend className="text-xs text-slate-400">Allowed types when “Only selected” is chosen (including EDT)</legend>
          <div className="flex flex-wrap gap-2">
            {setTypes.filter((type) => type.isIntensifier || isEdtSetType(type)).map((type) => (
              <label key={type.id} className="flex items-center gap-2 rounded-lg border border-slate-800 px-2 py-2 text-xs text-slate-300">
                <input type="checkbox" name="allowedIntensifierIds" value={type.id} defaultChecked={profile?.allowedIntensifierIds.includes(type.id)} />{type.name}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500">EDT remains a base set in Settings and legacy counts. Selecting a type never overrides exercise safety or workout dose limits.</p>
        </fieldset>
        <label className="block space-y-1 text-xs text-slate-400">Coaching notes
          <textarea name="notes" maxLength={800} defaultValue={profile?.notes ?? ""} placeholder="What fits this exercise: target-muscle feel, setup, joint tolerance, and when to avoid it." className={`${inputClass} min-h-20`} />
        </label>
        <Button>Save coach profile</Button>
      </form>
    </Card>
  );
}
