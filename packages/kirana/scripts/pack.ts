/**
 * Packs every `@kirana-style/*` package the way it would be published, without publishing it (M4 phase 1,
 * KRN-INT-007, D-029).
 *
 *   bun scripts/pack.ts                       # this platform's native package only
 *   bun scripts/pack.ts --natives <dir>       # every `kirana.<triple>.node` found in <dir> (CI)
 *
 * The workspace keeps consuming TypeScript source (D-040): apps, tests and the compiler itself read
 * `src/*.ts` directly and none of that changes. Packing happens in a staging copy instead — compiled
 * to JavaScript with declarations by Vite+'s packer (`vite-plus/pack`, tsdown), one output file per
 * source file, `workspace:` and `catalog:` versions resolved, development scripts dropped — and
 * `npm pack` turns each copy into the tarball an install test installs.
 *
 * The native engine ships as one package per platform, listed as `optionalDependencies` of
 * `@kirana-style/compiler`, so the package manager installs only the one that matches. No package has an
 * install script, and this refuses to produce one that does: nobody should have to allow-list
 * Kirana to install it.
 */
import { spawnSync } from "node:child_process"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const repository = path.resolve(root, "../..")
const args = process.argv.slice(2)
const option = (name: string) => {
  const index = args.indexOf(`--${name}`)
  return index < 0 ? undefined : args[index + 1]
}
const out = path.resolve(root, option("out") ?? "dist-packages")
const natives = option("natives")

/** The eight native targets and what npm needs to pick one (KRN-INT-007). */
export const TARGETS: Record<
  string,
  { os: string; cpu: string; libc?: string }
> = {
  "darwin-arm64": { os: "darwin", cpu: "arm64" },
  "darwin-x64": { os: "darwin", cpu: "x64" },
  "linux-x64-gnu": { os: "linux", cpu: "x64", libc: "glibc" },
  "linux-x64-musl": { os: "linux", cpu: "x64", libc: "musl" },
  "linux-arm64-gnu": { os: "linux", cpu: "arm64", libc: "glibc" },
  "linux-arm64-musl": { os: "linux", cpu: "arm64", libc: "musl" },
  "win32-x64-msvc": { os: "win32", cpu: "x64" },
  "win32-arm64-msvc": { os: "win32", cpu: "arm64" },
}

/**
 * The WASI engine (KRN-INT-006): `wasm32` is no machine's CPU, so a package manager installs it only
 * when asked (`--cpu=wasm32`, or a WebContainer), and the Driver falls back to it when no native
 * addon loads. napi-rs's loaders need the runtime packages at run time.
 */
const WASI = {
  triple: "wasm32-wasi",
  files: [
    "kirana.wasm32-wasi.wasm",
    "kirana.wasi.cjs",
    "kirana.wasi-browser.js",
    "wasi-worker.mjs",
    "wasi-worker-browser.mjs",
  ],
  dependencies: ["@napi-rs/wasm-runtime", "@emnapi/core", "@emnapi/runtime"],
}

const INSTALL_SCRIPTS = ["preinstall", "install", "postinstall"]
/** Files from the repository root that every package carries: one changelog and one licence. */
const SHARED = ["CHANGELOG.md", "LICENSE"]

function shared(stage: string, names: string[]) {
  for (const name of names)
    copyFileSync(path.join(repository, name), path.join(stage, name))
}
const PACKAGES = [
  "core",
  "compiler",
  "cli",
  "rolldown",
  "vite",
  "webpack",
  "postcss",
  "next",
  "angular",
  "adonis",
  "ember",
  "parcel-transformer",
  "gatsby",
  "rspack",
  "bun",
  "esbuild",
  "jest",
  "remix",
  "astro",
  "preset-scales",
  "states",
  "eslint-plugin",
  "biome-plugin",
]

type Manifest = Record<string, unknown> & {
  name: string
  version: string
  exports?: Record<string, unknown>
  bin?: Record<string, string>
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  scripts?: Record<string, string>
}

/** Where every published package says it comes from. */
const PUBLIC = {
  author: "The Kirana authors",
  homepage: "https://kirana.style",
  repository: {
    type: "git",
    url: "git+https://github.com/kirana-style/kirana.git",
    directory: "packages/kirana/npm/compiler",
  },
  bugs: { url: "https://github.com/kirana-style/kirana/issues" },
}

const catalog: Record<string, string> = JSON.parse(
  readFileSync(path.join(repository, "package.json"), "utf8")
).workspaces.catalog

const versions = new Map(
  PACKAGES.map((name) => {
    const manifest = JSON.parse(
      readFileSync(path.join(root, "npm", name, "package.json"), "utf8")
    ) as Manifest
    return [manifest.name, manifest.version]
  })
)

