import { build } from "esbuild";
import { isBuiltin } from "node:module";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

// This manifest, not filesystem discovery of api/*.ts, selects the function.
export const deploymentRoutes = [
  { src: "^/api(?:/.*)?$", dest: "/api" },
  { handle: "filesystem" },
  { src: "/.*", dest: "/index.html" },
];

export async function buildDeployment({
  outputDirectory = join(root, ".vercel/output"),
  staticDirectory = join(root, "dist"),
} = {}) {
  // Validate the frontend before replacing the previous generated output.
  await readFile(join(staticDirectory, "index.html"));
  // Callers may use a fresh temporary directory for isolated regression tests.
  const output = resolve(outputDirectory);
  if (output === root || output === resolve(staticDirectory)) {
    throw new Error("Refusing to replace a source or frontend directory");
  }
  await rm(output, { recursive: true, force: true });
  const functionDirectory = join(output, "functions/api.func");
  await mkdir(functionDirectory, { recursive: true });
  const result = await build({
    absWorkingDir: root,
    entryPoints: ["server/vercel.ts"],
    outfile: join(functionDirectory, "index.cjs"),
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    // Bundle packages too, so the .func is independent of the repository and
    // node_modules. CommonJS preserves Node require() used by Express.
    packages: "bundle",
    metafile: true,
    footer: { js: "module.exports = module.exports.default;" },
    logLevel: "warning",
  });

  const imports = Object.values(result.metafile.outputs).flatMap(o => o.imports);
  const unresolved = imports.filter(i => !i.external || !isBuiltin(i.path));
  if (unresolved.length) {
    throw new Error(`Unresolved non-builtin imports: ${JSON.stringify(unresolved)}`);
  }
  const functionConfig = {
    runtime: "nodejs22.x",
    handler: "index.cjs",
    launcherType: "Nodejs",
  };
  await writeFile(join(functionDirectory, ".vc-config.json"), JSON.stringify(functionConfig, null, 2));
  await cp(staticDirectory, join(output, "static"), { recursive: true });
  await writeFile(join(output, "config.json"), JSON.stringify({ version: 3, routes: deploymentRoutes }, null, 2));
  // Diagnostic only, outside the deployed function/static directories. Does
  // not contain environment values: no env loading or substitutions occur.
  await writeFile(join(output, "bundle-meta.json"), JSON.stringify(result.metafile, null, 2));
  return { functionDirectory, imports, inputs: Object.keys(result.metafile.inputs) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { functionDirectory, imports } = await buildDeployment();
  console.log(`Vercel handler: ${join(functionDirectory, "index.cjs")}`);
  console.log(`Verified bundle: ${imports.length} Node built-in imports; no unresolved local/package imports.`);
}
