import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { PassThrough } from "node:stream"

import { afterAll, describe, expect, it, vi } from "vitest"

import { main, terminal } from "../src/cli.ts"
import { compiled, runDev } from "../src/dev.ts"
import {
  adapterOf,
  detect,
  installCommand,
  packageManagerOf,
  readPackage,
  runtimeOf,
  typesOf,
} from "../src/detect.ts"
import { diagnose, installedVersions, runDoctor } from "../src/doctor.ts"
import {
  addImport,
  describe as describeProject,
  diff,
  insertFirst,
  insertLast,
  plan,
  runInit,
  wrapDefault,
} from "../src/init.ts"
import type { Io } from "../src/init.ts"
import { loadNative } from "../src/native.ts"

const created: string[] = []
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

/** A project in the temporary directory, away from any lockfile above it. */
function project(files: Record<string, string>, base = tmpdir()): string {
  const root = mkdtempSync(path.join(base, "kirana-setup-"))
  created.push(root)
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    writeFileSync(path.join(root, name), text)
  }
  return root
}

const pkg = (dependencies: Record<string, string>, extra: object = {}) =>
  JSON.stringify({ name: "app", dependencies, ...extra })

const read = (root: string, file: string) =>
  readFileSync(path.join(root, file), "utf8")

/** The status of each step, by name. */
const statuses = (root: string, preset = false) =>
  Object.fromEntries(
    plan(root, { preset }).steps.map((step) => [step.name, step.status])
  )

describe("KRN-DX-008 detecting a project", () => {
  it("names the framework, bundler and package manager", () => {
    const cases: [Record<string, string>, object, string, string][] = [
      [{ next: "16" }, {}, "next", "turbopack"],
      [
        { next: "16" },
        { scripts: { build: "next build --webpack" } },
        "next",
        "webpack",
      ],
      [{ nuxt: "4" }, {}, "nuxt", "vite"],
      [{ "@sveltejs/kit": "2" }, {}, "sveltekit", "vite"],
      [{ astro: "5" }, {}, "astro", "vite"],
      [{ "@tanstack/react-start": "1" }, {}, "tanstack-start", "vite"],
      [{ preact: "10", vite: "8" }, {}, "preact", "vite"],
      [{ "solid-js": "1", "@rsbuild/core": "1" }, {}, "solid", "rsbuild"],
      [{ vue: "3", "@rspack/core": "1" }, {}, "vue", "rspack"],
      [{ svelte: "5", webpack: "5" }, {}, "svelte", "webpack"],
      [{ react: "19", rolldown: "1" }, {}, "react", "rolldown"],
      [{ esbuild: "0" }, {}, "vanilla", "esbuild"],
      [{}, { scripts: { build: "bun build ./index.ts" } }, "vanilla", "bun"],
      [{}, {}, "vanilla", "none"],
    ]
    for (const [dependencies, extra, framework, bundler] of cases) {
      const root = project({ "package.json": pkg(dependencies, extra) })
      expect(detect(root)).toMatchObject({ framework, bundler })
    }
  })

  it("finds the package manager by field, by lockfile here or above, or falls back to npm", () => {
    const workspace = project({ "pnpm-lock.yaml": "" })
    const nested = path.join(workspace, "apps/web")
    mkdirSync(nested, { recursive: true })
    expect(packageManagerOf(nested, {})).toBe("pnpm")
    expect(packageManagerOf(nested, { packageManager: "yarn@4.0.0" })).toBe(
      "yarn"
    )
    expect(packageManagerOf(nested, { packageManager: "deno@2" })).toBe("pnpm")
    expect(packageManagerOf(project({ "bun.lock": "" }), {})).toBe("bun")
    expect(packageManagerOf(project({}), {})).toBe("npm")
    expect(readPackage(project({}))).toEqual({})
  })

  it("knows each host's adapter, the sx types and the install command", () => {
    const of = (framework: string, bundler: string) =>
      adapterOf({ framework, bundler } as Parameters<typeof adapterOf>[0])
    expect(of("next", "turbopack")).toEqual([
      "@kirana-style/next",
      "@kirana-style/postcss",
      "postcss",
    ])
    expect(of("next", "webpack")).toEqual(["@kirana-style/webpack"])
    expect(of("astro", "vite")).toEqual(["@kirana-style/astro"])
    expect(of("react", "rsbuild")).toEqual(["@kirana-style/rspack"])
    expect(of("vanilla", "bun")).toEqual(["@kirana-style/bun"])
    expect(of("vanilla", "none")).toEqual([])
    expect(typesOf("nuxt")).toBe("@kirana-style/core/vue")
    expect(typesOf("vanilla")).toBeUndefined()
    expect(installCommand("npm", ["a"], ["b"])).toEqual([
      "npm install a",
      "npm install -D b",
    ])
    expect(installCommand("bun", [], ["b"])).toEqual(["bun add -d b"])
    expect(installCommand("pnpm", ["a"], [])).toEqual(["pnpm add a"])
  })
})

