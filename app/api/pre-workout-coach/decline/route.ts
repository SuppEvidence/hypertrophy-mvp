import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/user";
import { declinePreWorkoutCoachProposalForUser } from "@/lib/server/pre-workout-coach";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload.interventionId !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.interventionId)) {
    return NextResponse.json({ error: "Invalid review." }, { status: 400 });
  }
  const recorded = await declinePreWorkoutCoachProposalForUser(user.id, payload.interventionId);
  return NextResponse.json({ recorded }, { status: recorded ? 200 : 409, headers: { "Cache-Control": "no-store" } });
}
