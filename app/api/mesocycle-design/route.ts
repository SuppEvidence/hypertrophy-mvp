import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/user";
import { runDesignAction } from "@/lib/server/mesocycle-design";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const userId = await requireUserId();
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing request.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 200_000) {
        await reader.cancel();
        return NextResponse.json(
          { error: "Draft is too large." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const result = await runDesignAction(
      userId,
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    for (const path of [
      "/plan",
      "/programs",
      "/templates",
      "/dashboard",
      "/log",
    ])
      revalidatePath(path, "layout");
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const safe =
      /^(Design needs|Design not found|This design|Draft changed|A coach request|Another coach|Discussion is full|Coach response|Locked item|Generate or save|Review feasibility|Choose today|A future program|An exercise became|Session count|The review|Duplicate|Priorities must|Preserve confirmed)/.test(
        message,
      );
    return NextResponse.json(
      {
        error: safe
          ? message
          : "Could not save or generate this design. Check the fields and reload if needed. Your saved draft remains available.",
      },
      { status: 409 },
    );
  }
}
