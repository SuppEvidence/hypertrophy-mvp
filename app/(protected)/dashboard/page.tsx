import { requireUserId } from "@/lib/auth/user";
import { getHomeDashboardData } from "@/lib/server/home-dashboard";
import { HomeDashboard } from "@/components/dashboard/HomeDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await requireUserId();
  return <HomeDashboard data={await getHomeDashboardData(userId)} />;
}
