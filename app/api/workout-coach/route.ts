import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/user";
import { getLiveCoachSnapshot, runLiveWorkoutCoach } from "@/lib/server/workout-coach-engine";

export const runtime = "nodejs";
export const maxDuration = 60;
const Input = z.object({
  sessionId: z.string().uuid(), sessionExerciseId: z.string().uuid(),
  triggerSetId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const input = Input.safeParse(await request.json());
    if (!input.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const { sessionId, sessionExerciseId, triggerSetId } = input.data;
    const result = triggerSetId
      ? await runLiveWorkoutCoach(user.id, { sessionId, sessionExerciseId, triggerSetId })
      : await getLiveCoachSnapshot(user.id, sessionId, sessionExerciseId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Training remains usable; never expose credentials or raw provider/database errors.
    return NextResponse.json({ action: null, coachStatus: "UNAVAILABLE", unavailable: true }, { status: 503 });
  }
}
