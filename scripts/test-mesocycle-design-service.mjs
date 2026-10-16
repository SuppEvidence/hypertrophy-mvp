import { build } from "esbuild";
import Module from "node:module";
import path from "node:path";
const result = await build({
  entryPoints: ["scripts/test-mesocycle-design-service.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  plugins: [
    {
      name: "server-boundary-test",
      setup(b) {
        b.onResolve({ filter: /^server-only$/ }, () => ({
          path: "server-only",
          namespace: "empty",
        }));
        b.onLoad({ filter: /.*/, namespace: "empty" }, () => ({
          contents: "",
          loader: "js",
        }));
      },
    },
  ],
});
const filename = path.resolve("scripts/mesocycle-design-test.cjs");
const mod = new Module(filename);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(result.outputFiles[0].text, filename);
