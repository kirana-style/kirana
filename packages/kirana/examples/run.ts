/**
 * Installs one example the way a user would and proves it works (M4, E-08, KRN-INT-007).
 *
 *   bun examples/run.ts vite-react --pm npm
 *   bun examples/run.ts vite-react --pm yarn-pnp --packages <dir> --keep
 *   bun examples/run.ts vite-react --pm bun --no-browser        # Alpine: no Chromium to drive
 *
 * The example is copied out of the repository — so nothing resolves through the workspace — and
 * every `@kirana-style/*` dependency is pointed at a tarball from `scripts/pack.ts`, with the package
 * manager's own override mechanism so the transitive ones (`@kirana-style/compiler` and its platform
 * package) come from the tarballs too. Nothing is published. Then it installs, builds, checks the
 * stylesheet holds the probe's atoms, serves the build and reads the probe's computed style back in
 * Chromium, hover included.
 *
 * The packed `@kirana-style/compiler` carries no native file, so a build that succeeds has loaded the
 * engine from the platform package the package manager chose.
 */
import { spawn, spawnSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"

import { TARGETS } from "../scripts/pack.ts"

const MANAGERS = ["npm", "pnpm", "yarn", "yarn-pnp", "bun"] as const
type Manager = (typeof MANAGERS)[number]

const args = process.argv.slice(2)
const option = (name: string) => {
  const index = args.indexOf(`--${name}`)
  return index < 0 ? undefined : args[index + 1]
}
const example = args.find(
  (arg, index) => !arg.startsWith("--") && !args[index - 1]?.startsWith("--")
)
const pm = (option("pm") ?? "npm") as Manager
const packages = path.resolve(
  option("packages") ?? path.join(import.meta.dirname, "../dist-packages")
)
const keep = args.includes("--keep")
const browser = !args.includes("--no-browser")
/**
 * The WASI engine instead of the native one (KRN-INT-006): installed as a direct dependency (npm only,
 * with `--force`, because its `cpu` is `wasm32`) and forced with `KIRANA_FORCE_WASI`, so a build that
 * succeeds compiled every module on WebAssembly.
 */
const wasi = args.includes("--wasi")
/**
 * The development server instead of a build (KRN-INT-009): start the example's `kirana-example.dev`
 * command, check the page, then change the probe's colour in `kirana-example.edit` and require the
 * browser to show it without a reload. npm only.
 */
const dev = args.includes("--dev")
/**
 * The runtime the build runs on (KRN-INT-006): `node` (default) or `deno`, which runs the example's
 * build binary from `node_modules`, native engine included. The install is npm's: `deno install`
 * links a local tarball as a directory instead of unpacking it, so it can only be tested against
 * the registry.
 */
const runtime = option("runtime") ?? "node"
/**
 * Where to write the Kirana class names in the built stylesheet, for `compare-atoms.ts`: the same
 * source must compile to the same atoms on every host (KRN-INT-001, D-028).
 */
const atoms = option("atoms")

if (!example || !MANAGERS.includes(pm)) {
  console.error(
    `usage: bun examples/run.ts <example> --pm <${MANAGERS.join("|")}>`
  )
  process.exit(2)
}
const source = path.join(import.meta.dirname, example)
if (!existsSync(path.join(source, "package.json"))) {
  console.error(`no example at ${source}`)
  process.exit(2)
}

/**
 * `kirana-style-compiler-linux-x64-gnu-0.1.0.tgz` → `@kirana-style/compiler-linux-x64-gnu`, and the
 * command line's own `kirana-style-0.1.0.tgz` → `kirana-style`.
 */
const tarballs = new Map<string, string>()
for (const file of existsSync(packages) ? readdirSync(packages) : []) {
  const match = file.match(/^kirana-style-(.+)-\d+\.\d+\.\d+(?:-[\w.]+)?\.tgz$/)
  if (match)
    tarballs.set(`@kirana-style/${match[1]}`, path.join(packages, file))
  else if (/^kirana-style-\d+\.\d+\.\d+(?:-[\w.]+)?\.tgz$/.test(file))
    tarballs.set("kirana-style", path.join(packages, file))
}
if (!tarballs.has("@kirana-style/compiler")) {
  console.error(
    `no packed @kirana-style/compiler in ${packages}: run \`bun run kirana:pack\` first`
  )
  process.exit(2)
}

const started = performance.now()
function step(label: string) {
  console.log(
    `\n[${((performance.now() - started) / 1000).toFixed(1)}s] ${label}`
  )
}

// A vite-plus shim marks its children so they skip it; the package manager the runner starts is
// a fresh command and must go through its own shim again.
const { VP_BYPASS: _, ...inherited } = process.env

function run(
  command: string,
  commandArgs: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = {}
) {
  console.log(`$ ${command} ${commandArgs.join(" ")}`)
  const result = spawnSync(command, commandArgs, {
    cwd,
    stdio: "inherit",
    // Windows ships the package managers as `.cmd` shims, which only a shell runs.
    shell: process.platform === "win32",
    env: { ...inherited, ...env },
  })
  if (result.status !== 0)
    throw new Error(
      `${command} ${commandArgs.join(" ")} exited ${result.status}`
    )
}

// Outside the repository, so no parent `node_modules`, lockfile or workspace is in reach.
// Resolved to its real path: macOS's temporary directory is under `/var`, a symlink to `/private/var`,
// and Yarn PnP records the path it was given while Node loads modules by the real one, so Vite could
// not find its own `rolldown` ("tried to access rolldown, but it isn't declared").
const directory = realpathSync(
  mkdtempSync(path.join(tmpdir(), `kirana-${example}-${pm}-`))
)
let failed = false
try {
  step(`${example} with ${pm} in ${directory}`)
  cpSync(source, directory, {
    recursive: true,
    filter: (file) => !/[\\/](node_modules|dist)$/.test(file),
  })

  const manifestPath = path.join(directory, "package.json")
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  const settings: {
    output?: string
    pack?: string[]
    once?: string[]
    /** The dev server command, `{port}` standing for the port (`["vite", "--port", "{port}"]`). */
    dev?: string[]
    /** The example is a test suite (`npm test`), not a page. */
    test?: boolean
    /** The file holding the probe's colour, edited to check hot updates. */
    edit?: string
    /**
     * The stylesheet's path on the running server, for a host that serves it rather than writing a
     * file (Remix's middleware): no build runs, and the stylesheet checks read it from the server.
     */
    served?: string
    /**
     * Where the probe is, relative to the server's root, when it is not the root page: Storybook
     * renders a story at `iframe.html?id=…`, inside the frame of its own interface.
     */
    page?: string
    /**
     * The framework updates that file in place (Vue, Svelte), so the page must not reload. Without
     * it — React with no refresh plugin, Astro pages — a reload that shows the new colour passes.
     */
    hot?: boolean
    /**
     * Commands run after the install, in order (`composer install`, `bundle install`): a server
     * framework's own dependencies. `{kirana}` stands for this repository's `packages/kirana`.
     */
    prepare?: string[][]
    /** A command started beside the dev server for its duration (`kirana-style dev` for a server app). */
    devAlso?: string[]
    /**
     * The page has no live-reload client (a server-rendered app): after the edit the check reloads
     * it until the new colour shows, which proves the watcher rewrote the stylesheet and class map.
     */
    reloads?: boolean
  } = manifest["kirana-example"] ?? {}
  /** The URL the checks open: the server's root, or the example's `page` under it. */
  const at = (url: string) =>
    settings.page ? new URL(settings.page, url).href : url
  // A server framework's manifest names Kirana's template helper by path: `{kirana}` is this
  // repository's `packages/kirana`, which the copy no longer sits inside.
  const kirana = path.resolve(import.meta.dirname, "..")
  for (const name of ["composer.json", "Gemfile", "mix.exs"]) {
    const file = path.join(directory, name)
    if (existsSync(file))
      writeFileSync(
        file,
        readFileSync(file, "utf8").replaceAll("{kirana}", kirana)
      )
  }
  // Local packages the example depends on, installed as tarballs so they land in `node_modules`
  // exactly as published ones do (a folder would be linked instead).
  for (const local of settings.pack ?? []) {
    const packed = spawnSync(
      "npm",
      ["pack", "--silent", "--pack-destination", directory],
      {
        cwd: path.join(directory, local),
        encoding: "utf8",
        shell: process.platform === "win32",
      }
    ).stdout.trim()
    manifest.dependencies[local] =
      `file:${path.join(directory, packed).replaceAll("\\", "/")}`
  }
  const file = (name: string) =>
    `file:${tarballs.get(name)!.replaceAll("\\", "/")}`
  for (const field of ["dependencies", "devDependencies"]) {
    for (const name of Object.keys(manifest[field] ?? {})) {
      // Every package there is a tarball for, the unscoped `kirana-style` included: npm refuses an
      // override that differs from a direct dependency's own range.
      if (tarballs.has(name)) manifest[field][name] = file(name)
    }
  }
  const overrides = Object.fromEntries(
    [...tarballs.keys()].map((name) => [name, file(name)])
  )
  // Yarn resolves every optional platform package to write its lockfile, even the ones it will
  // never install, so a platform that was not packed (only the host's is, outside CI) gets a stub
  // declaring that platform's os and cpu: resolvable, and never installed.
  const stubbed: string[] = []
  const platforms: Record<string, { os?: string; cpu: string }> = {
    ...TARGETS,
    "wasm32-wasi": { cpu: "wasm32" },
  }
  for (const [triple, target] of Object.entries(platforms)) {
    const name = `@kirana-style/compiler-${triple}`
    if (tarballs.has(name)) continue
    const stub = path.join(directory, ".stubs", triple)
    mkdirSync(stub, { recursive: true })
    writeFileSync(
      path.join(stub, "package.json"),
      JSON.stringify({
        name,
        version: manifest.version ?? "0.0.0",
        ...(target.os ? { os: [target.os] } : {}),
        cpu: [target.cpu],
      })
    )
    // A tarball, not a folder: Yarn looks for a skipped folder dependency in its cache and fails.
    const packed = spawnSync(
      "npm",
      ["pack", "--silent", "--pack-destination", ".."],
      {
        cwd: stub,
        encoding: "utf8",
        shell: process.platform === "win32",
      }
    ).stdout.trim()
    overrides[name] =
      `file:${path.join(stub, "..", packed).replaceAll("\\", "/")}`
    stubbed.push(triple)
  }
  if (stubbed.length)
    console.log(`stubbed platforms not packed: ${stubbed.join(", ")}`)
  if (pm === "pnpm") {
    // pnpm 10 onwards reads overrides from its workspace file; one with no `packages` is one project.
    writeFileSync(
      path.join(directory, "pnpm-workspace.yaml"),
      `overrides:\n${Object.entries(overrides)
        .map(([name, target]) => `  "${name}": "${target}"\n`)
        .join("")}`
    )
  } else if (pm === "yarn" || pm === "yarn-pnp")
    manifest.resolutions = overrides
  else manifest.overrides = overrides
  if (wasi) {
    if (pm !== "npm" || !tarballs.has("@kirana-style/compiler-wasm32-wasi")) {
      throw new Error(
        "--wasi needs --pm npm and a packed @kirana-style/compiler-wasm32-wasi"
      )
    }
    manifest.dependencies["@kirana-style/compiler-wasm32-wasi"] = file(
      "@kirana-style/compiler-wasm32-wasi"
    )
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  step("install")
  if (pm === "yarn" || pm === "yarn-pnp") {
    writeFileSync(
      path.join(directory, ".yarnrc.yml"),
      `nodeLinker: ${pm === "yarn" ? "node-modules" : "pnp"}\n`
    )
    writeFileSync(path.join(directory, "yarn.lock"), "")
    // The global cache, kept inside the temporary directory: with a project-local cache Yarn looks
    // for the skipped platform packages' archives there and fails (`ENOENT … .yarn/cache/…zip`).
    run("yarn", ["install"], directory, {
      YARN_ENABLE_IMMUTABLE_INSTALLS: "false",
      YARN_GLOBAL_FOLDER: path.join(directory, ".yarn-global"),
    })
  } else if (pm === "pnpm") {
    run(
      "pnpm",
      ["install", "--config.strict-peer-dependencies=false"],
      directory
    )
  } else if (pm === "bun") {
    run("bun", ["install"], directory)
  } else {
    run(
      "npm",
      ["install", "--no-audit", "--no-fund", ...(wasi ? ["--force"] : [])],
      directory
    )
  }

  if (settings.prepare?.length) {
    step("prepare")
    for (const [command, ...rest] of settings.prepare)
      run(
        command!,
        rest.map((arg) => arg.replaceAll("{kirana}", kirana)),
        directory
      )
  }

  if (settings.test) {
    // A test runner's example (Jest): its own tests are the check.
    step("test")
    run(pm === "yarn-pnp" ? "yarn" : pm, ["test"], directory)
    step(`✓ ${example} · ${pm} · test`)
  } else if (dev) {
    if (pm !== "npm" || !settings.dev || !settings.edit) {
      throw new Error("--dev needs --pm npm and kirana-example.dev and .edit")
    }
    step("development server")
    // A binary in node_modules runs through npx; anything else (bun, node, meteor, php) as it is.
    const [first, ...rest] = settings.dev
    const direct = !existsSync(
      path.join(directory, "node_modules", ".bin", first!)
    )
    const also = settings.devAlso
      ? spawn("npx", settings.devAlso, {
          cwd: directory,
          stdio: "inherit",
          shell: process.platform === "win32",
          detached: process.platform !== "win32",
          env: inherited,
        })
      : undefined
    // Give the watcher its first pass, so the page has a stylesheet and a class map to read.
    if (also) await new Promise((resolve) => setTimeout(resolve, 3000))
    try {
      await withServer(
        directory,
        direct ? first! : "npx",
        direct ? rest : settings.dev,
        {},
        async (url) => {
          await checkPage(at(url), { development: true })
          await checkHotUpdate(
            at(url),
            path.join(directory, settings.edit!),
            settings.hot ?? false,
            settings.reloads ?? false
          )
        }
      )
    } finally {
      if (also?.pid) {
        if (process.platform === "win32")
          spawnSync("taskkill", ["/pid", String(also.pid), "/T", "/F"])
        else process.kill(-also.pid, "SIGTERM")
      }
    }
    step(`✓ ${example} · ${pm} · dev`)
  } else if (settings.served) {
    // A host that compiles as it serves: start it, check the page, then the stylesheet it serves.
    step("server")
    await withServer(
      directory,
      pm === "yarn-pnp" ? "yarn" : pm,
      ["run", "start"],
      {},
      async (url) => {
        if (browser) await checkPage(at(url))
        const response = await fetch(new URL(settings.served!, url))
        if (!response.ok)
          throw new Error(`${settings.served} answered ${response.status}`)
        const css = await response.text()
        checkStylesheet(css)
        console.log(`✓ ${css.length} bytes served, probe atoms present`)
      }
    )
    step(`✓ ${example} · ${pm}`)
  } else {
    step(wasi ? "build on the WASI engine" : `build on ${runtime}`)
    if (runtime === "deno") {
      const [bin, ...rest] = (manifest.scripts.build as string).split(" ")
      run(
        process.env.KIRANA_DENO ?? "deno",
        ["run", "-A", path.join("node_modules", ".bin", bin!), ...rest],
        directory
      )
    } else
      run(
        pm === "yarn-pnp" ? "yarn" : pm,
        ["run", "build"],
        directory,
        wasi ? { KIRANA_FORCE_WASI: "1" } : {}
      )

    step("stylesheet")
    // Wherever the host put it: Vite under `assets/`, Rolldown at the name the example chose, Next.js
    // under `.next/static` (an example names a directory other than `dist` in `kirana-example.output`).
    const output = path.join(directory, settings.output ?? "dist")
    const css = stylesheetText(output)
    checkStylesheet(css)
    // Declarations the example writes in more than one place must reach the stylesheet once.
    for (const once of settings.once ?? []) {
      const count = css.replaceAll(" ", "").split(once).length - 1
      if (count !== 1)
        throw new Error(
          `\`${once}\` is in the stylesheet ${count} times, not once`
        )
    }
    console.log(`✓ ${css.length} bytes, probe atoms present`)
    if (atoms) {
      const names = [...new Set(css.match(/\.k[\w-]*_[\w-]+/g) ?? [])].sort()
      mkdirSync(path.dirname(path.resolve(atoms)), { recursive: true })
      writeFileSync(
        path.resolve(atoms),
        `${JSON.stringify({ example, names }, null, 2)}\n`
      )
    }

    if (wasi) {
      // The two engines must write the same bytes (KRN-OUT-006): build again natively and compare.
      step("build on the native engine, to compare")
      run(pm, ["run", "build"], directory)
      const native = stylesheetText(output)
      if (native !== css) {
        throw new Error(
          `the WASI and native engines wrote different stylesheets:\n${css}\n---\n${native}`
        )
      }
      console.log("✓ the WASI and native stylesheets are identical")
    }

    if (browser) {
      step("browser")
      // An example with a `start` script is a server (Next.js); the rest are static files.
      await (manifest.scripts?.start
        ? withServer(
            directory,
            pm === "yarn-pnp" ? "yarn" : pm,
            ["run", "start"],
            {},
            (url) => checkPage(at(url))
          )
        : withStatic(output, (url) => checkPage(at(url))))
    }
    step(`✓ ${example} · ${pm}`)
  }
} catch (error) {
  failed = true
  console.error(`\n✗ ${example} · ${pm}: ${(error as Error).message}`)
} finally {
  if (keep) console.log(`kept ${directory}`)
  else rmSync(directory, { recursive: true, force: true, maxRetries: 3 })
}
process.exit(failed ? 1 : 0)

/** Serves a static build for the duration of `check`. */
async function withStatic(root: string, check: (url: string) => Promise<void>) {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname
    const target = path.join(root, pathname === "/" ? "index.html" : pathname)
    if (!target.startsWith(root) || !existsSync(target)) {
      response.writeHead(404).end()
      return
    }
    const type = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
    }[path.extname(target)]
    response
      .writeHead(200, type ? { "content-type": type } : {})
      .end(readFileSync(target))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  try {
    await check(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`)
  } finally {
    server.close()
  }
}

/** Runs the example's `start` script on a free port for the duration of `check`. */
async function withServer(
  project: string,
  command: string,
  commandArgs: string[],
  env: NodeJS.ProcessEnv,
  check: (url: string) => Promise<void>
) {
  const port = await new Promise<number>((resolve) => {
    const probe = createServer().listen(0, "127.0.0.1", () => {
      const free = (probe.address() as AddressInfo).port
      probe.close(() => resolve(free))
    })
  })
  const argv = commandArgs.map((arg) => arg.replaceAll("{port}", String(port)))
  console.log(`$ PORT=${port} ${command} ${argv.join(" ")}`)
  const child = spawn(command, argv, {
    cwd: project,
    stdio: "inherit",
    shell: process.platform === "win32",
    // Its own process group, so stopping it stops the server the script started too.
    detached: process.platform !== "win32",
    env: { ...inherited, ...env, PORT: String(port) },
  })
  const url = `http://127.0.0.1:${port}/`
  try {
    const deadline = Date.now() + 60_000
    for (;;) {
      if (child.exitCode !== null)
        throw new Error(`the server exited ${child.exitCode}`)
      const ready = await fetch(url).then(
        (response) => response.ok,
        () => false
      )
      if (ready) break
      if (Date.now() > deadline)
        throw new Error(`nothing answered at ${url} within 60 s`)
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    await check(url)
  } finally {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"])
    } else {
      try {
        process.kill(-child.pid!, "SIGTERM")
      } catch {
        // Already gone.
      }
    }
  }
}

/** Reads the probe's computed style at `url`, before and during hover. */
async function checkPage(
  url: string,
  { development = false }: { development?: boolean } = {}
) {
  const { chromium } = await import("playwright")
  // Playwright's bundled Chromium by default; KIRANA_CHROME_CHANNEL=chrome uses an installed Chrome.
  const channel = process.env.KIRANA_CHROME_CHANNEL
  const chrome = await chromium.launch(channel ? { channel } : {})
  try {
    if (development) {
      // A development server's first visit is not the page a developer reads: Vite discovers the
      // dependencies to pre-bundle (`@kirana-style/core/internal` among them), bundles them and
      // reloads the page, and on a slow runner that first page can stay without its stylesheet
      // (Ember in CI). Visit once and let the server finish, as a developer's first load does; the
      // check below reads a fresh page, with every dependency already bundled.
      // The budget is the server's, not the check's: in CI, Ember's pre-bundle of about a thousand
      // packages was still running ("bundling dependencies…", no "optimized" after it) when a 30 s
      // check gave up, and the page's scripts wait for it.
      const warm = await chrome.newPage()
      await warm.goto(url, { timeout: 120_000 })
      await warm.waitForLoadState("networkidle", { timeout: 120_000 })
      await warm.waitForTimeout(1000)
      await warm.waitForLoadState("networkidle", { timeout: 120_000 })
      await warm.close()
    }
    const page = await chrome.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(url)
    const probe = page.locator("[data-probe]")
    await probe.waitFor()
    const read = () =>
      probe.evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          color: style.color,
          paddingTop: style.paddingTop,
          backgroundColor: style.backgroundColor,
        }
      })
    const expect = (
      actual: Record<string, string>,
      expected: Record<string, string>
    ) => {
      for (const [key, value] of Object.entries(expected)) {
        if (actual[key] !== value) {
          throw new Error(`probe ${key} is ${actual[key]}, expected ${value}`)
        }
      }
    }
    // A development server delivers the stylesheet after the page: it fills as modules compile and
    // arrives as a hot update (KRN-INT-009), so the probe can exist before its styles do. Some reload
    // the page once on first visit, too: Vite finds a dependency to pre-bundle (Ember's, in CI), and
    // a read during the reload fails. Read until the values match, and fail with the last reading if
    // they never do; 30 s covers a slow runner's first pre-bundle.
    // The last resort, in development only: one reload, as a developer would press, then the same
    // exact values or a failure with the last reading.
    const settled = async (
      expected: Record<string, string>,
      reloads = development ? 1 : 0
    ): Promise<void> => {
      const deadline = Date.now() + 30_000
      for (;;) {
        try {
          return expect(await read(), expected)
        } catch (error) {
          if (Date.now() <= deadline) {
            await page.waitForTimeout(100)
            continue
          }
          if (reloads === 0) throw error
          await page.reload()
          await probe.waitFor()
          return settled(expected, reloads - 1)
        }
      }
    }
    await settled({
      color: "rgb(1, 2, 3)",
      paddingTop: "7px",
      backgroundColor: "rgb(250, 250, 250)",
    })
    await probe.hover()
    await settled({ backgroundColor: "rgb(4, 5, 6)" })
    if (errors.length) throw new Error(`the page threw: ${errors.join("; ")}`)
    console.log("✓ computed style and hover match")
  } finally {
    await chrome.close()
  }
}

