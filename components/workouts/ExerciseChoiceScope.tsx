"use client";

import { useState } from "react";

export function ExerciseChoiceScope({ temporary, name = "exerciseChoiceIntent", remember = false }: {
  temporary: boolean; name?: string; remember?: boolean;
}) {
  const [checked, setChecked] = useState(remember ? !temporary : temporary);
  const todayOnly = remember ? !checked : checked;
  return <div className="space-y-1 text-xs">
    <label className="flex items-center gap-2 text-slate-300">
      <input type="checkbox" name={name} value={remember ? "on" : "TEMPORARY"} checked={checked}
        onChange={(event) => setChecked(event.target.checked)} className="accent-orange-500" />
      {remember ? "Remember this exercise for this slot" : "Only use this exercise today"}
    </label>
    <p className="text-slate-400"><span className="font-semibold text-orange-200">{todayOnly ? "Today only" : "Carry forward"}</span>
      {todayOnly ? " · Does not replace the remembered exercise for future planning." : " · Saved as the preferred choice for this slot; future coaching can still suggest a change."}
    </p>
  </div>;
}
