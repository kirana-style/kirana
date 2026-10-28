/**
 * The browser engine's check (D-113, KRN-CMP-012): `@kirana-style/compiler-browser`'s packed tarball
 * is served to headless Chromium from a cross-origin-isolated page, compiles projects held in memory,
 * and must write what the native engine writes for the same files, byte for byte. It also prints how
 * long the engine takes to start and to compile, the numbers the playground is planned on.
 *
 *   bun scripts/browser-engine.ts                    # the tarball in dist-packages/ (bun run pack)
 *   bun scripts/browser-engine.ts --tarball <file>   # CI: the tarball the pack job made
 */
import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"

import { loadNative } from "@kirana-style/compiler"
import type { KiranaConfig } from "@kirana-style/core/config"

import { openProject } from "../npm/compiler-browser/src/project.ts"

const root = path.resolve(import.meta.dirname, "..")
const args = process.argv.slice(2)
const option = (name: string) => {
  const index = args.indexOf(`--${name}`)
  return index < 0 ? undefined : args[index + 1]
}
const { version } = JSON.parse(
  fs.readFileSync(path.join(root, "npm/compiler-browser/package.json"), "utf8")
) as { version: string }
const tarball = path.resolve(
  option("tarball") ??
    path.join(
      root,
      "dist-packages",
      `kirana-style-compiler-browser-${version}.tgz`
    )
)

type Fixture = {
  name: string
  config?: KiranaConfig
  files: Record<string, string>
}

/** One project per thing a browser engine needs to get right. */
const FIXTURES: Fixture[] = [
  {
    name: "one module",
    files: {
      "App.tsx": `import { css } from "@kirana-style/core"
const button = css({
  padding: "0.5rem 1rem",
  color: { base: "light-dark(#1a1510, #f5f2ec)", ":hover": "light-dark(#00736a, #6fd6c8)" },
  borderRadius: { base: "0.375rem", "@media (min-width: 40rem)": "0.625rem" },
})
export default function App({ quiet }: { quiet: boolean }) {
  return <button sx={[button, quiet && { opacity: 0.6 }]}>Kirana</button>
}
`,
    },
  },
  {
    name: "tokens from another module",
    files: {
      "src/tokens.ts": `import { defineTokens } from "@kirana-style/core"
export const brand = defineTokens("brand", { accent: "light-dark(#00736a, #6fd6c8)", gap: "1rem" }, { variable: true })
`,
      "src/App.tsx": `import { css } from "@kirana-style/core"
import { brand } from "./tokens"
import { Card } from "./Card"
const page = css({ display: "grid", gap: brand.gap, color: brand.accent })
export default function App() {
  return <main sx={page}><Card /></main>
}
`,
      "src/Card.tsx": `import { css } from "@kirana-style/core"
import { brand } from "./tokens"
const card = css({ borderColor: brand.accent, borderStyle: "solid", borderWidth: 1 })
export function Card() {
  return <article sx={card}>Card</article>
}
`,
    },
  },
  {
    name: "a configuration",
    config: {
      names: { prefix: "p" },
      layers: { before: ["reset", "base"] },
      targets: { safari: 16 },
    },
    files: {
      "App.tsx": `import { css } from "@kirana-style/core"
const box = css({ display: "flex", userSelect: "none", color: { base: "black", ":focus-visible": "teal" } })
export default function App() {
  return <div sx={box} />
}
`,
    },
  },
]

type Compiled = {
  modules: Record<string, string | undefined>
  diagnostics: string[]
  css: string
}

/** What the native engine writes for a fixture, from a directory as a project on disk. */
function native(fixture: Fixture): Compiled {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(tmpdir(), "kirana-browser-engine-"))
  )
  const project = openProject(
    { Compiler: loadNative().Compiler, __volume: fs },
    { root: directory, config: fixture.config, files: fixture.files }
  )
  return compile(project)
}

