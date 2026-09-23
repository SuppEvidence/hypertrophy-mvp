import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/user";
import { generatePreWorkoutCoachPlanForUser, PreWorkoutCoachRequestSchema } from "@/lib/server/pre-workout-coach";

export const runtime = "nodejs";
export const maxDuration = 75;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const input = PreWorkoutCoachRequestSchema.safeParse(await request.json());
    if (!input.success) return NextResponse.json({ error: "Invalid coaching request." }, { status: 400 });
    const result = await generatePreWorkoutCoachPlanForUser(user.id, input.data);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Pre-workout coach unavailable. You can still start the template unchanged." }, { status: 503 });
  }
}
