# Typecheck generated validator fix

Apply this small overlay on top of your current app (including the weekly coach updates). It contains two files and requires no database migration or environment-variable change.

The syntax error at `.next/dev/types/validator.ts:244` is inside a generated Next.js development file, not a project source file. Next dev can leave this file incomplete or rewrite it while TypeScript reads it. The regular `tsconfig.json` includes `.next/dev/types/**/*.ts`, so the old `npm run typecheck` also read that transient file. That particular generated file was not available in the patch workspace, so the precise cause of its malformed brace cannot be confirmed.

This update makes `npm run typecheck` generate fresh route definitions with `next typegen` and typecheck through `tsconfig.typecheck.json`, which excludes `.next/dev` while keeping `.next/types`. Prisma Client generation and the existing production boundary check remain in place.

## Apply and verify (PowerShell, app root)

1. Extract the ZIP over the app root, replacing `package.json` and adding `tsconfig.typecheck.json`.
2. Run `npm run typecheck`. The dev server can remain open with this updated script.

If you need to unblock the **old** script before applying the ZIP, stop `npm run dev` with Ctrl+C, then run:

```powershell
Remove-Item -Recurse -Force .next\dev\types -ErrorAction SilentlyContinue
npm run typecheck
```

If typecheck reports a new error in an app source file after this fix, treat that as a separate error and keep its complete output. Commit and push the two files with the rest of your tested app update for Vercel. No migration or production environment change is needed for this fix.

Verified locally: `npm run typecheck` passed even with a deliberately malformed `.next/dev/types/validator.ts` present; the test file was removed afterward.