/** Every stylesheet a build wrote: CSS files, and `<style>` blocks in HTML (Astro inlines small ones). */
/** The probe's atoms are in a stylesheet, in either spelling of the colour: a host's CSS minifier may
 * shorten it (webpack writes `#010203`). */
function checkStylesheet(css: string) {
  for (const expected of [
    ["color:rgb(1,2,3)", "color:#010203"],
    ["padding-top:7px"],
    [":hover"],
  ]) {
    if (!expected.some((text) => css.replaceAll(" ", "").includes(text))) {
      throw new Error(`the stylesheet has no \`${expected[0]}\`:\n${css}`)
    }
  }
}

function stylesheetText(output: string): string {
  return readdirSync(output, { recursive: true, encoding: "utf8" })
    .filter((name) => /\.(?:css|html)$/.test(name))
    .map((name) => {
      const text = readFileSync(path.join(output, name), "utf8")
      // Astro inlines a small stylesheet into the page.
      return name.endsWith(".css")
        ? text
        : [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
            .map((match) => match[1])
            .join("\n")
    })
    .join("\n")
}

/**
 * Changes the probe's colour in `file` while the page is open and waits for the page to show it;
 * with `hot`, without reloading — the CSS hot update reached the browser (KRN-INT-009).
 */
async function checkHotUpdate(
  url: string,
  file: string,
  hot: boolean,
  reloads: boolean
) {
  const { chromium } = await import("playwright")
  const channel = process.env.KIRANA_CHROME_CHANNEL
  const chrome = await chromium.launch(channel ? { channel } : {})
  try {
    const page = await chrome.newPage()
    // An edit before the client's hot-update socket is connected would reach nobody; Nuxt connects
    // well after the page shows.
    const connected = new Promise<void>((resolve) => {
      page.on("console", (message) => {
        if (message.text().includes("[vite] connected")) resolve()
      })
      setTimeout(resolve, 10_000)
    })
    await page.goto(url)
    await page.locator("[data-probe]").waitFor()
    await connected
    // And after the dev server has settled: Nuxt finishes optimising dependencies after the first
    // page, and an edit made meanwhile is lost with the reload that follows.
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(1000)
    // A marker the page keeps only if it is not reloaded.
    await page.evaluate(() => ((window as { kept?: boolean }).kept = true))
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace("rgb(1, 2, 3)", "rgb(9, 8, 7)")
    )
    const edited = (timeout: number) =>
      page
        .waitForFunction(
          () =>
            getComputedStyle(document.querySelector("[data-probe]")!).color ===
            "rgb(9, 8, 7)",
          null,
          { timeout }
        )
        .then(
          () => true,
          () => false
        )
    let reached = false
    if (reloads) {
      for (let attempt = 0; attempt < 20 && !reached; attempt++) {
        await page.reload()
        reached = await edited(1000)
      }
    } else {
      // One budget of 20 s. A page that reloads itself mid-check (Ember re-runs the edited template
      // module, and the stylesheet update may land before or after) takes the check's context with
      // it; wait for the new page and look again. A hot-update example still fails below if the
      // page reloaded.
      const deadline = Date.now() + 20_000
      while (!reached && Date.now() < deadline) {
        reached = await edited(Math.max(1, deadline - Date.now()))
        if (!reached) await page.waitForLoadState("load").catch(() => {})
      }
    }
    if (!reached) throw new Error("the edited colour never reached the page")
    if (
      hot &&
      !(await page.evaluate(() => (window as { kept?: boolean }).kept))
    ) {
      throw new Error("the page reloaded instead of taking a CSS hot update")
    }
    console.log(
      hot
        ? "✓ a style edit reached the page as a hot update"
        : reloads
          ? "✓ a style edit reached the page on reload"
          : "✓ a style edit reached the page"
    )
  } finally {
    await chrome.close()
  }
}