/** `workspace:*` becomes the sibling's version, `catalog:` the root catalog's range. */
function resolve(dependencies: Record<string, string> | undefined) {
  if (!dependencies) return undefined
  return Object.fromEntries(
    Object.entries(dependencies).map(([name, range]) => {
      if (range.startsWith("workspace:")) {
        const version = versions.get(name)
        if (!version)
          throw new Error(
            `${name} is a workspace dependency this script does not pack`
          )
        return [name, version]
      }
      if (range === "catalog:") {
        const version = catalog[name]
        if (!version)
          throw new Error(`${name} has no entry in the root catalog`)
        // The catalog may alias a package for the workspace (`vite` is Vite+'s core); users get
        // the real one.
        if (version.startsWith("npm:"))
          throw new Error(
            `${name} is an alias in the root catalog (${version}): publish a plain range`
          )
        return [name, version]
      }
      return [name, range]
    })
  )
}

/** `./src/index.ts` becomes `{ types, default }` pointing at the compiled files. */
function compiled(target: unknown): unknown {
  if (
    typeof target !== "string" ||
    !target.endsWith(".ts") ||
    target.endsWith(".d.ts")
  ) {
    return target
  }
  const stem = target.slice(0, -".ts".length)
  return { types: `${stem}.d.ts`, default: `${stem}.js` }
}

function run(command: string, commandArgs: string[], cwd: string) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
  })
  if (result.status !== 0) {
    throw new Error(
      `${command} ${commandArgs.join(" ")} failed in ${cwd}\n${result.stdout}${result.stderr}`
    )
  }
  return result.stdout
}

/** Every file under a directory, relative to it. */
function files(directory: string): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(directory, path.join(entry.parentPath, entry.name))
    )
}

function refuseInstallScripts(manifest: Manifest) {
  const found = INSTALL_SCRIPTS.filter((name) => manifest.scripts?.[name])
  if (found.length) {
    throw new Error(
      `${manifest.name} declares ${found.join(", ")}; no Kirana package may (D-029)`
    )
  }
}

async function packOne(name: string): Promise<string> {
  const source = path.join(root, "npm", name)
  const stage = path.join(out, "stage", name)
  rmSync(stage, { recursive: true, force: true })
  mkdirSync(stage, { recursive: true })

  // Compile the sources the package exports, keeping the layout so exports only change extension.
  const inputs = [
    ...files(path.join(source, "src")).map((file) => path.join("src", file)),
    ...files(path.join(source, "bin")).map((file) => path.join("bin", file)),
  ].filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))
  if (inputs.length) {
    // Loaded here, not at the top: the example runner imports `TARGETS` from this file inside bare
    // containers (the Alpine install jobs), where the workspace's dependencies are not installed.
    const { build } = await import("vite-plus/pack")
    await build({
      config: false,
      cwd: source,
      entry: inputs,
      // Unbundled: each source file becomes one file at the same path, so exports only change
      // extension, and every package import stays an import of that package.
      unbundle: true,
      root: source,
      outDir: stage,
      clean: false,
      format: "esm",
      fixedExtension: false,
      platform: "node",
      target: "es2022",
      deps: { neverBundle: true },
      tsconfig: false,
      dts: { tsconfig: path.join(root, "tsconfig.pack.json") },
      report: false,
      logLevel: "warn",
    })
  }
  // Hand-written declarations and assets are not compiler output, so they are copied.
  const assets = [
    ...files(source)
      .filter(
        (file) => file.endsWith(".d.ts") && !file.includes("node_modules")
      )
      .filter((file) => !file.startsWith("test")),
    // Angular CLI builders: their manifest, and the option schemas it names.
    ...files(path.join(source, "schemas")).map((file) =>
      path.join("schemas", file)
    ),
    // Biome plugins: GritQL rules and the presets that list them.
    ...files(path.join(source, "rules")).map((file) =>
      path.join("rules", file)
    ),
    // Gatsby loads a plugin's `gatsby-node` from the package root.
    ...[
      "stylesheet.css",
      "README.md",
      "builders.json",
      "gatsby-node.mjs",
      "recommended.json",
      "strict.json",
    ].filter((file) => existsSync(path.join(source, file))),
  ]
  for (const file of assets) {
    mkdirSync(path.dirname(path.join(stage, file)), { recursive: true })
    copyFileSync(path.join(source, file), path.join(stage, file))
  }
  shared(stage, SHARED)

  const manifest = JSON.parse(
    readFileSync(path.join(source, "package.json"), "utf8")
  ) as Manifest
  refuseInstallScripts(manifest)
  const published: Manifest = {
    ...manifest,
    // A package with nothing to import gets no `exports` at all: an empty one would hide even its
    // `package.json` from `require.resolve`.
    exports: manifest.exports
      ? Object.fromEntries(
          Object.entries(manifest.exports).map(([key, value]) => [
            key,
            compiled(value),
          ])
        )
      : undefined,
    dependencies: resolve(manifest.dependencies),
    peerDependencies: manifest.peerDependencies,
    files: [
      "src",
      "bin",
      "*.d.ts",
      "*.css",
      "README.md",
      ...SHARED,
      "builders.json",
      "schemas",
      "gatsby-node.mjs",
      "rules",
      "recommended.json",
      "strict.json",
    ],
  }
  delete published.private
  delete published.scripts
  delete published.devDependencies
  delete published.napi
  if (manifest.bin) {
    published.bin = Object.fromEntries(
      Object.entries(manifest.bin).map(([key, value]) => [
        key,
        value.replace(/\.ts$/, ".js"),
      ])
    )
  }
  if (manifest.name === "@kirana-style/compiler") {
    published.optionalDependencies = Object.fromEntries(
      [...Object.keys(TARGETS), WASI.triple].map((triple) => [
        `@kirana-style/compiler-${triple}`,
        manifest.version,
      ])
    )
  }
  writeFileSync(
    path.join(stage, "package.json"),
    `${JSON.stringify(published, null, 2)}\n`
  )
  return run(
    "npm",
    ["pack", "--pack-destination", out, "--silent"],
    stage
  ).trim()
}

