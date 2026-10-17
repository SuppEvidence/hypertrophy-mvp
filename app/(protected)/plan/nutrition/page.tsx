import { requireUserId } from "@/lib/auth/user";
import { getNutritionView } from "@/lib/server/nutrition-coach";
import { NutritionCoach } from "@/components/nutrition/NutritionCoach";
import { PageHeader } from "@/components/ui/PageHeader";
export const dynamic = "force-dynamic";
export default async function NutritionPage() {
  const view = await getNutritionView(await requireUserId());
  return (
    <div className="space-y-5">
      <PageHeader
        title="Nutrition & phase"
        description="Start from your normal diet. Agree on a small change, then review the response."
      />
      <NutritionCoach initial={view} />
    </div>
  );
}
