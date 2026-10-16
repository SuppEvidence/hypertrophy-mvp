import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { getDesignView } from "@/lib/server/mesocycle-design";
import { getDesignReferences } from "@/lib/server/mesocycle-design-context";
import { getPhysiqueEvidence } from "@/lib/server/physique-evidence";
import { MesocycleDesigner } from "@/components/programs/MesocycleDesigner";
export async function NextMesocycleDesign({ id }: { id?: string }) {
  const userId = await requireUserId();
  const query = { id };
  const [refs, designs, physique, settings] = await Promise.all([
    getDesignReferences(userId),
    prisma.mesocycleDesign.findMany({
      where: { userId, status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { id: true, status: true, updatedAt: true, brief: true },
    }),
    getPhysiqueEvidence(userId),
    prisma.userSettings.findUnique({
      where: { userId },
      select: { physiqueGoal: true },
    }),
  ]);
  let chosen = !query.id
    ? designs.find((d) => d.status === "DRAFT")?.id
    : undefined;
  if (query.id && query.id !== "new") {
    if (!z.string().uuid().safeParse(query.id).success) notFound();
    const saved = await prisma.mesocycleDesign.findFirst({
      where: { id: query.id, userId, status: { not: "ARCHIVED" } },
      select: { id: true },
    });
    if (!saved) notFound();
    chosen = saved.id;
  }
  const initial = chosen ? await getDesignView(userId, chosen) : null;
  const suggestions = physique.assessments.flatMap((a) =>
    a.proposedPriorities.map((p) => ({ ...p, date: a.takenOn })),
  );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">
          Design the next mesocycle
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Agree on goals, discuss the training structure, then approve the
          program and block together. You can start without an existing program.
        </p>
      </div>
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link href="/plan/blocks?tab=next&id=new" className="text-orange-300">
          New design
        </Link>
        {designs.map((d) => (
          <Link
            className="text-slate-300 underline"
            key={d.id}
            href={`/plan/blocks?tab=next&id=${d.id}`}
          >
            {d.updatedAt.toISOString().slice(0, 10)} · {d.status.toLowerCase()}
          </Link>
        ))}
      </nav>
      <MesocycleDesigner
        key={chosen ?? "new"}
        initial={initial}
        refs={refs}
        suggestions={suggestions}
        today={today}
        defaultGoal={settings?.physiqueGoal ?? ""}
      />
    </div>
  );
}
