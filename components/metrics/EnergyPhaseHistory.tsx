import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { deleteEnergyPhase, saveEnergyPhase } from "@/lib/server/energy-phases";

const phaseLabels = { CUTTING: "Cutting", MAINTAINING: "Maintaining", GAINING: "Gaining" } as const;

export function EnergyPhaseHistory({ entries }: {
  entries: Array<{ id: string; phase: keyof typeof phaseLabels; startDate: string }>;
}) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return (
    <Card>
      <h2 className="font-semibold text-slate-100">Training energy phase</h2>
      <p className="mt-1 text-sm text-slate-400">Record when your intent changes. The next start date closes the previous phase; the coach checks metrics and training before drawing conclusions.</p>
      <form action={saveEnergyPhase} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-slate-400">Phase
          <select name="phase" defaultValue={entries[0]?.phase ?? "MAINTAINING"} className="block min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
            {Object.entries(phaseLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-400">Start date
          <input name="startDate" type="date" required defaultValue={today} className="block min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" />
        </label>
        <Button pendingText="Saving…">Save phase</Button>
      </form>
      {entries.length > 0 ? (
        <div className="mt-4 space-y-2 text-sm">
          {entries.map((entry, index) => (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2">
              <p className="text-slate-200">{phaseLabels[entry.phase]} <span className="text-slate-500">· from {entry.startDate}{index > 0 ? ` until before ${entries[index - 1].startDate}` : ""}</span></p>
              <form action={deleteEnergyPhase}><input type="hidden" name="id" value={entry.id} /><Button variant="ghost" pendingText="Removing…">Remove</Button></form>
            </div>
          ))}
        </div>
      ) : <p className="mt-4 text-sm text-slate-500">No phase selected yet; the coach uses measured trends with appropriate uncertainty.</p>}
    </Card>
  );
}
