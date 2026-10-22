import { build } from "esbuild";
import { isBuiltin } from "node:module";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

export const deploymentRoutes = [
  { src: "^/api(?:/.*)?$", dest: "/api" },
  { handle: "filesystem" },
  { src: "/.*", dest: "/index.html" },
];

export async function buildDeployment({
  outputDirectory = join(root, ".vercel/output"),
  staticDirectory = join(root, "dist"),
} = {}) {
  await readFile(join(staticDirectory, "index.html"));

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
    packages: "bundle",
    metafile: true,
    footer: {
      js: "module.exports = module.exports.default;",
    },
    logLevel: "warning",
  });

  const imports = Object.values(result.metafile.outputs)
    .flatMap((output) => output.imports);

  const unresolved = imports.filter(
    (item) => item.external && !isBuiltin(item.path)
  );

  const optionalImports = new Set(["supports-color"]);

  const blockingImports = unresolved.filter(
    (item) => !optionalImports.has(item.path)
  );

  if (blockingImports.length > 0) {
    throw new Error(
      `Unresolved non-builtin imports: ${JSON.stringify(blockingImports)}`
    );
  }

  if (unresolved.length > blockingImports.length) {
    console.warn(
      "Optional external imports detected:",
      unresolved.filter((item) => optionalImports.has(item.path))
    );
  }

  const functionConfig = {
    runtime: "nodejs22.x",
    handler: "index.cjs",
    launcherType: "Nodejs",
  };

  await writeFile(
    join(functionDirectory, ".vc-config.json"),
    JSON.stringify(functionConfig, null, 2)
  );

  await cp(staticDirectory, join(output, "static"), {
    recursive: true,
  });

  await writeFile(
    join(output, "config.json"),
    JSON.stringify(
      {
        version: 3,
        routes: deploymentRoutes,
      },
      null,
      2
    )
  );

  await writeFile(
    join(output, "bundle-meta.json"),
    JSON.stringify(result.metafile, null, 2)
  );

  return {
    functionDirectory,
    imports,
    inputs: Object.keys(result.metafile.inputs),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const { functionDirectory, imports } = await buildDeployment();

  console.log(
    `Vercel handler: ${join(functionDirectory, "index.cjs")}`
  );

  console.log(
    `Bundle built with ${imports.length} recorded imports.`
  );
}