describe("KRN-DX-008 kirana init's edits", () => {
  it("adds imports in the module's style", () => {
    expect(addImport(`import a from "a";\n\nx()\n`, `import k from "k"`)).toBe(
      `import a from "a";\nimport k from "k";\n\nx()\n`
    )
    expect(addImport(`import a from 'a'\n`, `import k from "k"`)).toBe(
      `import a from 'a'\nimport k from 'k'\n`
    )
    expect(
      addImport(`import {\n  a,\n} from "a"\nx()\n`, `import k from "k"`)
    ).toBe(`import {\n  a,\n} from "a"\nimport k from "k"\nx()\n`)
    expect(addImport("x()\n", `import k from "k"`)).toBe(
      `import k from "k"\n\nx()\n`
    )
    expect(addImport("\nx()\n", `import k from "k"`)).toBe(
      `import k from "k"\n\nx()\n`
    )
  })

  it("inserts first in a list, keeping its layout", () => {
    const plugins = /plugins:\s*\[/
    expect(insertFirst("plugins: [a()]", plugins, "k()")).toBe(
      "plugins: [k(), a()]"
    )
    expect(insertFirst("plugins: []", plugins, "k()")).toBe("plugins: [k()]")
    expect(insertFirst("plugins: [\n    a(),\n  ]", plugins, "k()")).toBe(
      "plugins: [\n    k(),\n    a(),\n  ]"
    )
    expect(insertFirst("plugins: { }", /plugins:\s*\{/, `"k": {}`)).toBe(
      `plugins: { "k": {}}`
    )
    expect(insertFirst("nothing", plugins, "k()")).toBeUndefined()
  })

  it("wraps a default export that ends the module, and leaves the rest to a person", () => {
    expect(wrapDefault("const c = {}\nexport default c;\n", "w")).toBe(
      "const c = {}\nexport default w(c);\n"
    )
    expect(wrapDefault("export default {\n  a: 1,\n}\n", "w")).toBe(
      "export default w({\n  a: 1,\n})\n"
    )
    expect(wrapDefault("export default a;\nfoo()\n", "w")).toBeUndefined()
    expect(wrapDefault("module.exports = {}\n", "w")).toBeUndefined()
  })

  it("diffs by line, with context and gaps", () => {
    expect(diff({ file: "a", after: "x\ny" })).toBe("+++ a (new)\n+ x\n+ y\n")
    const before = ["1", "2", "3", "4", "5", "6", "7"].join("\n")
    const after = ["0", "1", "2", "3", "4", "five", "6", "7"].join("\n")
    expect(diff({ file: "a", before, after })).toBe(
      "--- a\n+ 0\n  1\n  …\n  4\n- 5\n+ five\n  6\n"
    )
  })
})

describe("KRN-DX-008 kirana init's plan", () => {
  it("sets up Next.js on Turbopack: withKirana, PostCSS and @kirana;", () => {
    const root = project({
      "package.json": pkg({ next: "16" }),
      "tsconfig.json": "{}",
      "next.config.ts": `import type { NextConfig } from "next";\n\nconst nextConfig: NextConfig = {};\n\nexport default nextConfig;\n`,
      "postcss.config.mjs": `const config = {\n  plugins: {\n    "@tailwindcss/postcss": {},\n  },\n};\nexport default config;\n`,
      "app/globals.css": `@import "tailwindcss";`,
    })
    const result = plan(root)
    expect(result.steps.map((step) => step.status)).toEqual([
      "change",
      "change",
      "change",
      "change",
    ])
    const changes = Object.fromEntries(
      result.steps
        .flatMap((step) => (step.status === "change" ? step.changes : []))
        .map((change) => [change.file, change.after])
    )
    // Not `"type": "module"`, so the configuration is `.mts`: Node.js would warn on `.ts`.
    expect(changes["kirana.config.mts"]).toContain("defineConfig({})")
    expect(changes["next.config.ts"]).toContain(
      `import { withKirana } from "@kirana-style/next";`
    )
    expect(changes["next.config.ts"]).toContain(
      "export default withKirana(nextConfig);"
    )
    expect(changes["postcss.config.mjs"]).toContain(
      `    "@kirana-style/postcss": {},\n    "@tailwindcss/postcss"`
    )
    expect(changes["app/globals.css"]).toBe(
      `@import "tailwindcss";\n@kirana;\n`
    )
    expect(changes["kirana.d.ts"]).toBe(
      `/// <reference types="@kirana-style/core/react" />\n`
    )
    expect(result.dependencies).toEqual(["@kirana-style/core"])
    expect(result.development).toEqual([
      "@kirana-style/compiler",
      "@kirana-style/next",
      "@kirana-style/postcss",
      "postcss",
    ])
  })

  it("creates what a Next.js project lacks, and imports a new globals.css", () => {
    const root = project({
      "package.json": pkg(
        { next: "16", "@kirana-style/core": "0.1.0" },
        { type: "module" }
      ),
      "src/app/layout.jsx": `export default function Layout() {}\n`,
    })
    const changes = plan(root).steps.flatMap((step) =>
      step.status === "change" ? step.changes : []
    )
    const files = Object.fromEntries(
      changes.map((change) => [change.file, change])
    )
    expect(files["kirana.config.mjs"]!.before).toBeUndefined()
    expect(files["next.config.mjs"]!.after).toBe(
      `import { withKirana } from "@kirana-style/next"\n\nexport default withKirana({})\n`
    )
    expect(files["postcss.config.mjs"]!.after).toContain(
      `"@kirana-style/postcss": {}`
    )
    expect(files["src/app/globals.css"]!.after).toBe("@kirana;\n")
    expect(files["src/app/layout.jsx"]!.after).toBe(
      `import "./globals.css"\n\nexport default function Layout() {}\n`
    )
    expect(plan(root).dependencies).toEqual([])
  })

  it("asks for a hand where a Next.js configuration is not in a shape it edits", () => {
    const root = project({
      "package.json": pkg({ next: "16" }),
      "next.config.js": "module.exports = {}\n",
      "postcss.config.js": "module.exports = { plugins: [require('x')] }\n",
      "styles/globals.css": "@kirana;\n",
    })
    const steps = plan(root).steps
    expect(steps[1]).toMatchObject({ status: "manual" })
    expect(steps[1]!.detail).toContain(
      "next.config.js: wrap the exported configuration"
    )
    expect(steps[1]!.detail).toContain(
      `postcss.config.js: add "@kirana-style/postcss"`
    )
    expect(steps[2]).toMatchObject({
      status: "done",
      detail: "styles/globals.css",
    })
    // No layout to import a stylesheet from.
    const bare = project({ "package.json": pkg({ next: "16" }) })
    expect(plan(bare).steps[2]).toMatchObject({ status: "manual" })
  })

  it("merges a done and a changed half of one step", () => {
    const root = project({
      "package.json": pkg({ next: "16" }),
      "next.config.mjs": `import { withKirana } from "@kirana-style/next"\nexport default withKirana({})\n`,
      "app/globals.css": "body {}",
    })
    const adapter = plan(root).steps[1]!
    expect(adapter).toMatchObject({
      status: "change",
      detail: "create postcss.config.mjs",
    })
    writeFileSync(
      path.join(root, "postcss.config.mjs"),
      `export default { plugins: { "@kirana-style/postcss": {} } }\n`
    )
    expect(plan(root).steps[1]).toMatchObject({
      status: "done",
      detail: "next.config.mjs, postcss.config.mjs",
    })
  })

  it("sets up Next.js on webpack with the stylesheet import", () => {
    const root = project({
      "package.json": pkg(
        { next: "16" },
        { scripts: { dev: "next dev --webpack" } }
      ),
      "next.config.mjs": "export default {}\n",
      "pages/_app.tsx": "export default function App() {}\n",
    })
    const changes = plan(root).steps.flatMap((step) =>
      step.status === "change" ? step.changes : []
    )
    expect(
      changes.find((change) => change.file === "next.config.mjs")!.after
    ).toContain("@kirana-style/webpack/next")
    expect(
      changes.find((change) => change.file === "pages/_app.tsx")!.after
    ).toMatch(/^import "@kirana-style\/core\/stylesheet.css"\n/)
    expect(
      plan(
        project({
          "package.json": pkg(
            { next: "16" },
            { scripts: { build: "next build --webpack" } }
          ),
        })
      ).steps[2]
    ).toMatchObject({ status: "manual" })
  })

  it("sets up Nuxt in its configuration, or says how", () => {
    const root = project({
      "package.json": pkg({ nuxt: "4" }),
      "nuxt.config.ts": "export default defineNuxtConfig({})\n",
    })
    const adapter = plan(root).steps[1]!
    expect(adapter.status === "change" && adapter.changes[0]!.after).toBe(
      `import kirana from "@kirana-style/vite"\n\nexport default defineNuxtConfig({ css: ["@kirana-style/core/stylesheet.css"],\n  vite: { plugins: [kirana()] } })\n`
    )
    expect(statuses(root).stylesheet).toBe("done")
    const busy = project({
      "package.json": pkg({ nuxt: "4" }),
      "nuxt.config.ts": "export default defineNuxtConfig({ css: [] })\n",
    })
    expect(statuses(busy)).toMatchObject({
      adapter: "manual",
      stylesheet: "manual",
    })
    const odd = project({
      "package.json": pkg({ nuxt: "4" }),
      "nuxt.config.ts": "export default {}\n",
    })
    expect(statuses(odd).adapter).toBe("manual")
    expect(
      statuses(project({ "package.json": pkg({ nuxt: "4" }) })).adapter
    ).toBe("manual")
  })

  it("sets up SvelteKit's layout, creating it when there is none", () => {
    const layout = "src/routes/+layout.svelte"
    const withScript = project({
      "package.json": pkg({ "@sveltejs/kit": "2" }),
      "vite.config.ts": `import { sveltekit } from "@sveltejs/kit/vite"\nimport { defineConfig } from "vite"\n\nexport default defineConfig({ plugins: [sveltekit()] })\n`,
      [layout]: `<script lang="ts">\n  let { children } = $props()\n</script>\n`,
    })
    const files = (root: string) =>
      Object.fromEntries(
        plan(root)
          .steps.flatMap((step) =>
            step.status === "change" ? step.changes : []
          )
          .map((change) => [change.file, change.after])
      )
    expect(files(withScript)["vite.config.ts"]).toContain(
      "plugins: [kirana(), sveltekit()]"
    )
    expect(files(withScript)[layout]).toBe(
      `<script lang="ts">\n  import "@kirana-style/core/stylesheet.css"\n  let { children } = $props()\n</script>\n`
    )
    const markupOnly = project({
      "package.json": pkg({ "@sveltejs/kit": "2" }),
      [layout]: "<slot />\n",
    })
    expect(files(markupOnly)[layout]).toBe(
      `<script>\n  import "@kirana-style/core/stylesheet.css"\n</script>\n\n<slot />\n`
    )
    const none = project({ "package.json": pkg({ "@sveltejs/kit": "2" }) })
    expect(files(none)[layout]).toContain("{@render children()}")
    // A Vite project without a configuration gets one.
    expect(files(none)["vite.config.js"]).toContain("plugins: [kirana()]")
    const done = project({
      "package.json": pkg({ "@sveltejs/kit": "2" }),
      [layout]: `<script>import "@kirana-style/core/stylesheet.css"</script>`,
    })
    expect(statuses(done).stylesheet).toBe("done")
  })

  it("sets up Astro's integration and the layout's frontmatter", () => {
    const root = project({
      "package.json": pkg({ astro: "5" }),
      "astro.config.mjs": `import { defineConfig } from "astro/config"\n\nexport default defineConfig({})\n`,
      "src/layouts/Base.astro": "---\nconst a = 1\n---\n<html />\n",
      "src/layouts/notes.md": "",
    })
    const files = Object.fromEntries(
      plan(root)
        .steps.flatMap((step) => (step.status === "change" ? step.changes : []))
        .map((change) => [change.file, change.after])
    )
    expect(files["astro.config.mjs"]).toContain(
      "defineConfig({ integrations: [kirana()] })"
    )
    expect(files["src/layouts/Base.astro"]).toBe(
      `---\nimport "@kirana-style/core/stylesheet.css"\nconst a = 1\n---\n<html />\n`
    )
    const page = project({
      "package.json": pkg({ astro: "5" }),
      "src/pages/index.astro": "<html />\n",
      "astro.config.mjs": "export default {}\n",
    })
    const pageFiles = Object.fromEntries(
      plan(page)
        .steps.flatMap((step) => (step.status === "change" ? step.changes : []))
        .map((change) => [change.file, change.after])
    )
    expect(pageFiles["src/pages/index.astro"]).toBe(
      `---\nimport "@kirana-style/core/stylesheet.css"\n---\n\n<html />\n`
    )
    expect(statuses(page).adapter).toBe("manual")
    const imported = project({
      "package.json": pkg({ astro: "5" }),
      "src/pages/index.astro": `---\nimport "@kirana-style/core/stylesheet.css"\n---\n`,
    })
    expect(statuses(imported).stylesheet).toBe("done")
    expect(
      statuses(project({ "package.json": pkg({ astro: "5" }) }))
    ).toMatchObject({ adapter: "manual", stylesheet: "manual" })
  })

  it("sets up the other bundlers, or says how", () => {
    const rsbuild = project({
      "package.json": pkg({ react: "19", "@rsbuild/core": "1" }),
      "rsbuild.config.ts": `import { defineConfig } from "@rsbuild/core"\nexport default defineConfig({\n  plugins: [pluginReact()],\n})\n`,
      "src/index.tsx": "x()\n",
    })
    expect(statuses(rsbuild)).toMatchObject({
      adapter: "change",
      stylesheet: "change",
    })
    const webpack = project({
      "package.json": pkg({ webpack: "5" }),
      "webpack.config.js": "export default { plugins: [] }\n",
      "src/main.js": `import "@kirana-style/core/stylesheet.css"\n`,
    })
    expect(statuses(webpack)).toMatchObject({
      adapter: "change",
      stylesheet: "done",
    })
    const commonjs = project({
      "package.json": pkg({ "@rspack/core": "1" }),
      "rspack.config.js": "module.exports = { plugins: [] }\n",
    })
    expect(statuses(commonjs)).toMatchObject({
      adapter: "manual",
      stylesheet: "manual",
    })
    const noPlugins = project({
      "package.json": pkg({ webpack: "5" }),
      "webpack.config.mjs": "export default {}\n",
    })
    expect(statuses(noPlugins).adapter).toBe("manual")
    const rolldown = project({
      "package.json": pkg({ rolldown: "1" }),
      "rolldown.config.ts": "export default { plugins: [] }\n",
    })
    expect(statuses(rolldown)).toMatchObject({
      adapter: "change",
      stylesheet: "done",
    })
    const server = project({
      "package.json": pkg({ vite: "8" }),
      "vite.config.js": "export default defineConfig({ server: {} })\n",
    })
    const vite = plan(server).steps[1]!
    expect(vite.status === "change" && vite.changes[0]!.after).toContain(
      "defineConfig({\n  plugins: [kirana()], server: {} })"
    )
    const empty = project({
      "package.json": pkg({ next: "16" }),
      "app/globals.css": "\n",
    })
    const sheet = plan(empty).steps[2]!
    expect(sheet.status === "change" && sheet.changes[0]!.after).toBe(
      "@kirana;\n"
    )
    expect(
      statuses(project({ "package.json": pkg({ rolldown: "1" }) })).adapter
    ).toBe("manual")
    expect(
      statuses(project({ "package.json": pkg({ esbuild: "0" }) })).adapter
    ).toBe("manual")
    expect(
      statuses(
        project({ "package.json": pkg({}, { scripts: { b: "bun build x" } }) })
      ).adapter
    ).toBe("manual")
    expect(
      statuses(project({ "package.json": pkg({ "@rsbuild/core": "1" }) }))
        .adapter
    ).toBe("manual")
    expect(statuses(project({ "package.json": pkg({}) }))).toMatchObject({
      adapter: "done",
      stylesheet: "done",
    })
    expect(
      statuses(
        project({ "package.json": pkg({ "@tanstack/react-start": "1" }) })
      ).stylesheet
    ).toBe("manual")
  })

  it("keeps an existing configuration, and adds the preset only when asked", () => {
    const root = project({
      "package.json": pkg({}),
      "kirana.config.json": "{}",
    })
    expect(plan(root).steps[0]).toMatchObject({
      status: "done",
      detail: "kirana.config.json",
    })
    expect(plan(root, { preset: true }).steps[0]).toMatchObject({
      status: "manual",
    })
    const preset = project({
      "package.json": pkg({}),
      "kirana.config.mjs": `import scales from "@kirana-style/preset-scales/preset"\n`,
    })
    expect(statuses(preset, true).config).toBe("done")
    const fresh = project({
      "package.json": pkg({}, { type: "module" }),
      "tsconfig.json": "{}",
    })
    const config = plan(fresh, { preset: true })
    expect(
      config.steps[0]!.status === "change" && config.steps[0]!.changes[0]
    ).toMatchObject({
      file: "kirana.config.ts",
      after: expect.stringContaining("presets: [scales()]"),
    })
    expect(config.development).toContain("@kirana-style/preset-scales")
  })

  it("types sx where tsconfig.json sees it, once", () => {
    const typed = project({
      "package.json": pkg({ react: "19" }),
      "tsconfig.json": "{}",
      "src/env.d.ts": `/// <reference types="@kirana-style/core/react" />\n`,
    })
    expect(plan(typed).steps[3]).toMatchObject({
      status: "done",
      detail: "src/env.d.ts",
    })
    const untyped = project({
      "package.json": pkg({ react: "19" }),
      "tsconfig.json": "{}",
      "src/main.tsx": "",
    })
    expect(plan(untyped).steps[3]).toMatchObject({
      status: "change",
      detail: "create src/kirana.d.ts",
    })
    const root = project({
      "package.json": pkg({ react: "19" }),
      "tsconfig.json": "{}",
      "env.d.ts": `/// <reference types="@kirana-style/core/react" />\n`,
    })
    expect(plan(root).steps[3]).toMatchObject({
      status: "done",
      detail: "env.d.ts",
    })
    expect(
      plan(project({ "package.json": pkg({ react: "19" }) })).steps[3]
    ).toMatchObject({ status: "done", detail: "no tsconfig.json" })
    expect(
      plan(project({ "package.json": pkg({}), "tsconfig.json": "{}" }))
        .steps[3]!.detail
    ).toBe("no JSX: nothing to type")
  })
})

/** A terminal that answers `answer` and records commands. */
function io(
  answer = false,
  code = 0
): Io & { output: string; commands: string[] } {
  const session = {
    output: "",
    commands: [] as string[],
    write: (text: string) => void (session.output += text),
    ask: vi.fn(async () => answer),
    run: (command: string) => (session.commands.push(command), code),
  }
  return session
}

describe("KRN-DX-008 kirana init", () => {
  const VITE = {
    "package.json": pkg({ react: "19", vite: "8" }, { type: "module" }),
    "vite.config.ts": `import { defineConfig } from "vite"\n\nexport default defineConfig({ plugins: [] })\n`,
    "src/main.tsx": "render()\n",
  }

  it("shows the plan and the install command on a dry run, and writes nothing", async () => {
    const root = project(VITE)
    const session = io()
    expect(await runInit(["--dry-run"], root, session)).toBe(0)
    expect(session.output).toContain("React · vite · npm · JavaScript")
    expect(session.output).toContain("+++ kirana.config.mjs (new)")
    expect(session.output).toContain(
      "+ export default defineConfig({ plugins: [kirana()] })"
    )
    expect(session.output).toContain(
      "Dry run: nothing written.\n  npm install @kirana-style/core\n  npm install -D @kirana-style/compiler @kirana-style/vite"
    )
    expect(read(root, "vite.config.ts")).not.toContain("kirana")
  })

  it("writes after a yes, prints the install command, and is done the second time", async () => {
    const root = project(VITE)
    const declined = io(false)
    expect(await runInit([], root, declined)).toBe(1)
    expect(declined.output).toContain("Nothing written.")
    const accepted = io(true)
    expect(await runInit([], root, accepted)).toBe(0)
    expect(accepted.ask).toHaveBeenCalledWith("\nWrite 3 file(s)? [y/N] ")
    expect(accepted.output).toContain(
      "Wrote 3 file(s).\n\nInstall:\n  npm install @kirana-style/core\n"
    )
    expect(read(root, "src/main.tsx")).toBe(
      `import "@kirana-style/core/stylesheet.css"\nrender()\n`
    )
    writeFileSync(
      path.join(root, "package.json"),
      pkg({
        react: "19",
        vite: "8",
        "@kirana-style/core": "0",
        "@kirana-style/compiler": "0",
        "@kirana-style/vite": "0",
      })
    )
    const again = io()
    expect(await runInit(["--yes"], root, again)).toBe(0)
    expect(again.output).toContain("Already set up.")
    expect(again.ask).not.toHaveBeenCalled()
  })

  it("installs with --install, stopping at a failing command, and lists manual steps", async () => {
    const root = project({
      "package.json": pkg({ esbuild: "0" }),
      "kirana.config.json": "{}",
    })
    const session = io(false, 0)
    expect(await runInit(["-y", "--install"], root, session)).toBe(0)
    expect(session.commands).toEqual([
      "npm install @kirana-style/core",
      "npm install -D @kirana-style/compiler @kirana-style/esbuild",
    ])
    expect(session.output).toContain(
      "To do by hand:\n  adapter: add kirana() to esbuild's plugins"
    )
    expect(session.output).toContain("Then check the setup with: kirana doctor")
    const failing = io(false, 3)
    expect(await runInit(["--install"], root, failing)).toBe(3)
    expect(failing.commands).toHaveLength(1)
  })

  it("rejects unknown options and a directory that is not a project", async () => {
    const session = io()
    expect(
      await runInit(["--force"], project({ "package.json": "{}" }), session)
    ).toBe(2)
    expect(session.output).toContain("unknown option --force")
    expect(await runInit([], project({}), session)).toBe(2)
    expect(session.output).toContain("no package.json here")
  })

  it("describes projects in one line", () => {
    expect(
      describeProject(
        detect(project({ "package.json": pkg({}), "tsconfig.json": "{}" }))
      )
    ).toBe("No framework · no bundler · npm · TypeScript")
  })
})

describe("KRN-DX-008 kirana doctor", () => {
  const native = loadNative()

  it("passes a project that is set up, with its packages installed", async () => {
    const root = project({
      "package.json": pkg({
        "@kirana-style/core": "0",
        "@kirana-style/compiler": "0",
      }),
      "kirana.config.json": `{ "names": { "prefix": "q" }, "libraries": ["ui"] }`,
      "node_modules/@kirana-style/core/package.json": `{"name":"@kirana-style/core","version":"0.1.0"}`,
      "node_modules/@kirana-style/compiler/package.json": `{"name":"@kirana-style/compiler","version":"0.1.0"}`,
    })
    let output = ""
    expect(
      await runDoctor(
        [],
        root,
        (text) => (output += text),
        () => native
      )
    ).toBe(0)
    expect(output).toContain("✓ engine       native (")
    expect(output).toContain(
      "✓ packages     @kirana-style/compiler@0.1.0, @kirana-style/core@0.1.0"
    )
    expect(output).toContain(
      `✓ config       kirana.config.json, prefix "q", libraries ui`
    )
    expect(output).toContain("✓ adapter      no bundler")
    expect(output).toContain("✓ stylesheet   no bundler: link the file")
    expect(output).toContain("✓ cache        none on disk")
    expect(output).toContain("All good.")
  })

  it("reports what is missing, mismatched or broken, and exits with 1", async () => {
    const root = project({
      "package.json": pkg({
        react: "19",
        vite: "8",
        "@kirana-style/core": "0",
        "@kirana-style/vite": "0",
      }),
      "tsconfig.json": "{}",
      "kirana.config.json": `{ "names": 3 }`,
      "node_modules/@kirana-style/core/package.json": `{"name":"@kirana-style/core","version":"0.1.0"}`,
    })
    const checks = await diagnose(root, () => native)
    const by = Object.fromEntries(checks.map((check) => [check.name, check]))
    expect(by.packages).toMatchObject({
      status: "fail",
      detail: "listed but not installed: @kirana-style/vite",
    })
    expect(by.config!.status).toBe("fail")
    expect(by.adapter).toMatchObject({
      status: "fail",
      detail: "not set up: kirana init would create vite.config.ts",
    })
    expect(by.types!.status).toBe("warn")
    expect(by.dependencies).toMatchObject({
      status: "fail",
      detail: "not in package.json: @kirana-style/compiler",
    })
    let output = ""
    expect(
      await runDoctor(
        ["--json"],
        root,
        (text) => (output += text),
        () => native
      )
    ).toBe(1)
    expect(JSON.parse(output)).toEqual(checks)
  })

  it("warns when installed versions differ, and fails without packages or an engine", async () => {
    const root = project({
      "package.json": pkg({
        "@kirana-style/core": "0",
        "@kirana-style/compiler": "0",
      }),
      "node_modules/@kirana-style/core/package.json": `{"version":"0.1.0"}`,
      "node_modules/@kirana-style/compiler/package.json": `{"version":"0.2.0"}`,
      "kirana.config.json": "{}",
    })
    expect(installedVersions(root)).toEqual({
      "@kirana-style/compiler": "0.2.0",
      "@kirana-style/core": "0.1.0",
    })
    const checks = await diagnose(root, () => native)
    expect(checks.find((check) => check.name === "packages")).toMatchObject({
      status: "warn",
    })
    expect(checks.find((check) => check.name === "config")!.detail).toBe(
      `kirana.config.json, prefix "k"`
    )
    const broken = await diagnose(project({ "package.json": "{}" }), () => {
      throw new Error("no engine for this machine")
    })
    expect(broken[0]).toEqual({
      name: "engine",
      status: "fail",
      detail: "no engine for this machine",
    })
    expect(broken.find((check) => check.name === "packages")!.detail).toBe(
      "no @kirana-style/* package in package.json"
    )
    expect(broken.some((check) => check.name === "config")).toBe(false)
    const wasi = await diagnose(
      root,
      () => ({ ...native, __napiBindingTarget: "wasm32-wasi" }) as typeof native
    )
    expect(wasi[0]!.detail).toContain("WebAssembly")
    let output = ""
    expect(
      await runDoctor(
        [],
        project({ "package.json": "{}" }),
        (text) => (output += text),
        () => native
      )
    ).toBe(1)
    expect(output).toMatch(
      /\d problem\(s\)\. kirana init sets up what it can\.\n$/
    )
  })
})

describe("KRN-DX-008 kirana dev", () => {
  const STYLE = (colour: string) =>
    `import { css } from "@kirana-style/core"\nexport const a = css({ color: "${colour}" })\n`

  it("writes the stylesheet, then rewrites it as files change, appear and go", async () => {
    const root = project({
      "package.json": "{}",
      "src/a.ts": STYLE("rgb(1, 2, 3)"),
      "src/types.d.ts": "",
    })
    const listeners: ((name: string) => void)[] = []
    const closed = vi.fn()
    let output = ""
    const session = await runDev(
      ["--out", "out/k.css"],
      root,
      (text) => (output += text),
      {
        watch: (_, listener) => (listeners.push(listener), { close: closed }),
        delay: 5,
      }
    )
    expect(session.code).toBe(0)
    expect(read(root, "out/k.css")).toContain("rgb(1, 2, 3)")
    expect(output).toMatch(
      /✓ out\/k\.css \(\d+ bytes, 1 file\(s\), \d+ ms\)\nwatching src\n/
    )
    writeFileSync(
      path.join(root, "src/a.ts"),
      STYLE("rgb(4, 5, 6)").replace("})", ", width: 5 })")
    )
    listeners[0]!("a.ts")
    listeners[0]!("types.d.ts")
    listeners[0]!("node_modules/x/index.js")
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(output).toContain("error[KRN1203] unitless-length")
    expect(output).toContain("(src/a.ts:2:")
    expect(read(root, "out/k.css")).toContain("rgb(4, 5, 6)")
    // Nothing pending: nothing happens.
    session.flush()
    rmSync(path.join(root, "src/a.ts"))
    listeners[0]!("a.ts")
    session.flush()
    expect(read(root, "out/k.css")).not.toContain("rgb(4, 5, 6)")
    // An edit that does not change the stylesheet does not rewrite it.
    const before = output
    writeFileSync(path.join(root, "src/b.ts"), "export const b = 1\n")
    listeners[0]!("b.ts")
    session.flush()
    expect(output).toBe(before)
    session.close()
    expect(closed).toHaveBeenCalled()
  })

  it("compiles the root without src, minifies when asked, and rejects bad arguments", async () => {
    const root = project({
      "package.json": "{}",
      "a.ts": STYLE("red"),
      "b.tsx": `import { relation } from "@kirana-style/core"\nconst card = relation("card")\nexport const B = () => <div sx={card.anchor} />\n`,
    })
    let printed = ""
    const write = (text: string) => void (printed += text)
    const session = await runDev(["--minify"], root, write, {
      watch: () => ({ close() {} }),
    })
    expect(read(root, "kirana.css")).toContain("color:red")
    // Project-wide diagnostics are printed too.
    expect(printed).toContain("relation-unused")
    session.close()
    let output = ""
    const log = (text: string) => void (output += text)
    expect((await runDev(["--out"], root, log)).code).toBe(2)
    expect((await runDev(["--wat"], root, log)).code).toBe(2)
    expect((await runDev(["missing"], root, log)).code).toBe(2)
    expect(output).toBe(
      "--out needs a file\nunknown option --wat\nusage: kirana dev [paths] [--out <file>] [--minify]\nmissing does not exist\n"
    )
    const idle = await runDev(["--wat"], root, log)
    idle.flush()
    idle.close()
  })

  it("watches the file system by default", async () => {
    const root = project({
      "package.json": "{}",
      "src/a.ts": STYLE("rgb(1, 2, 3)"),
    })
    const session = await runDev([], root, () => {})
    writeFileSync(path.join(root, "src/a.ts"), STYLE("rgb(7, 8, 9)"))
    await vi.waitFor(
      () => expect(read(root, "kirana.css")).toContain("rgb(7, 8, 9)"),
      { timeout: 3000 }
    )
    session.close()
  })

  it("D-069 writes the class map and watches its modules wherever they are", async () => {
    const root = project({
      "package.json": "{}",
      "kirana.config.json": JSON.stringify({
        classes: {
          modules: ["styles", "src/page.styles.ts", "gone.ts"],
          out: "public/classes.json",
        },
      }),
      "src/page.styles.ts": `import { css, recipe } from "@kirana-style/core"\nexport const page = css({ color: "red" })\nexport const pick = recipe({ base: { color: "red" }, variants: {} })\nexport const bad = css({ width: 5 })\n`,
      "styles/app.styles.ts": `import { css, recipe } from "@kirana-style/core"\nexport const card = css({ color: "blue" })\nexport const many = [css({ color: "green" })]\n`,
    })
    const watched: string[] = []
    const listeners: ((name: string) => void)[] = []
    let output = ""
    const session = await runDev(["src"], root, (text) => (output += text), {
      watch: (directory, listener) => (
        watched.push(directory),
        listeners.push(listener),
        { close() {} }
      ),
    })
    expect(watched).toEqual([path.join(root, "src"), path.join(root, "styles")])
    const map = JSON.parse(read(root, "public/classes.json")) as {
      classes: Record<string, string>
    }
    expect(Object.keys(map.classes)).toEqual(["bad", "card", "page"])
    expect(read(root, "kirana.css")).toContain("blue")
    // Each module's diagnostic once, with its source line: a module both under `src` and in the
    // class map reports its own errors once too.
    expect(output.match(/classes-not-static/g)).toHaveLength(2)
    expect(output.match(/unitless-length/g)).toHaveLength(1)
    expect(output).toContain("✓ public/classes.json")
    // An edit outside `src` rewrites both files; one that changes neither prints nothing.
    writeFileSync(
      path.join(root, "styles/app.styles.ts"),
      `import { css } from "@kirana-style/core"\nexport const card = css({ color: "teal" })\n`
    )
    listeners[1]!("app.styles.ts")
    session.flush()
    expect(read(root, "public/classes.json")).toContain("card")
    expect(read(root, "kirana.css")).toContain("teal")
    const before = output
    listeners[1]!("app.styles.ts")
    session.flush()
    expect(output.replace(before, "")).not.toContain("✓")
    session.close()
  })

  it("knows which changes are scripts it compiles", () => {
    expect(compiled("a.tsx")).toBe(true)
    expect(compiled("a.d.ts")).toBe(false)
    expect(compiled("a.css")).toBe(false)
    expect(compiled(".git/a.js")).toBe(false)
    expect(compiled("dist/a.js")).toBe(false)
  })
})

describe("KRN-DX-008 the kirana command", () => {
  it("runs init, doctor and dev without a configuration", async () => {
    const root = project({ "package.json": pkg({}), "a.ts": "" })
    let output = ""
    const write = (text: string) => void (output += text)
    const answers = { ask: async () => false, run: () => 0 }
    expect(
      await main(["init", "--dry-run"], root, write, undefined, answers)
    ).toBe(0)
    expect(output).toContain("Dry run")
    // Without a terminal given, the process's own, which a dry run never asks.
    expect(await main(["init", "--dry-run"], root, write)).toBe(0)
    expect(await main(["doctor", "--json"], root, write, loadNative())).toBe(1)
    expect(await main(["doctor", "--json"], root, () => {})).toBe(1)
    expect(await main(["dev", "--wat"], root, write)).toBe(2)
  })

  it("asks a terminal, and only a terminal", async () => {
    let output = ""
    const write = (text: string) => void (output += text)
    const piped = terminal(new PassThrough(), new PassThrough(), write)
    expect(await piped.ask("Write? ")).toBe(false)
    expect(output).toContain("not a terminal: pass --yes")
    for (const [answer, expected] of [
      ["y", true],
      ["no", false],
    ] as const) {
      const input = Object.assign(new PassThrough(), { isTTY: true })
      const asked = terminal(input, new PassThrough(), write).ask("Write? ")
      input.end(`${answer}\n`)
      expect(await asked).toBe(expected)
    }
    expect(piped.run("exit 0")).toBe(0)
    expect(piped.run("exit 4")).toBe(4)
    // Killed by a signal: no exit status, so a failure.
    expect(piped.run("kill -9 $$")).toBe(1)
  })
})

describe("D-067, D-068 Qwik and Angular", () => {
  const files = (root: string) =>
    Object.fromEntries(
      plan(root)
        .steps.flatMap((step) => (step.status === "change" ? step.changes : []))
        .map((change) => [change.file, change.after])
    )

  it("detects Qwik on Vite, and Angular on Analog or its CLI", () => {
    const qwik = detect(
      project({ "package.json": pkg({ "@qwik.dev/core": "2" }) })
    )
    expect(qwik).toMatchObject({ framework: "qwik", bundler: "vite" })
    expect(typesOf("qwik")).toBe("@kirana-style/core/qwik")
    expect(runtimeOf(qwik)).toEqual(["@kirana-style/core"])
    const analog = detect(
      project({
        "package.json": pkg({
          "@angular/core": "22",
          "@analogjs/platform": "2",
        }),
      })
    )
    expect(analog).toMatchObject({ framework: "angular", bundler: "vite" })
    expect(adapterOf(analog)).toEqual(["@kirana-style/vite"])
    const cli = detect(
      project({ "package.json": pkg({ "@angular/core": "22" }) })
    )
    expect(cli).toMatchObject({ framework: "angular", bundler: "angular-cli" })
    expect(adapterOf(cli)).toEqual([])
    expect(runtimeOf(cli)).toEqual([
      "@kirana-style/core",
      "@kirana-style/angular",
    ])
    expect(typesOf("angular")).toBeUndefined()
    expect(describeProject(cli)).toBe(
      "Angular · angular-cli · npm · JavaScript"
    )
  })

  it("inserts last in a list, keeping its layout", () => {
    const plugins = /plugins:\s*\[/
    expect(insertLast("plugins: [a()]", plugins, "k()")).toBe(
      "plugins: [a(), k()]"
    )
    expect(insertLast("plugins: [a(),]", plugins, "k()")).toBe(
      "plugins: [a(), k()]"
    )
    expect(insertLast("plugins: [ ]", plugins, "k()")).toBe("plugins: [k()]")
    expect(
      insertLast("plugins: [\n    a({ x: [1] }),\n  ]", plugins, "k()")
    ).toBe("plugins: [\n    a({ x: [1] }),\n    k(),\n  ]")
    expect(insertLast('plugins: [\n    a("]")\n  ]', plugins, "k()")).toBe(
      'plugins: [\n    a("]"),\n    k(),\n  ]'
    )
    expect(insertLast("plugins: [a('open", plugins, "k()")).toBeUndefined()
    expect(insertLast("nothing", plugins, "k()")).toBeUndefined()
  })

  it("sets Qwik up: the plugin first, the stylesheet in the root or the entry", () => {
    const router = project({
      "package.json": pkg({ "@qwik.dev/core": "2" }),
      "vite.config.ts":
        "export default defineConfig({ plugins: [qwikVite()] })\n",
      "src/root.tsx": "export default 1\n",
    })
    expect(files(router)["vite.config.ts"]).toContain(
      "plugins: [kirana(), qwikVite()]"
    )
    expect(files(router)["src/root.tsx"]).toMatch(
      /^import "@kirana-style\/core\/stylesheet.css"/
    )
    const csr = project({
      "package.json": pkg({ "@qwik.dev/core": "2" }),
      "src/main.tsx": "render()\n",
    })
    expect(files(csr)["src/main.tsx"]).toMatch(
      /^import "@kirana-style\/core\/stylesheet.css"/
    )
    expect(
      statuses(project({ "package.json": pkg({ "@qwik.dev/core": "2" }) }))
        .stylesheet
    ).toBe("manual")
  })

  it("sets Analog up: kiranaAngular() after analog(), the stylesheet in main.ts", () => {
    const root = project({
      "package.json": pkg({ "@angular/core": "22", "@analogjs/platform": "2" }),
      "vite.config.ts":
        "export default defineConfig({ plugins: [analog()] })\n",
      "src/main.ts": "bootstrap()\n",
      "src/app/a.ts": "import { SxDirective } from '@kirana-style/angular'\n",
    })
    expect(files(root)["vite.config.ts"]).toContain(
      "plugins: [analog(), kiranaAngular()]"
    )
    expect(files(root)["src/main.ts"]).toMatch(
      /^import "@kirana-style\/core\/stylesheet.css"/
    )
    expect(plan(root).steps[3]).toMatchObject({
      status: "done",
      detail: "SxDirective types [sx]",
    })
    expect(plan(root).dependencies).toEqual([
      "@kirana-style/core",
      "@kirana-style/angular",
    ])
    const noPlugins = project({
      "package.json": pkg({ "@angular/core": "22", "@analogjs/platform": "2" }),
      "vite.config.ts": "export default {}\n",
    })
    expect(statuses(noPlugins)).toMatchObject({
      adapter: "manual",
      types: "manual",
    })
  })

  it("sets the Angular CLI up: Kirana's builders, .kirana/ ignored, or the step by hand", () => {
    const angularJson = JSON.stringify({
      projects: {
        app: {
          architect: {
            build: { builder: "@angular-devkit/build-angular:application" },
            serve: { builder: "@angular/build:dev-server" },
          },
        },
      },
    })
    const root = project({
      "package.json": pkg({ "@angular/core": "22" }),
      "angular.json": angularJson,
      ".gitignore": "dist\n",
      "src/app.ts": "",
    })
    const written = files(root)
    expect(written["angular.json"]).toContain(
      '"@kirana-style/angular:application"'
    )
    expect(written["angular.json"]).toContain(
      '"@kirana-style/angular:dev-server"'
    )
    expect(written[".gitignore"]).toBe(
      "dist\n# Kirana's compiled sources (@kirana-style/angular)\n.kirana/\n"
    )
    expect(statuses(root)).toMatchObject({
      stylesheet: "done",
      types: "manual",
    })
    // Already ignored: only angular.json changes.
    const ignored = project({
      "package.json": pkg({ "@angular/core": "22" }),
      "angular.json": angularJson,
      ".gitignore": ".kirana/\n",
    })
    expect(Object.keys(files(ignored))).toEqual([
      "kirana.config.mjs",
      "angular.json",
    ])
    // No .gitignore yet: one is created.
    const fresh = project({
      "package.json": pkg({ "@angular/core": "22" }),
      "angular.json": angularJson,
    })
    expect(files(fresh)[".gitignore"]).toBe(
      "# Kirana's compiled sources (@kirana-style/angular)\n.kirana/\n"
    )
    const done = project({
      "package.json": pkg({ "@angular/core": "22" }),
      "angular.json": '{"b":"@kirana-style/angular:application"}',
    })
    expect(plan(done).steps[1]).toMatchObject({
      status: "done",
      detail: "angular.json",
    })
    const custom = project({
      "package.json": pkg({ "@angular/core": "22" }),
      "angular.json": '{"b":"custom:builder"}',
    })
    expect(plan(custom).steps[1]!.detail).toMatch(/^angular\.json: use/)
    expect(
      statuses(project({ "package.json": pkg({ "@angular/core": "22" }) }))
        .adapter
    ).toBe("manual")
  })
})

describe("D-069 to D-072: the frameworks Tailwind has a guide for", () => {
  const files = (root: string) =>
    Object.fromEntries(
      plan(root)
        .steps.flatMap((step) => (step.status === "change" ? step.changes : []))
        .map((change) => [change.file, change.after])
    )
  const steps = (root: string) =>
    Object.fromEntries(plan(root).steps.map((step) => [step.name, step]))

  it("detects server frameworks by their own manifest, before their JavaScript", () => {
    const cases: [Record<string, string>, string][] = [
      [
        {
          "composer.json": '{"require":{"laravel/framework":"^13"}}',
          "package.json": pkg({ react: "19", vite: "8" }),
        },
        "laravel",
      ],
      [
        { "composer.json": '{"require":{"symfony/framework-bundle":"8.1.*"}}' },
        "symfony",
      ],
      [
        { Gemfile: 'source "https://rubygems.org"\ngem "rails", "~> 8.1"\n' },
        "rails",
      ],
      [{ Gemfile: "gem 'railties'\n" }, "rails"],
      [{ "mix.exs": '[{:phoenix, "~> 1.8"}]' }, "phoenix"],
      [{ "package.json": pkg({ "@adonisjs/core": "7" }) }, "adonisjs"],
    ]
    for (const [manifest, framework] of cases) {
      const found = detect(project(manifest))
      expect(found).toMatchObject({ framework, bundler: "cli" })
      expect(adapterOf(found)).toEqual([])
      expect(typesOf(found.framework)).toBeUndefined()
    }
    expect(runtimeOf(detect(project(cases[5]![0])))).toEqual([
      "@kirana-style/core",
      "@kirana-style/adonis",
    ])
    expect(
      detect(
        project({
          "composer.json": '{"require":{}}',
          Gemfile: "gem 'sinatra'\n",
        })
      ).framework
    ).toBe("vanilla")
  })

  it("detects the JavaScript frameworks and Parcel", () => {
    const of = (manifest: Record<string, string>) => detect(project(manifest))
    expect(
      of({ "package.json": pkg({ "@react-router/dev": "8", react: "19" }) })
    ).toMatchObject({ framework: "react-router", bundler: "vite" })
    expect(
      of({ "package.json": pkg({ gatsby: "5", react: "19" }) })
    ).toMatchObject({ framework: "gatsby", bundler: "webpack" })
    expect(of({ "package.json": pkg({ "ember-source": "7" }) })).toMatchObject({
      framework: "ember",
      bundler: "vite",
    })
    expect(
      of({
        "package.json": pkg({ react: "19" }),
        ".meteor/release": "METEOR@3.5.2\n",
      })
    ).toMatchObject({ framework: "meteor", bundler: "rspack" })
    const parcel = of({ "package.json": pkg({ react: "19", parcel: "2" }) })
    expect(parcel).toMatchObject({ framework: "react", bundler: "parcel" })
    expect(adapterOf(parcel)).toEqual([
      "@kirana-style/parcel-transformer",
      "@kirana-style/postcss",
      "postcss",
    ])
    expect(adapterOf(of({ "package.json": pkg({ gatsby: "5" }) }))).toEqual([
      "@kirana-style/gatsby",
    ])
    expect(
      runtimeOf(of({ "package.json": pkg({ "ember-source": "7" }) }))
    ).toEqual(["@kirana-style/core", "@kirana-style/ember"])
    expect(typesOf("react-router")).toBe("@kirana-style/core/react")
    expect(typesOf("ember")).toBeUndefined()
    expect(describeProject(parcel)).toBe("React · parcel · npm · JavaScript")
  })

  it("sets a server framework up with a class map and a starter style module", () => {
    const laravel = project({
      "composer.json": '{"require":{"laravel/framework":"^13"}}',
    })
    const written = files(laravel)
    expect(written["kirana.config.mjs"]).toContain(
      'classes: { modules: ["resources/styles"], out: "public/kirana/classes.json" },'
    )
    expect(written["resources/styles/app.styles.ts"]).toContain(
      "export const card"
    )
    const all = steps(laravel)
    expect(all.adapter!.status).toBe("done")
    expect(all.stylesheet).toMatchObject({
      status: "manual",
      detail: expect.stringContaining(
        "composer require kirana-style/kirana; run kirana dev resources/styles --out public/kirana-style/kirana.css"
      ),
    })
    expect(all.types).toMatchObject({
      status: "done",
      detail: "templates name styles through the class map",
    })
    // Phoenix serves priv/static, and has no package manager command for its helper.
    const phoenix = project({
      "mix.exs": "{:phoenix, ",
      "resources/styles/a.ts": "",
    })
    expect(files(phoenix)["kirana.config.mjs"]).toContain(
      'out: "priv/static/kirana/classes.json"'
    )
    expect(files(phoenix)["resources/styles/app.styles.ts"]).toBeUndefined()
    expect(steps(phoenix).stylesheet!.detail).toContain("import Kirana")
    expect(steps(project({ "mix.exs": "{:phoenix, " })).adapter!.status).toBe(
      "done"
    )
    expect(steps(project({ Gemfile: "gem 'rails'\n" })).adapter!.status).toBe(
      "done"
    )
    // AdonisJS's stylesheet step names no helper: its runtime is an npm package.
    expect(
      steps(project({ "package.json": pkg({ "@adonisjs/core": "7" }) }))
        .stylesheet!.detail
    ).toMatch(/^run kirana dev/)
    // An existing configuration without a class map is the user's to edit.
    const existing = project({
      "composer.json": '{"require":{"laravel/framework":"^13"}}',
      "kirana.config.json": "{}",
    })
    expect(steps(existing).config!.status).toBe("manual")
    const ready = project({
      "composer.json": '{"require":{"laravel/framework":"^13"}}',
      "kirana.config.json": '{"classes":{}}',
    })
    expect(steps(ready).config!.status).toBe("done")
  })

  it("registers the AdonisJS provider and the Symfony Twig extension", () => {
    const adonis = project({
      "package.json": pkg({ "@adonisjs/core": "7" }),
      "adonisrc.ts":
        "export default defineConfig({ providers: [() => import('@adonisjs/core/providers/app_provider')] })\n",
    })
    expect(files(adonis)["adonisrc.ts"]).toContain(
      `() => import("@kirana-style/adonis/provider")`
    )
    expect(
      steps(
        project({
          "package.json": pkg({ "@adonisjs/core": "7" }),
          "adonisrc.ts": "export default {}\n",
        })
      ).adapter!.status
    ).toBe("manual")
    const symfony = project({
      "composer.json": '{"require":{"symfony/framework-bundle":"8.1.*"}}',
      "config/services.yaml":
        "services:\n    _defaults:\n        autowire: true\n",
    })
    expect(files(symfony)["config/services.yaml"]).toContain(
      "    Kirana\\Twig\\KiranaExtension:\n        arguments: ['%kernel.project_dir%/public/kirana/classes.json']\n"
    )
    expect(
      steps(
        project({
          "composer.json": '{"require":{"symfony/framework-bundle":"8"}}',
          "config/services.yaml": "parameters: {}\n",
        })
      ).adapter!.status
    ).toBe("manual")
  })

  it("sets React Router, Gatsby, Ember, Meteor and Parcel up", () => {
    const router = project({
      "package.json": pkg({ "@react-router/dev": "8", react: "19", vite: "8" }),
      "vite.config.ts":
        "export default defineConfig({ plugins: [reactRouter()] })\n",
      "app/root.tsx": "export default 1\n",
    })
    expect(files(router)["app/root.tsx"]).toMatch(
      /^import "@kirana-style\/core\/stylesheet.css"/
    )
    expect(files(router)["vite.config.ts"]).toContain(
      "plugins: [kirana(), reactRouter()]"
    )

    const gatsby = project({
      "package.json": pkg({ gatsby: "5" }),
      "gatsby-config.js": 'module.exports = { plugins: ["gatsby-plugin-a"] }\n',
      "gatsby-browser.js": "export {}\n",
    })
    expect(files(gatsby)["gatsby-config.js"]).toContain(
      'plugins: ["@kirana-style/gatsby", "gatsby-plugin-a"]'
    )
    expect(files(gatsby)["gatsby-browser.js"]).toMatch(
      /^import "@kirana-style\/core\/stylesheet.css"/
    )
    const bare = files(project({ "package.json": pkg({ gatsby: "5" }) }))
    expect(bare["gatsby-config.js"]).toContain(
      'plugins: ["@kirana-style/gatsby"]'
    )
    expect(bare["gatsby-browser.js"]).toBe(
      'import "@kirana-style/core/stylesheet.css"\n'
    )

    const ember = project({
      "package.json": pkg({ "ember-source": "7" }),
      "vite.config.mjs":
        "export default defineConfig({ plugins: [ember()] })\n",
      "app/app.js": "export default 1\n",
    })
    expect(files(ember)["vite.config.mjs"]).toContain(
      "plugins: [ember(), kiranaEmber()]"
    )
    expect(files(ember)["vite.config.mjs"]).toContain(
      'import { kiranaEmber } from "@kirana-style/ember/vite"'
    )
    expect(files(ember)["app/app.js"]).toMatch(
      /^import "@kirana-style\/core\/stylesheet.css"/
    )
    expect(steps(ember).types!.status).toBe("done")
    expect(
      steps(project({ "package.json": pkg({ "ember-source": "7" }) })).adapter!
        .status
    ).toBe("manual")

    const meteor = project({
      "package.json": pkg({ react: "19" }),
      ".meteor/release": "METEOR@3.5\n",
      "rspack.config.js": "module.exports = defineConfig(() => ({}))\n",
      "client/main.jsx": "render()\n",
    })
    expect(files(meteor)["kirana.config.mjs"]).toContain(
      'externals: ["meteor/"],'
    )
    expect(steps(meteor).adapter).toMatchObject({
      status: "manual",
      detail: expect.stringContaining("new KiranaPlugin()"),
    })
    expect(files(meteor)["client/main.jsx"]).toMatch(
      /^import "@kirana-style\/core\/stylesheet.css"/
    )
    expect(
      steps(
        project({
          "package.json": pkg({ react: "19" }),
          ".meteor/release": "M\n",
          "kirana.config.json": "{}",
        })
      ).config!.status
    ).toBe("manual")
    expect(
      steps(
        project({
          "package.json": pkg({ react: "19" }),
          ".meteor/release": "M\n",
          "kirana.config.json": '{"externals":[]}',
        })
      ).config!.status
    ).toBe("done")

    const parcel = project({
      "package.json": pkg({ react: "19", parcel: "2" }),
    })
    expect(files(parcel)[".parcelrc"]).toContain(
      '["@kirana-style/parcel-transformer", "..."]'
    )
    expect(files(parcel)[".postcssrc"]).toContain('"@kirana-style/postcss": {}')
    expect(steps(parcel).stylesheet!.status).toBe("manual")
    const configured = project({
      "package.json": pkg({ react: "19", parcel: "2" }),
      ".parcelrc": "{}",
      ".postcssrc": "{}",
    })
    expect(steps(configured).adapter!.status).toBe("manual")
  })

  it("runs in a server framework's root before it has a package.json", async () => {
    const root = project({ Gemfile: "gem 'rails'\n" })
    const session = io()
    expect(await runInit(["--dry-run"], root, session)).toBe(0)
    expect(session.output).toContain("Ruby on Rails · cli · npm · JavaScript")
    expect(session.output).toContain("npm install -D @kirana-style/compiler")
  })
})
