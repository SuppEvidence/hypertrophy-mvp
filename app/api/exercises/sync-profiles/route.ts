import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/user";
import { syncSavedExerciseProfiles } from "@/lib/server/exercise-profile-sync";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const userId = await requireUserId();
    const result = await syncSavedExerciseProfiles(userId);
    for (const path of ["/exercises", "/templates", "/programs", "/plan", "/plan/week"]) revalidatePath(path,"layout");
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Saved profile conversion paused. Reload to resume; completed updates are retained." }, { status: 409 });
  }
}
