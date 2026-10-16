import fs from "node:fs";
const catalog = JSON.parse(fs.readFileSync(new URL("../lib/muscles/catalog.json", import.meta.url), "utf8"));
const quote = s => s === null ? "NULL" : "'" + s.replaceAll("'", "''") + "'";
const migration = new URL("../prisma/migrations/20261016060000_shared_muscle_model/migration.sql", import.meta.url);
const values = catalog.map(m => `(${[m.slug,m.name,m.bodyRegion,m.anatomyKind,m.accountingSlug].map(quote).join(", ")}, ARRAY[${m.aliases.map(quote).join(", ")}]::text[], ${m.visualAssessable}, ${m.sortOrder})`).join(",\n");
const sql = `-- Generated from lib/muscles/catalog.json. Additive: preserves every existing UUID and all user data.
BEGIN;
ALTER TABLE "muscles"
  ADD COLUMN "body_region" TEXT NOT NULL DEFAULT 'Other',
  ADD COLUMN "anatomy_kind" TEXT NOT NULL DEFAULT 'GROUP',
  ADD COLUMN "accounting_slug" TEXT,
  ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "visual_assessable" BOOLEAN NOT NULL DEFAULT false;

-- Match existing slug OR exact name. Stop on conflicting identities instead of merging/deleting history.
DO $$
DECLARE row RECORD; found_id UUID; conflicting_id UUID;
BEGIN
  FOR row IN SELECT * FROM (VALUES
${values}
  ) AS c(slug, name, body_region, anatomy_kind, accounting_slug, aliases, visual_assessable, sort_order)
  LOOP
    SELECT id INTO found_id FROM muscles WHERE slug = row.slug;
    SELECT id INTO conflicting_id FROM muscles WHERE name = row.name;
    IF found_id IS NOT NULL AND conflicting_id IS NOT NULL AND found_id <> conflicting_id THEN
      RAISE EXCEPTION 'Conflicting muscle identities for %; resolve before migrating', row.slug;
    END IF;
    found_id := COALESCE(found_id, conflicting_id);
    IF found_id IS NULL THEN
      INSERT INTO muscles(id,name,slug,sort_order,created_at,updated_at,body_region,anatomy_kind,accounting_slug,aliases,visual_assessable)
      VALUES(gen_random_uuid(),row.name,row.slug,row.sort_order,NOW(),NOW(),row.body_region,row.anatomy_kind,row.accounting_slug,row.aliases,row.visual_assessable);
    ELSE
      UPDATE muscles SET slug=row.slug, name=row.name, body_region=row.body_region, anatomy_kind=row.anatomy_kind,
        accounting_slug=row.accounting_slug, aliases=row.aliases, visual_assessable=row.visual_assessable, sort_order=row.sort_order
        WHERE id=found_id;
    END IF;
  END LOOP;
END $$;
ALTER TABLE "muscles" ADD CONSTRAINT "muscles_accounting_slug_fkey" FOREIGN KEY ("accounting_slug") REFERENCES "muscles"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "muscles_accounting_slug_idx" ON "muscles"("accounting_slug");
COMMIT;
-- Existing table grants/RLS remain intact. No user records, links, profiles, storage policies or AI jobs are changed.
`;
if (process.argv.includes("--check")) {
 if (fs.readFileSync(migration,"utf8") !== sql) throw new Error("Muscle migration differs from catalogue. Regenerate it.");
 console.log("Catalogue and SQL migration agree.");
} else { fs.mkdirSync(new URL(".",migration),{recursive:true}); fs.writeFileSync(migration,sql); }
