import Link from "next/link";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { getDesignView } from "@/lib/server/mesocycle-design";
import { getDesignReferences } from "@/lib/server/mesocycle-design-context";
import { getPhysiqueEvidence } from "@/lib/server/physique-evidence";
import { MesocycleDesigner } from "@/components/programs/MesocycleDesigner";
import { PageHeader } from "@/components/ui/PageHeader";
export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const userId = await requireUserId();
  const query = await searchParams;
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
  const chosen =
    query.id && designs.some((d) => d.id === query.id)
      ? query.id
      : !query.id
        ? designs.find((d) => d.status === "DRAFT")?.id
        : undefined;
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
      <Link href="/plan" className="text-orange-300">
        ← Plan
      </Link>
      <PageHeader
        title="Program & mesocycle coach"
        description="Agree on goals, discuss a complete program and approve the next training block."
      />
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link href="/plan/design?id=new" className="text-orange-300">
          New design
        </Link>
        {designs.map((d) => (
          <Link
            className="text-slate-300 underline"
            key={d.id}
            href={`/plan/design?id=${d.id}`}
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
