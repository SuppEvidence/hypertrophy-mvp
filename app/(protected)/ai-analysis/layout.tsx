import type { ReactNode } from "react";

import { AiAdvisorTabs } from "@/components/ai/AiAdvisorTabs";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AiAnalysisLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="AI Advisor"
        description="Workout interpretation, current-block volume decisions, and end-of-mesocycle planning in separate views."
      />
      <AiAdvisorTabs />
      {children}
    </div>
  );
}