/** Every file transformed, then the minified stylesheet; runs in Node.js and in the page. */
function compile(project: ReturnType<typeof openProject>): Compiled {
  const modules: Record<string, string | undefined> = {}
  const diagnostics: string[] = []
  for (const file of project.files()) {
    const result = project.transform(file)
    modules[file] = result.code
    for (const diagnostic of result.diagnostics)
      diagnostics.push(
        `${diagnostic.file} ${diagnostic.code} ${diagnostic.message}`
      )
  }
  return { modules, diagnostics, css: project.stylesheet(true) }
}

const PAGE = `<!doctype html>
<meta charset="utf-8">
<script type="module">
  const started = performance.now()
  const { createProject } = await import("./compiler.js")
  window.loaded = performance.now() - started
  window.compile = (fixture) => {
    const project = createProject({ config: fixture.config, files: fixture.files })
    const modules = {}
    const diagnostics = []
    for (const file of project.files()) {
      const result = project.transform(file)
      modules[file] = result.code
      for (const diagnostic of result.diagnostics)
        diagnostics.push(diagnostic.file + " " + diagnostic.code + " " + diagnostic.message)
    }
    return { modules, diagnostics, css: project.stylesheet(true) }
  }
  window.ready = true
</script>
`

const TYPES: Record<string, string> = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".html": "text/html",
}

if (!fs.existsSync(tarball))
  throw new Error(
    `${tarball} not found: run \`bun run pack\` after the WebAssembly build`
  )
const unpacked = fs.mkdtempSync(path.join(tmpdir(), "kirana-browser-package-"))
const untar = spawnSync("tar", ["-xzf", tarball, "-C", unpacked])
if (untar.status !== 0) throw new Error(`tar failed: ${untar.stderr}`)
const served = path.join(unpacked, "package")

const server = createServer((request, response) => {
  const name = new URL(request.url ?? "/", "http://localhost").pathname
  const file =
    name === "/" ? undefined : path.join(served, path.normalize(name))
  const body =
    file === undefined
      ? PAGE
      : file.startsWith(served) && fs.existsSync(file)
        ? fs.readFileSync(file)
        : undefined
  response.writeHead(body === undefined ? 404 : 200, {
    "Content-Type": TYPES[path.extname(file ?? "index.html")] ?? "text/plain",
    // The engine's memory is a SharedArrayBuffer, which needs the page cross-origin isolated.
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  })
  response.end(body)
})
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`

const { chromium } = await import("playwright")
const browser = await chromium.launch({
  // Hosted Ubuntu restricts the user namespaces Chromium's sandbox needs.
  args: process.env.CI ? ["--no-sandbox"] : [],
})
const failures: string[] = []
try {
  const page = await browser.newPage()
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  page.on("requestfailed", (request) =>
    errors.push(`${request.url()}: ${request.failure()?.errorText}`)
  )
  await page.goto(url)
  await page
    .waitForFunction(() => (window as { ready?: boolean }).ready, undefined, {
      timeout: 60_000,
    })
    .catch(() => {
      throw new Error(
        `the engine did not start in the page: ${errors.join("; ")}`
      )
    })
  const loaded = await page.evaluate(
    () => (window as { loaded?: number }).loaded!
  )
  console.log(`engine started in ${loaded.toFixed(0)} ms`)
  for (const fixture of FIXTURES) {
    const expected = native(fixture)
    const started = performance.now()
    const actual = await page.evaluate(
      (input) =>
        (window as unknown as { compile: (f: Fixture) => Compiled }).compile(
          input
        ),
      fixture
    )
    const took = performance.now() - started
    const same =
      JSON.stringify(actual.modules) === JSON.stringify(expected.modules) &&
      actual.css === expected.css &&
      JSON.stringify(actual.diagnostics) ===
        JSON.stringify(expected.diagnostics)
    console.log(
      `${same ? "ok  " : "FAIL"} ${fixture.name}: ${actual.css.length} bytes of CSS in ${took.toFixed(0)} ms`
    )
    if (!same) {
      failures.push(fixture.name)
      console.log(`  native:  ${JSON.stringify(expected)}`)
      console.log(`  browser: ${JSON.stringify(actual)}`)
    }
  }
} finally {
  await browser.close()
  server.close()
}
if (failures.length)
  throw new Error(
    `the browser engine wrote something else than native for: ${failures.join(", ")}`
  )
console.log("the browser engine writes what the native engine writes")
