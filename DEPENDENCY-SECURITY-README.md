# Dependency security update — 15 October 2026

This is included in the refreshed physique photo check-in patch. If that patch is already extracted, only package.json and package-lock.json need replacement for this dependency fix. No additional database migration, AI request, environment setting or application feature change is introduced by the dependency update. The original photo feature still needs its own migration if not yet applied.

## Changes

- next: 16.3.3 -> 16.4.1.
- eslint-config-next: 16.3.3 -> 16.4.1, retaining the matching Next.js 16 tooling. No downgrade to Next.js/ESLint config 14.
- sharp: 0.35.4 -> 0.35.5. The earlier photo patch pinned a vulnerable Sharp release; this replacement corrects that pin.
- Compatible transitive fixes in package-lock.json: fast-uri 3.1.8, source-map-js 1.2.2, and brace-expansion 1.1.21/5.0.12 where required. Existing package major-version ranges are preserved. No new override/fork or audit suppression is used.

Do not run npm audit fix --force to accept the suggested eslint-config-next@14.2.35 downgrade.

## Audit result

After a normal compatible npm audit fix and the explicit version updates:

- npm audit --omit=dev: 0 vulnerabilities.
- npm audit: 5 high findings, 0 critical. All five are the same unresolved development-only chain: braces -> micromatch -> fast-glob -> @next/eslint-plugin-next -> eslint-config-next. The installed braces version is 3.0.3, and the advisory currently lists no patched release.

The remaining findings are not fixed or hidden. They affect the lint tooling dependency tree; the production dependency audit excludes them. This is not a promise that the application has no security issues. Review the upstream braces/Next.js lint-tool fixes when available.

References:
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-vcvr-r3jv-pc5j
- https://github.com/advisories/GHSA-wq5f-xc86-pv6w
- https://github.com/advisories/GHSA-hrr3-gc8f-f4qj
- https://github.com/advisories/GHSA-68fv-2mgg-jv7q
- https://github.com/advisories/GHSA-q2hr-2g5m-vwhr

## Apply

Stop the development server. Replace package.json and package-lock.json with the refreshed files, then run separately:

```powershell
npm ci
npm audit --omit=dev
npm run typecheck
npm run lint
node scripts/test-physique-service.mjs
npm run build
```

npm ci may still print the five development findings described above. A full npm audit will exit nonzero while those findings remain. The production-only audit should pass. If installing the complete photo feature for the first time, follow PHYSIQUE-CHECKINS-README.md for migration and deployment rather than staging only dependency files.

If all photo-feature files are already committed, stage only this dependency correction:

```powershell
git add package.json package-lock.json
git diff --cached
git commit -m "Update Next.js and Sharp security dependencies"
git push origin main
```

For a combined first-time photo deployment, stage the full photo patch file list instead.

Verification: typecheck, lint, optimized production build, and the real photo service's offline tests (including native Sharp re-encoding, ownership, dated comparisons and assessment acceptance) are run against the refreshed dependency tree. No production deployment or database change was performed here.
