import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/user";
import { runExerciseMechanicsCoach } from "@/lib/server/exercise-mechanics-coach";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: NextRequest, { params }: { params: Promise<{ exerciseId: string }> }) {
  // No cross-origin cookie-authenticated mutations; bound total decoded request size.
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const userId = await requireUserId();
    const { exerciseId } = await params;
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Missing request." }, { status: 400 });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 4_000_000) { await reader.cancel(); return NextResponse.json({ error: "Clip frames are too large." }, { status: 413 }); }
      chunks.push(value);
    }
    const result = await runExerciseMechanicsCoach(userId, exerciseId, JSON.parse(Buffer.concat(chunks).toString("utf8")));
    revalidatePath(`/exercises/${exerciseId}`); revalidatePath("/exercises");
    return NextResponse.json(result);
  } catch (error) {
    // Surface safe validation/conflict messages; never provider payloads or credentials.
    const message = error instanceof Error ? error.message : "";
    const safe = /^(Exercise not found|Profile changed|Restore this exercise|Provide at least|Frames must|Analysis incomplete|Coach returned|Analysis claimed|Draft is missing|Exercise changed|Exercise was archived|Clarification|Use Answer)/.test(message);
    return NextResponse.json({ error: safe ? message : "Exercise coaching failed. Reload and try again; your accepted profile remains saved." }, { status: safe && /changed|outdated/.test(message) ? 409 : 400 });
  }
}