/** One package per native build found: `@kirana-style/compiler-<triple>` holding `kirana.<triple>.node`. */
function packNatives(directory: string, version: string): string[] {
  const tarballs: string[] = []
  for (const file of readdirSync(directory)) {
    const match = file.match(/^kirana\.(.+)\.node$/)
    if (!match) continue
    const triple = match[1]!
    const target = TARGETS[triple]
    if (!target) throw new Error(`${file} is not one of the supported targets`)
    const stage = path.join(out, "stage", `compiler-${triple}`)
    rmSync(stage, { recursive: true, force: true })
    mkdirSync(stage, { recursive: true })
    copyFileSync(path.join(directory, file), path.join(stage, file))
    shared(stage, ["LICENSE"])
    const manifest = {
      name: `@kirana-style/compiler-${triple}`,
      version,
      description: `The Kirana engine for ${triple}. Installed by @kirana-style/compiler; not used directly.`,
      license: "MIT",
      ...PUBLIC,
      main: file,
      files: [file, "LICENSE"],
      os: [target.os],
      cpu: [target.cpu],
      ...(target.libc ? { libc: [target.libc] } : {}),
    }
    writeFileSync(
      path.join(stage, "package.json"),
      `${JSON.stringify(manifest, null, 2)}\n`
    )
    tarballs.push(
      run("npm", ["pack", "--pack-destination", out, "--silent"], stage).trim()
    )
  }
  if (WASI.files.every((file) => existsSync(path.join(directory, file)))) {
    const stage = path.join(out, "stage", `compiler-${WASI.triple}`)
    rmSync(stage, { recursive: true, force: true })
    mkdirSync(stage, { recursive: true })
    for (const file of WASI.files)
      copyFileSync(path.join(directory, file), path.join(stage, file))
    shared(stage, ["LICENSE"])
    const manifest = {
      name: `@kirana-style/compiler-${WASI.triple}`,
      version,
      description:
        "The Kirana engine compiled to WebAssembly (WASI), for machines without a native build. Installed by @kirana-style/compiler; not used directly.",
      license: "MIT",
      ...PUBLIC,
      main: "kirana.wasi.cjs",
      browser: "kirana.wasi-browser.js",
      files: [...WASI.files, "LICENSE"],
      cpu: ["wasm32"],
      dependencies: Object.fromEntries(
        WASI.dependencies.map((name) => [name, catalog[name]!])
      ),
    }
    writeFileSync(
      path.join(stage, "package.json"),
      `${JSON.stringify(manifest, null, 2)}\n`
    )
    tarballs.push(
      run("npm", ["pack", "--pack-destination", out, "--silent"], stage).trim()
    )
  }
  return tarballs
}

if (import.meta.main) {
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const tarballs: string[] = []
  // One at a time: each build starts its own declaration compiler.
  for (const name of PACKAGES) tarballs.push(await packOne(name))
  const version = versions.get("@kirana-style/compiler")!
  const native = packNatives(
    natives ? path.resolve(natives) : path.join(root, "npm/compiler"),
    version
  )
  if (native.length === 0) {
    throw new Error(
      "no native build found: run `bun run kirana:build` first, or pass --natives"
    )
  }
  rmSync(path.join(out, "stage"), { recursive: true, force: true })
  console.log(`packed into ${path.relative(repository, out)}:`)
  for (const tarball of [...tarballs, ...native]) console.log(`  ${tarball}`)
}
