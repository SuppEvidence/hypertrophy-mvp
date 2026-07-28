# Ripped Fat Dude Hypertrophy Tracker

Version 1.0.1 of a mobile-first hypertrophy planning and tracking application for experienced lifters.

## Product scope

- Program structure and reusable volume defaults
- Movement-pattern workout templates and exercise pools
- Mesocycle targets, movement-specific rep policies, and end-of-block review
- Set-level stimulus logging with optional load, reps, and RIR
- Set types and productive-volume multipliers
- Weekly missed-workout redistribution
- Daily bodyweight and waist tracking
- Mesocycle circumference check-ins
- Dashboard coach signals and exercise performance history
- Supabase authentication and PostgreSQL persistence through Prisma
- Installable PWA manifest

## Local setup

Create `.env.local` with the required Supabase and database values, then run:

```bash
npm install
npx prisma generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run typecheck
npm run build
```

The production-boundary check runs automatically before typecheck and build.

## Stack

- Next.js and React with TypeScript
- Tailwind CSS
- Prisma 7 with `@prisma/adapter-pg`
- Supabase Auth and PostgreSQL
- Vercel deployment
