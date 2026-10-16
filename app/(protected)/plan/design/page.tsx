import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/user";

// Preserve bookmarks and saved draft links under the unified planner.
export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await requireUserId();
  const { id } = await searchParams;
  const query = new URLSearchParams({ tab: "next" });
  if (id) query.set("id", id);
  redirect(`/plan/blocks?${query}`);
}
