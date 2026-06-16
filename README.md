# Hypertrophy Tracker MVP — Slice 4

Production MVP foundation for a hypertrophy-focused workout tracker.

Slice 4 includes:

- Slice 1 foundation/auth/app shell
- Slice 2 persisted user-owned programs and active program switching
- Slice 3 Exercise Database and Exercise Editor
- Supabase Auth
- PostgreSQL via Prisma 7
- Prisma configured through `prisma.config.ts`
- Prisma app and seed clients using `@prisma/adapter-pg` and `pg`
- Seed/reference data for muscles, movement groups, set types, and example exercises
- Persisted workout templates
- Persisted template exercise rows
- Template selection by program and template
- Add/remove/reorder planned exercises
- Edit planned sets, rep range, RIR target, default set type, and notes
- Planned direct/effective volume preview using exercise classification, set type multiplier, and program secondary contribution
- Basic target warning where a single template exceeds selected-window target

Not included yet:

- Workout logging
- Metrics logging
- Dashboard analytics
- Full calculation engine
- Performance trends
- Session history

## Environment

Keep your existing `.env.local` from Slice 1/2/3.

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Local setup

```bash
npm install
npx prisma generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open:

```bash
http://localhost:3000
```

## Manual checks

1. Sign up, log in, and log out still work.
2. Protected routes still redirect unauthenticated users to `/login`.
3. Programs from Slice 2 are still visible and active-program switching still works.
4. Exercise Database and Editor from Slice 3 still work.
5. Open `/templates` and confirm the active program is selected.
6. Confirm templates are auto-created from the selected program template count.
7. Switch between programs and confirm template names/default counts match the program type.
8. Rename a template and confirm it persists after refresh.
9. Add a seeded exercise to a template.
10. Add a custom exercise to a template.
11. Edit planned sets, rep range, RIR target, and set type.
12. Reorder template exercises.
13. Remove a template exercise.
14. Confirm planned direct/effective volume preview updates.
15. Confirm no workout logging, dashboard analytics, beginner guidance, nutrition, social, wearable, or AI coaching features appeared.

## Prisma 7 notes

- `prisma/schema.prisma` does not contain `url` or `directUrl`.
- Database URL is configured through `prisma.config.ts`.
- `.env.local` is explicitly loaded for Prisma CLI/seed use.
- Runtime Prisma client uses `@prisma/adapter-pg` and `pg`.
- Seed script also uses `@prisma/adapter-pg` and `pg`.


## Slice 6 additions

Slice 6 adds persisted optional metrics and basic fatigue context:

- `metric_logs` table via Prisma migration `0005_slice6_metrics`
- Metrics logger at `/metrics`
- Recent metrics list
- Dashboard fatigue context card
- Transparent fatigue scoring from available metric inputs only

Run after applying Slice 6:

```bash
npx prisma generate
npm run db:migrate
npm run dev
```
