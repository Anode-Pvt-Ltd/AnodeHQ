/**
 * Module resolution hooks so plain `node` can run scripts that import the
 * app's TypeScript sources directly (Node 24 strips the types itself).
 *
 * Handles the two things Node ESM does not do on its own:
 *   - extensionless relative imports  ./media      -> ./media.ts
 *   - the project path alias          @/types/app  -> src/types/app.ts
 */
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

const withExt = (base) => {
  for (const ext of [".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }
  return null;
};

export async function resolve(specifier, context, nextResolve) {
  // @/... alias
  if (specifier.startsWith("@/")) {
    const base = join(SRC, specifier.slice(2));
    const hit = existsSync(base) && !existsSync(base + ".ts") ? base : withExt(base) ?? base;
    return { url: pathToFileURL(hit).href, shortCircuit: true };
  }

  // extensionless relative import
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    const parentDir = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : ROOT;
    const hit = withExt(resolvePath(parentDir, specifier));
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
