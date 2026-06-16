import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "coverage",
  "scripts"
]);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const ALLOWED_PRISMA_IMPORT_PATHS = [
  path.normalize("lib/db/prisma.ts"),
  path.normalize("prisma/seed.ts"),
  path.normalize("prisma.config.ts")
];

const ALLOWED_PRISMA_SERVER_PREFIXES = [
  path.normalize("lib/server") + path.sep,
  path.normalize("lib/data") + path.sep
];

const problems = [];

function toRelative(filePath) {
  return path.relative(projectRoot, filePath);
}

function isAllowedPrismaImportLocation(relativePath) {
  const normalized = path.normalize(relativePath);

  if (ALLOWED_PRISMA_IMPORT_PATHS.includes(normalized)) {
    return true;
  }

  return ALLOWED_PRISMA_SERVER_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function shouldScan(filePath) {
  return SOURCE_EXTENSIONS.has(path.extname(filePath));
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walk(fullPath);
      continue;
    }

    if (!entry.isFile() || !shouldScan(fullPath)) continue;

    scanFile(fullPath);
  }
}

function scanFile(filePath) {
  const relativePath = toRelative(filePath);
  const normalizedRelativePath = path.normalize(relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    const importsPrismaClient =
      line.includes("from \"@prisma/client\"") ||
      line.includes("from '@prisma/client'") ||
      line.includes("require(\"@prisma/client\")") ||
      line.includes("require('@prisma/client')");

    if (importsPrismaClient && !isAllowedPrismaImportLocation(normalizedRelativePath)) {
      problems.push(
        `${relativePath}:${lineNumber}: unexpected @prisma/client import. Keep Prisma isolated to server/db files.`
      );
    }

    if (
      (normalizedRelativePath.startsWith(`app${path.sep}`) || normalizedRelativePath.startsWith(`components${path.sep}`)) &&
      /\bDecimal\b/.test(line)
    ) {
      problems.push(
        `${relativePath}:${lineNumber}: Decimal referenced in app/components. Convert Prisma Decimal values to plain numbers before rendering.`
      );
    }

    if (/type\s+\w+\s*=\s*Pick\s*;/.test(line)) {
      problems.push(`${relativePath}:${lineNumber}: invalid placeholder alias detected: type X = Pick;`);
    }
  });
}

const deprecatedMiddlewarePath = path.join(projectRoot, "middleware.ts");
if (fs.existsSync(deprecatedMiddlewarePath)) {
  problems.push("middleware.ts: deprecated Next.js middleware convention still exists. Use proxy.ts instead.");
}

walk(projectRoot);

if (problems.length > 0) {
  console.error("Production boundary verification failed:\n");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Production boundary verification passed.");
