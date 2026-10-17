import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/user";
import { runNutritionAction } from "@/lib/server/nutrition-coach";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const userId = await requireUserId();
    const reader = request.body?.getReader();
    if (!reader)
      return NextResponse.json({ error: "Missing request." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64000) {
        await reader.cancel();
        return NextResponse.json(
          { error: "Request is too large." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const result = await runNutritionAction(
      userId,
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    for (const path of [
      "/plan",
      "/metrics",
      "/dashboard",
      "/ai-analysis",
      "/log",
    ])
      revalidatePath(path, "layout");
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        error: message.startsWith("Nutrition:")
          ? message.slice(11)
          : "Could not complete this request. Check the fields or reload the saved plan before retrying.",
      },
      { status: 409 },
    );
  }
}
