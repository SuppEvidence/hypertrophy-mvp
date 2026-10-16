/** Read-only verification after prisma migrate deploy. Does not invoke any coach. */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { muscleCatalog } from "../lib/muscles/catalog";
config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
async function main() {
  const rows = await prisma.muscle.findMany();
  const problems: string[] = [];
  for (const expected of muscleCatalog) {
    const actual = rows.find(row => row.slug === expected.slug);
    if (!actual) { problems.push(`Missing: ${expected.slug}`); continue; }
    for (const key of ["name", "bodyRegion", "anatomyKind", "accountingSlug", "aliases", "visualAssessable", "sortOrder"] as const) {
      if (JSON.stringify(actual[key]) !== JSON.stringify(expected[key])) problems.push(`${expected.slug}: ${key} differs`);
    }
    if (actual.accountingSlug && !rows.some(row => row.slug === actual.accountingSlug && !row.accountingSlug)) problems.push(`${expected.slug}: invalid accounting group`);
  }
  if (problems.length) throw new Error(`Muscle catalogue verification failed:\n${problems.join("\n")}`);
  console.log(`Verified ${muscleCatalog.length} shared references against the database. Additional existing references: ${rows.length - muscleCatalog.length}. No data changed and no AI calls made.`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Verification failed"); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
