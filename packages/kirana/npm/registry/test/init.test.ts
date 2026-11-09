import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, describe, expect, it } from "vite-plus/test"

import { hashOf } from "../src/check.ts"
import { main } from "../src/index.ts"
import { readLockfile } from "../src/lockfile.ts"
import { version } from "../src/version.ts"
import type { Item, RegistryFile, Setup } from "../src/types.ts"

const root = mkdtempSync(path.join(tmpdir(), "kirana-registry-init-"))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const file = (
  where: string,
  type: RegistryFile["type"],
  content: string
): RegistryFile => ({ path: where, type, content, hash: hashOf(content) })

const SETUP: Setup = {
  config: { module: "@/registry/lib/kit/config", export: "kitConfig" },
  stylesheets: ["@/registry/ui/reset.css"],
  document: { module: "@/registry/lib/kit/document", export: "htmlStyles" },
}

/** A design system with its wiring, and the components a registry lists beside it. */
const kit = (setup: Setup | null = SETUP): Item => ({
  name: "kit",
  type: "design-system",
  version: "1.0.0",
  dependencies: { "@kirana-style/core": "0.3.2" },
  files: [
    file("kit/config.ts", "lib", "export const kitConfig = {}\n"),
    file("kit/document.ts", "lib", "export const htmlStyles = []\n"),
    file("reset.css", "ui", "@layer reset {}\n"),
  ],
  ...(setup === null ? {} : { setup }),
})
const INDEX = {
  items: [
    { name: "button", type: "component", version: "1.0.0" },
    { name: "kit", type: "design-system", version: "1.0.0" },
  ],
}

const VITE_TSCONFIG = JSON.stringify({
  files: [],
  references: [
    { path: "./tsconfig.app.json" },
    { path: "./tsconfig.node.json" },
  ],
})
const APP_TSCONFIG = `{
  "compilerOptions": {
    /* Bundler mode */
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
`

/** A Vite + React app as its template writes it, with a registry `@acme` on disk. */
function vite(extra: Record<string, string> = {}, design: Item = kit()) {
  return project(viteFiles(extra, design))
}

/** The files of `vite`'s app. */
function viteFiles(
  extra: Record<string, string> = {},
  design: Item = kit()
): Record<string, string> {
  return {
    "package.json": JSON.stringify({
      type: "module",
      dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
      devDependencies: { vite: "^8.0.0", "@vitejs/plugin-react": "^6.0.0" },
    }),
    "vite.config.ts":
      "import react from '@vitejs/plugin-react'\nimport { defineConfig } from 'vite'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n",
    "tsconfig.json": VITE_TSCONFIG,
    "tsconfig.app.json": APP_TSCONFIG,
    "tsconfig.node.json":
      '{ "compilerOptions": {}, "include": ["vite.config.ts"] }',
    "index.html":
      '<!doctype html>\n<html lang="en"><body><div id="root"></div></body></html>\n',
    "src/main.tsx":
      "import { StrictMode } from 'react'\nimport { createRoot } from 'react-dom/client'\nimport App from './App.tsx'\n\ncreateRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)\n",
    "src/App.tsx": "export default function App() {\n  return null\n}\n",
    "acme/kit.json": JSON.stringify(design),
    "acme/index.json": JSON.stringify(INDEX),
    ...extra,
  }
}

/**
 * A Turborepo as shadcn/ui's monorepo template lays it out: `vite`'s app in `apps/web`, a
 * `packages/ui` package named `@workspace/ui` holding the registry `@acme`, the workspaces listed at
 * the root. `app` and `ui` add or leave out files of each.
 */
function turborepo(
  app: Record<string, string | undefined> = {},
  ui: Record<string, string | undefined> = {}
): { top: string; app: string; ui: string } {
  const {
    "acme/kit.json": design,
    "acme/index.json": index,
    ...web
  } = viteFiles()
  const top = project({
    "package.json": JSON.stringify({
      private: true,
      workspaces: ["apps/*", "packages/*"],
    }),
    ...Object.fromEntries(
      Object.entries({ ...web, ...app }).map(([name, text]) => [
        `apps/web/${name}`,
        text,
      ])
    ),
    ...Object.fromEntries(
      Object.entries({
        "package.json": JSON.stringify({
          name: "@workspace/ui",
          type: "module",
          dependencies: { react: "^19.0.0" },
        }),
        "acme/kit.json": design,
        "acme/index.json": index,
        ...ui,
      }).map(([name, text]) => [`packages/ui/${name}`, text])
    ),
  })
  return {
    top,
    app: path.join(top, "apps/web"),
    ui: path.join(top, "packages/ui"),
  }
}

/** A Next.js app: its layout renders `<html>`, and its tsconfig maps `@/*`. */
function next(extra: Record<string, string> = {}) {
  return project({
    "package.json": JSON.stringify({
      dependencies: {
        next: "^16.0.0",
        react: "^19.0.0",
        "react-dom": "^19.0.0",
      },
    }),
    "tsconfig.json": '{ "compilerOptions": { "paths": { "@/*": ["./*"] } } }',
    "app/layout.tsx":
      'import "./globals.css"\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  )\n}\n',
    "app/globals.css": "",
    "acme/kit.json": JSON.stringify(kit()),
    "acme/index.json": JSON.stringify(INDEX),
    ...extra,
  })
}

/** Links the workspace's `@kirana-style/core`, as an install would, for a configuration that imports it. */
function withCore(directory: string): string {
  mkdirSync(path.join(directory, "node_modules/@kirana-style"), {
    recursive: true,
  })
  symlinkSync(
    path.resolve(import.meta.dirname, "../../core"),
    path.join(directory, "node_modules/@kirana-style/core"),
    "dir"
  )
  return directory
}

/** A project with these files; one given as undefined is left out of a fixture that has it. */
function project(files: Record<string, string | undefined>): string {
  const directory = mkdtempSync(path.join(root, "project-"))
  for (const [name, text] of Object.entries(files)) {
    if (text === undefined) continue
    mkdirSync(path.dirname(path.join(directory, name)), { recursive: true })
    writeFileSync(path.join(directory, name), text)
  }
  return directory
}

const ACME = "@acme=acme/{name}.json"

/** Node's own `import()`: the compiler's default loader needs a runtime that vitest's isolation hides. */
const load = (url: string) => import(url)

async function init(cwd: string, ...argv: string[]) {
  let text = ""
  const commands: string[] = []
  // The fixtures install nothing, so Kirana's check could not load their configuration; one test
  // below runs it on a project that has Kirana's core.
  const code = await main(
    ["init", "--no-check", ...argv],
    cwd,
    (chunk) => void (text += chunk),
    { run: (command) => (commands.push(command), 0), load }
  )
  return { code, text, commands }
}

const read = (cwd: string, name: string) =>
  readFileSync(path.join(cwd, name), "utf8")

describe("KRN-DX-029 kirana-style ui init", () => {
  it("installs the registry only where the project lacks it (KF-035)", async () => {
    const release = await version()
    const cwd = next({
      "package.json": JSON.stringify({
        dependencies: {
          next: "^16.0.0",
          react: "^19.0.0",
          "react-dom": "^19.0.0",
        },
        devDependencies: { "@kirana-style/registry": release },
      }),
    })
    const { code, text } = await init(cwd, "--registry", ACME, "--dry-run")
    expect(code).toBe(0)
    // Kirana's packages exactly at this release; Next.js's PostCSS as any other package.
    expect(text).toContain(
      `packages: npm install --save-exact -D kirana-style@${release} @kirana-style/next@${release} @kirana-style/postcss@${release}\npackages: npm install -D postcss\n`
    )
    expect(text).not.toContain("@kirana-style/registry@")
  })

  it("sets a Vite app up: Kirana, the aliases, the settings, the design system and its wiring", async () => {
    const release = await version()
    const cwd = vite()
    const { code, text, commands } = await init(cwd, "--registry", ACME)
    expect(code).toBe(0)
    expect(text.split("\n")).toEqual([
      "kirana: config: create kirana.config.ts",
      "kirana: adapter: add @kirana-style/vite to vite.config.ts",
      "kirana: stylesheet: import the stylesheet in src/main.tsx",
      "kirana: types: create src/kirana.d.ts",
      "@acme/kit 1.0.0",
      "  + src/lib/kit/config.ts",
      "  + src/lib/kit/document.ts",
      "  + src/components/ui/reset.css",
      'setup: tsconfig.app.json: paths "@/*": ["./src/*"]',
      "setup: vite.config.ts: resolve: { tsconfigPaths: true }",
      'setup: kirana.config.ts: ui {"framework":"react","registries":{"@acme":"acme/{name}.json"}}',
      "setup: kirana.config.ts: spreads kitConfig (./src/lib/kit/config.ts)",
      "setup: src/main.tsx: imports @/components/ui/reset.css",
      "setup: src/main.tsx: sets <html>'s classes from htmlStyles",
      "packages: npm install --save-exact @kirana-style/core@0.3.2",
      `packages: npm install --save-exact -D kirana-style@${release} @kirana-style/vite@${release} @kirana-style/registry@${release}`,
      "kirana-style.lock.json: 1 item(s) recorded",
      "",
    ])
    // Kirana's packages at this release, the registry among them, recorded exactly (KF-035); the
    // design system's own version of one wins.
    expect(commands).toEqual([
      "npm install --save-exact @kirana-style/core@0.3.2",
      `npm install --save-exact -D kirana-style@${release} @kirana-style/vite@${release} @kirana-style/registry@${release}`,
    ])
    expect(read(cwd, "kirana.config.ts")).toBe(
      [
        'import { defineConfig } from "@kirana-style/core/config"',
        'import { kitConfig } from "./src/lib/kit/config.ts"',
        "",
        "export default defineConfig({",
        "  ...kitConfig,",
        "  ui: {",
        '    "framework": "react",',
        '    "registries": {',
        '      "@acme": "acme/{name}.json"',
        "    }",
        "  },",
        "})",
        "",
      ].join("\n")
    )
    expect(read(cwd, "tsconfig.app.json")).toContain(
      '"compilerOptions": {\n    "paths": { "@/*": ["./src/*"] },'
    )
    expect(read(cwd, "vite.config.ts")).toContain(
      "resolve: { tsconfigPaths: true },"
    )
    const entry = read(cwd, "src/main.tsx")
    expect(entry).toContain("import '@/components/ui/reset.css'")
    expect(entry).toContain("import { htmlStyles } from '@/lib/kit/document'")
    expect(entry).toContain(
      "\n\ndocument.documentElement.className = props(htmlStyles).className ?? ''\n"
    )
    expect(Object.keys(readLockfile(cwd).items)).toEqual(["@acme/kit"])
  })

  it("sets <html>'s classes from the props Solid gives, its class", async () => {
    const cwd = vite({
      "package.json": JSON.stringify({
        type: "module",
        dependencies: { "solid-js": "^1.9.0" },
        devDependencies: { vite: "^8.0.0", "vite-plugin-solid": "^2.11.0" },
      }),
      "src/main.tsx":
        "import { render } from 'solid-js/web'\n\nrender(() => <p />, document.getElementById('root')!)\n",
    })
    const { code } = await init(cwd, "--registry", ACME)
    expect(code).toBe(0)
    expect(read(cwd, "src/main.tsx")).toContain(
      "\n\ndocument.documentElement.className = props(htmlStyles).class ?? ''\n"
    )
  })

  it("sets <html> up in an Astro layout, in its markup and its frontmatter (KF-109)", async () => {
    const cwd = project({
      "package.json": JSON.stringify({
        type: "module",
        dependencies: {
          astro: "^7.0.0",
          "@astrojs/react": "^7.0.0",
          react: "^19.0.0",
        },
        devDependencies: { "@kirana-style/astro": "0.4.0" },
      }),
      "astro.config.mjs":
        'import react from "@astrojs/react"\nimport kirana from "@kirana-style/astro"\nimport { defineConfig } from "astro/config"\n\nexport default defineConfig({ integrations: [kirana(), react()] })\n',
      "tsconfig.json":
        '{\n  "extends": "astro/tsconfigs/strict",\n  "include": [".astro/types.d.ts", "**/*"],\n  "compilerOptions": {\n    "jsx": "react-jsx"\n  }\n}\n',
      "src/layouts/Layout.astro":
        '---\nimport "@kirana-style/core/stylesheet.css"\n\nconst { title } = Astro.props\n---\n\n<html lang="en">\n  <head><title>{title}</title></head>\n  <body><slot /></body>\n</html>\n',
      "src/pages/index.astro":
        '---\nimport Layout from "../layouts/Layout.astro"\n---\n\n<Layout title="Home" />\n',
      "acme/kit.json": JSON.stringify(kit()),
      "acme/index.json": JSON.stringify(INDEX),
    })
    const { code, text } = await init(cwd, "--registry", ACME, "--pointer")
    expect(code).toBe(0)
    expect(text).toContain('"framework":"react"')
    expect(text).toContain(
      "setup: src/layouts/Layout.astro: imports @/components/ui/reset.css"
    )
    expect(text).toContain(
      "setup: src/layouts/Layout.astro: <html sx={htmlStyles}>"
    )
    expect(text).toContain(
      "setup: src/layouts/Layout.astro: <html data-pointer>"
    )
    expect(text).not.toContain("by hand")
    expect(read(cwd, "src/layouts/Layout.astro")).toBe(
      '---\nimport "@kirana-style/core/stylesheet.css"\nimport "@/components/ui/reset.css"\nimport { htmlStyles } from "@/lib/kit/document"\n\nconst { title } = Astro.props\n---\n\n<html data-pointer sx={htmlStyles} lang="en">\n  <head><title>{title}</title></head>\n  <body><slot /></body>\n</html>\n'
    )
    // A page that renders no <html> is left alone.
    expect(read(cwd, "src/pages/index.astro")).not.toContain("htmlStyles")
  })

  it("sets <html>'s attributes in the Blade view Inertia renders into, and its classes from the entry (KF-109)", async () => {
    const cwd = project({
      "package.json": JSON.stringify({
        type: "module",
        dependencies: { "@inertiajs/react": "^3.0.0", react: "^19.0.0" },
        devDependencies: { vite: "^8.0.0", "laravel-vite-plugin": "^3.0.0" },
      }),
      "composer.json": '{"require":{"laravel/framework":"^13"}}',
      "vite.config.ts":
        "import laravel from 'laravel-vite-plugin'\nimport { defineConfig } from 'vite'\n\nexport default defineConfig({\n  plugins: [laravel({ input: 'resources/js/app.tsx' })],\n})\n",
      "tsconfig.json":
        '{ "compilerOptions": { "paths": { "@/*": ["./resources/js/*"] } } }',
      "resources/views/app.blade.php":
        "<!DOCTYPE html>\n<html lang=\"{{ str_replace('_', '-', app()->getLocale()) }}\">\n  <head>@vite('resources/js/app.tsx')</head>\n  <body>@inertia</body>\n</html>\n",
      "resources/js/app.tsx":
        'import "@kirana-style/core/stylesheet.css"\nimport { createInertiaApp } from "@inertiajs/react"\n\ncreateInertiaApp({})\n',
      "acme/kit.json": JSON.stringify(kit()),
      "acme/index.json": JSON.stringify(INDEX),
    })
    const { code, text } = await init(cwd, "--registry", ACME, "--rtl")
    expect(code).toBe(0)
    expect(text).toContain('"framework":"react"')
    expect(text).toContain(
      "setup: resources/js/app.tsx: sets <html>'s classes from htmlStyles"
    )
    expect(text).toContain(
      'setup: resources/views/app.blade.php: <html dir="rtl">'
    )
    expect(read(cwd, "resources/views/app.blade.php")).toContain(
      "<html dir=\"rtl\" lang=\"{{ str_replace('_', '-', app()->getLocale()) }}\">"
    )
  })

  it("puts the styles on <html> where a layout renders it, and follows the aliases the project has", async () => {
    const cwd = next()
    const { code, text } = await init(cwd, "--registry", ACME)
    expect(code).toBe(0)
    expect(text).toContain("setup: app/layout.tsx: <html sx={htmlStyles}>")
    // Next.js takes Kirana's stylesheet as a PostCSS directive: the reset is imported beside it.
    expect(text).toContain(
      "setup: app/globals.css: imports ../components/ui/reset.css"
    )
    expect(read(cwd, "app/globals.css")).toMatch(
      /^@import "\.\.\/components\/ui\/reset\.css";\n@kirana;/
    )
    const layout = read(cwd, "app/layout.tsx")
    expect(layout).toContain('<html sx={htmlStyles} lang="en">')
    expect(layout).toContain('import { htmlStyles } from "@/lib/kit/document"')
    expect(read(cwd, "lib/kit/config.ts")).toBe("export const kitConfig = {}\n")

    // A JavaScript Next.js app, as `next-turbopack`'s template is: no tsconfig until `next` writes
    // one, so `init` writes Next.js's own, with the alias and the TypeScript the items need (KF-046).
    const untyped = project({
      "package.json": JSON.stringify({
        dependencies: { next: "^16.0.0", react: "19", "react-dom": "19" },
        devDependencies: { "@types/react": "19" },
      }),
      "app/layout.jsx":
        'import "./globals.css"\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  )\n}\n',
      "app/globals.css": "",
      "acme/kit.json": JSON.stringify(kit()),
      "acme/index.json": JSON.stringify(INDEX),
    })
    const typed = await init(untyped, "--registry", ACME)
    expect(typed.code).toBe(0)
    expect(typed.text).toContain("kirana: types: create kirana.d.ts")
    expect(typed.text).toContain(
      "setup: tsconfig.json: Next.js's compiler options, as `next` would write them"
    )
    expect(typed.text).toContain('setup: tsconfig.json: paths "@/*": ["./*"]')
    expect(typed.commands.at(-1)).toMatch(/ -D .*typescript @types\/node$/)
    const tsconfig = JSON.parse(read(untyped, "tsconfig.json")) as {
      compilerOptions: Record<string, unknown>
    }
    expect(tsconfig.compilerOptions).toMatchObject({
      paths: { "@/*": ["./*"] },
      noEmit: true,
      jsx: "react-jsx",
      plugins: [{ name: "next" }],
    })
    expect(read(untyped, "app/layout.jsx")).toContain(
      'import { htmlStyles } from "@/lib/kit/document"'
    )

    const tilde = vite({
      "tsconfig.app.json":
        '{ "compilerOptions": { "paths": { "#x": ["./x"], "~/*": ["./src/*"] } } }',
    })
    const result = await init(tilde, "--registry", ACME)
    expect(result.text).toContain("setup: ui.aliases follow tsconfig's ~/*")
    expect(read(tilde, "kirana.config.ts")).toContain('"ui": "~/components/ui"')
    expect(read(tilde, "src/main.tsx")).toContain("from '~/lib/kit/document'")
  })

  it("installs the font items a preset's values name, each stylesheet imported after Kirana's (KF-050)", async () => {
    const font = (name: string, family: string): Item => ({
      name: `font-${name}`,
      type: "font",
      version: "1.0.0",
      dependencies: { [`@fontsource-variable/${name}`]: "^5.2.0" },
      font: { family, import: `@fontsource-variable/${name}` },
    })
    const design = {
      axes: {
        font: {
          attribute: "data-font",
          values: ["inter", "lora"],
          items: { inter: "font-inter", lora: "font-lora" },
        },
        fontHeading: {
          attribute: "data-font-heading",
          values: ["inherit", "lora"],
          items: { lora: "font-lora" },
        },
      },
      presets: {
        k: [
          { axis: "font", values: ["inter", "lora"], bits: 1 },
          { axis: "fontHeading", values: ["inherit", "lora"], bits: 1 },
        ],
      },
    }
    const designed = { ...kit(), design }
    const fonts = {
      "acme/font-inter.json": JSON.stringify(font("inter", "'Inter Variable'")),
      "acme/font-lora.json": JSON.stringify(font("lora", "'Lora Variable'")),
    }
    // font inter, heading lora: 0 + 2; then lora for both: one item, once.
    const cwd = vite(fonts, designed)
    const { code, text, commands } = await init(
      cwd,
      "--registry",
      ACME,
      "--preset",
      "k2"
    )
    expect(code).toBe(0)
    expect(text).toContain("@acme/font-inter 1.0.0\n")
    expect(text).toContain("@acme/font-lora 1.0.0\n")
    expect(text).toContain(
      "setup: src/main.tsx: imports @fontsource-variable/inter\n"
    )
    expect(commands.join(" ")).toContain("@fontsource-variable/lora@^5.2.0")
    const entry = read(cwd, "src/main.tsx")
    expect(entry.indexOf("@kirana-style/core/stylesheet.css")).toBeLessThan(
      entry.indexOf("@fontsource-variable/inter")
    )
    expect(entry).toContain("import '@fontsource-variable/lora'")
    expect(Object.keys(readLockfile(cwd).items)).toEqual([
      "@acme/font-inter",
      "@acme/font-lora",
      "@acme/kit",
    ])
    const both = vite(fonts, designed)
    const once = await init(both, "--registry", ACME, "--preset", "k3")
    expect(once.text.match(/@acme\/font-lora 1\.0\.0/g)).toHaveLength(1)
    expect(read(both, "src/main.tsx").match(/fontsource/g)).toHaveLength(1)
  })

  it("starts with a preset's design: the settings, <html>'s attributes and the flattened builds", async () => {
    const design = {
      axes: { style: { attribute: "data-style", values: ["nova", "vega"] } },
      flatten: "style",
      presets: {
        k: [
          { axis: "style", values: ["nova", "vega"], bits: 1 },
          { axis: "base", values: ["base"], bits: 1 },
          { axis: "iconLibrary", values: ["lucide", "hugeicons"], bits: 1 },
        ],
      },
    }
    const designed = { ...kit(), design }
    const cwd = vite({}, designed)
    // style vega, base base, hugeicons: 1 + 0 + 4.
    const { code, text } = await init(cwd, "--registry", ACME, "--preset", "k5")
    expect(code).toBe(0)
    expect(text).toContain('setup: index.html: <html data-style="vega">')
    expect(read(cwd, "index.html")).toContain(
      '<html data-style="vega" lang="en">'
    )
    expect(read(cwd, "kirana.config.ts")).toContain(
      '"iconLibrary": "hugeicons"'
    )
    expect(read(cwd, "kirana.config.ts")).toContain(
      '"design": {\n      "style": "vega"\n    }'
    )
    const layout = next({ "acme/kit.json": JSON.stringify(designed) })
    expect(
      (await init(layout, "--registry", ACME, "--preset", "k1")).text
    ).toContain('setup: app/layout.tsx: <html data-style="vega">')
    const twoLayouts = next({
      "acme/kit.json": JSON.stringify(designed),
      "app/other/layout.tsx": "export default () => <html><body /></html>\n",
    })
    expect(
      (await init(twoLayouts, "--registry", ACME, "--preset", "k1")).text
    ).toContain('by hand: set <html>\'s attributes: data-style="vega"')
    expect(
      (await init(vite({}, designed), "--registry", ACME, "--preset", "z1"))
        .text
    ).toBe("z1 is not a preset code of @acme/kit\n")
    expect(
      (await init(vite(), "--registry", ACME, "--preset", "k1")).text
    ).toBe("k1 is not a preset code of @acme/kit, which describes no design\n")
  })

  it("keeps every design with --all-designs, saved as ui.allDesigns (KF-080)", async () => {
    const design = {
      axes: { style: { attribute: "data-style", values: ["nova", "vega"] } },
      flatten: "style",
      presets: { k: [{ axis: "style", values: ["nova", "vega"], bits: 1 }] },
    }
    const vega = "export const kitConfig = { vega: true }\n"
    const designed: Item = {
      ...kit(),
      design,
      flattened: {
        axis: "style",
        builds: {},
        axes: { style: { vega: [file("kit/config.ts", "lib", vega)] } },
      },
    }
    const flattened = vite({}, designed)
    expect(
      (await init(flattened, "--registry", ACME, "--preset", "k1")).code
    ).toBe(0)
    expect(read(flattened, "src/lib/kit/config.ts")).toBe(vega)
    const every = vite({}, designed)
    const { code, text } = await init(
      every,
      "--registry",
      ACME,
      "--preset",
      "k1",
      "--all-designs"
    )
    expect(code).toBe(0)
    expect(text).toContain('"allDesigns":true')
    expect(read(every, "kirana.config.ts")).toContain('"allDesigns": true')
    expect(read(every, "src/lib/kit/config.ts")).toBe(
      "export const kitConfig = {}\n"
    )
    expect(read(every, "index.html")).toContain('data-style="vega"')
  })

  it("lets a tsconfig that type-checks the configuration take its .ts import", async () => {
    const tsconfig = (text: string) => next({ "tsconfig.json": text })
    const emitsNothing = tsconfig(
      '{ "compilerOptions": { "noEmit": true, "paths": { "@/*": ["./*"] } }, "include": ["**/*.ts"] }'
    )
    expect((await init(emitsNothing, "--registry", ACME)).text).toContain(
      "setup: tsconfig.json: allowImportingTsExtensions, for kirana.config.mts's import"
    )
    expect(read(emitsNothing, "tsconfig.json")).toContain(
      '"allowImportingTsExtensions": true,'
    )
    const emits = tsconfig(
      '{ "compilerOptions": { "paths": { "@/*": ["./*"] } } }'
    )
    expect((await init(emits, "--registry", ACME)).text).toContain(
      'by hand: tsconfig.json type-checks kirana.config.mts, whose import ends in .ts: set "allowImportingTsExtensions": true there, or leave kirana.config.mts out of its include'
    )
    for (const text of [
      '{ "compilerOptions": { "paths": { "@/*": ["./*"] } }, "include": ["app"] }',
      '{ "compilerOptions": { "allowImportingTsExtensions": true, "paths": { "@/*": ["./*"] } } }',
    ]) {
      const left = tsconfig(text)
      expect((await init(left, "--registry", ACME)).text).not.toContain(
        "allowImportingTsExtensions"
      )
    }
  })

  it("writes --pointer and --rtl on <html> in the root document each template has (KF-077)", async () => {
    // A static app's index.html (Vite, Parcel, Bun, Ember, Analog).
    const static_ = vite()
    const both = await init(static_, "--registry", ACME, "--pointer", "--rtl")
    expect(both.code).toBe(0)
    expect(both.text).toContain(
      'setup: index.html: <html data-pointer dir="rtl">'
    )
    expect(read(static_, "index.html")).toContain(
      '<html dir="rtl" data-pointer lang="en">'
    )
    expect(both.text).toContain(
      "by hand: dir=\"rtl\" is on <html>: give your components' library the direction too where it reads it from a provider (Base UI's DirectionProvider, React Aria's I18nProvider)"
    )
    // A layout that renders <html> (Next.js, React Router, TanStack Start, SolidStart), beside the
    // design system's styles.
    const layout = next()
    const pointer = await init(layout, "--registry", ACME, "--pointer")
    expect(pointer.text).toContain("setup: app/layout.tsx: <html data-pointer>")
    expect(pointer.text).not.toContain("DirectionProvider")
    expect(read(layout, "app/layout.tsx")).toContain(
      '<html data-pointer sx={htmlStyles} lang="en">'
    )
    // The Angular CLI's src/index.html, and SvelteKit's src/app.html.
    for (const page of ["src/index.html", "src/app.html"]) {
      const cwd = vite({
        [page]: '<html lang="en">\n%sveltekit.body%</html>\n',
      })
      rmSync(path.join(cwd, "index.html"))
      expect((await init(cwd, "--registry", ACME, "--rtl")).text).toContain(
        `setup: ${page}: <html dir="rtl">`
      )
      expect(read(cwd, page)).toContain('<html dir="rtl" lang="en">')
    }
    // Already there, written another way: replaced, never doubled; --no-pointer takes it off.
    const set = next({
      "app/layout.tsx":
        "export default ({ children }) => <html dir='ltr' data-pointer={true}><body>{children}</body></html>\n",
    })
    expect(
      (await init(set, "--registry", ACME, "--rtl", "--no-pointer")).code
    ).toBe(0)
    expect(read(set, "app/layout.tsx")).toContain(
      '<html sx={htmlStyles} dir="rtl"><body>'
    )
    // No root document the CLI can write (Nuxt, Rails, a Blade view of Laravel's own), or two
    // layouts: said.
    const none = next({
      "app/other/layout.tsx": "export default () => <html><body /></html>\n",
    })
    expect(
      (await init(none, "--registry", ACME, "--pointer", "--rtl")).text
    ).toContain('by hand: set <html>\'s attributes: data-pointer dir="rtl"\n')
    const contradicting = await init(vite(), "--pointer", "--no-pointer")
    expect(contradicting).toMatchObject({
      code: 2,
      text: "kirana-style ui init: --pointer and --no-pointer contradict each other\n",
    })
    // Without either, <html> is left as it is.
    const plain = vite()
    expect((await init(plain, "--registry", ACME)).code).toBe(0)
    expect(read(plain, "index.html")).toContain('<html lang="en">')
  })

  it("names the design system with --design, and the framework and base with their flags", async () => {
    const cwd = vite({
      "acme/kit.json": JSON.stringify({
        ...kit(),
        frameworks: {
          react: { base: { files: [file("kit/react.ts", "lib", "x\n")] } },
        },
      }),
    })
    const { code, text } = await init(
      cwd,
      "--registry",
      ACME,
      "--design",
      "@acme/kit",
      "--framework",
      "react",
      "--base",
      "base"
    )
    expect(code).toBe(0)
    expect(text).toContain('ui {"framework":"react","base":"base",')
    expect(text).toContain("@acme/kit 1.0.0 · react/base")
    // Without a registry named anywhere, the design system is @kirana's: one in @acme is unknown.
    expect((await init(vite(), "--design", "@acme/kit")).text).toBe(
      "@acme is not a registry this project knows: @kirana (ui.registries in kirana.config)\n"
    )
    // A library folder above the configuration's: its module keeps its ../.
    const above = vite({
      "tsconfig.app.json": `{ "compilerOptions": { "paths": { "@/*": ["../${path.basename(mkdtempSync(path.join(root, "shared-")))}/*"] } } }`,
    })
    await init(above, "--registry", ACME)
    expect(read(above, "kirana.config.ts")).toMatch(
      /import \{ kitConfig \} from "\.\.\/shared-\w+\/lib\/kit\/config\.ts"/
    )
    // A design system without wiring, in an app whose entry quotes with double quotes.
    const plain = vite({
      "src/main.tsx":
        'import { createRoot } from "react-dom/client"\n\ncreateRoot(document.body)\n',
      "acme/bare.json": JSON.stringify({ ...kit(null), name: "bare" }),
    })
    const bare = await init(plain, "--registry", ACME, "--design", "bare")
    expect(bare.text).toContain("@acme/bare 1.0.0")
    expect(bare.text).not.toContain("by hand:")
    const doubled = vite({
      "src/main.tsx":
        'import { createRoot } from "react-dom/client"\n\ncreateRoot(document.body)\n',
    })
    await init(doubled, "--registry", ACME)
    expect(read(doubled, "src/main.tsx")).toContain(
      'props(htmlStyles).className ?? ""'
    )
    expect(
      (await init(vite(), "--registry", ACME, "--design", "../kit")).text
    ).toBe("../kit is not an item: @namespace/name, or a name for @kirana's\n")
  })

  it("prints what it cannot do safely as steps by hand", async () => {
    // A JSON configuration takes the settings, but cannot import the design system's configuration.
    const json = vite({ "kirana.config.json": '{ "layers": {} }' })
    const fromJson = await init(json, "--registry", ACME)
    expect(fromJson.code).toBe(0)
    expect(fromJson.text).toContain(
      "by hand: kirana.config.json cannot import kitConfig: rename it kirana.config.ts and spread it into defineConfig"
    )
    expect(JSON.parse(read(json, "kirana.config.json")).ui).toEqual({
      framework: "react",
      registries: { "@acme": "acme/{name}.json" },
    })
    const plainConfig = vite({
      "kirana.config.ts": "const config = {}\nexport default config\n",
    })
    expect((await init(plainConfig, "--registry", ACME)).text).toContain(
      'by hand: kirana.config.ts: no defineConfig({ … }) to edit: add ui: {"framework":"react","registries":{"@acme":"acme/{name}.json"}} and ...kitConfig by hand'
    )
    // Nothing to add to a configuration without defineConfig, so nothing to do by hand.
    const settled = vite({
      "kirana.config.ts":
        'const config = { ui: { framework: "react", registries: { "@acme": "acme/{name}.json" } } }\nexport default config\n',
      "acme/kit.json": JSON.stringify(kit({})),
    })
    expect((await init(settled)).text).not.toContain("by hand:")
    // A JSON configuration with nothing to add.
    const jsonSettled = vite({
      "kirana.config.json":
        '{ "ui": { "framework": "react", "registries": { "@acme": "acme/{name}.json" } } }',
      "acme/kit.json": JSON.stringify(kit({})),
    })
    expect((await init(jsonSettled)).text).not.toContain("by hand:")
    const withUi = withCore(
      vite({
        "kirana.config.ts":
          'import { defineConfig } from "@kirana-style/core/config"\n\nexport default defineConfig({ ui: { registries: { "@acme": "acme/{name}.json" } } })\n',
      })
    )
    expect((await init(withUi)).text).toContain(
      'by hand: kirana.config.ts has ui already: set {"framework":"react"} in it'
    )
    // Into the config's own `resolve` (Analog's sets `mainFields` there).
    const resolved = vite({
      "vite.config.ts":
        "import { defineConfig } from 'vite'\n\nexport default defineConfig({ resolve: { alias: {} } })\n",
    })
    expect((await init(resolved, "--registry", ACME)).text).toContain(
      "setup: vite.config.ts: resolve: { tsconfigPaths: true }"
    )
    expect(read(resolved, "vite.config.ts")).toContain(
      "resolve: { tsconfigPaths: true, alias: {} }"
    )
    const plain = vite({
      "vite.config.ts": "export default { plugins: [] }\n",
    })
    expect((await init(plain, "--registry", ACME)).text).toContain(
      "by hand: vite.config.ts: add resolve: { tsconfigPaths: true }, so Vite reads the aliases"
    )
    // Kirana's own setup cannot edit a Vite configuration without defineConfig.
    const plainVite = vite({ "vite.config.ts": "export default {}\n" })
    expect((await init(plainVite, "--registry", ACME)).text).toMatch(
      /by hand: kirana: adapter: /
    )
    const twoLayouts = next({
      "app/other/layout.tsx": "export default () => <html><body /></html>\n",
    })
    expect((await init(twoLayouts, "--registry", ACME)).text).toContain(
      'by hand: give <html> the design system\'s styles: <html sx={htmlStyles}>, with import { htmlStyles } from "@/lib/kit/document"'
    )
  })

  it("leaves what is set up already, and says what a project without an entry or a tsconfig needs", async () => {
    const cwd = withCore(vite())
    await init(cwd, "--registry", ACME)
    const again = await init(cwd, "--overwrite")
    expect(again.code).toBe(0)
    expect(again.text).toContain("  = src/lib/kit/config.ts")
    expect(again.text).not.toContain("setup:")
    expect(again.text).not.toContain("by hand:")
    // No tsconfig with compiler options, no script that imports Kirana's stylesheet.
    const bare = project({
      "package.json": JSON.stringify({ dependencies: { react: "19" } }),
      "tsconfig.json":
        '{ "references": [{ "path": "./missing.json" }, { "path": "./app" }] }',
      "app/tsconfig.json": "{}",
      "acme/kit.json": JSON.stringify(kit()),
      "acme/index.json": JSON.stringify(INDEX),
    })
    expect(await init(bare, "--registry", ACME)).toMatchObject({
      code: 1,
      text: '@/lib: no compilerOptions.paths entry in tsconfig.json maps it to a directory (for example "@/*": ["./src/*"])\n',
    })
    // Paths without a prefix to follow, or no tsconfig at all: placing the files says what to add.
    for (const tsconfig of [
      {
        "tsconfig.json":
          '{ "compilerOptions": { "paths": { "#x": ["./x"] } } }',
      },
      {},
    ] as Record<string, string>[])
      expect(
        (
          await init(
            project({
              // No framework to read: none is written.
              "package.json": "{}",
              "acme/kit.json": JSON.stringify(kit()),
              "acme/index.json": JSON.stringify(INDEX),
              ...tsconfig,
            }),
            "--registry",
            ACME
          )
        ).code
      ).toBe(1)
    // Kirana's stylesheet as a directive in a stylesheet at the root: the reset beside it, as ./.
    const rootCss = project({
      "package.json": JSON.stringify({ dependencies: { react: "19" } }),
      "tsconfig.json": '{ "compilerOptions": { "paths": { "@/*": ["./*"] } } }',
      "styles.css": "@kirana;\n",
      "acme/kit.json": JSON.stringify(kit()),
      "acme/index.json": JSON.stringify(INDEX),
    })
    await init(rootCss, "--registry", ACME)
    expect(read(rootCss, "styles.css")).toBe(
      '@import "./components/ui/reset.css";\n@kirana;\n'
    )
    const noEntry = project({
      "package.json": JSON.stringify({ dependencies: { react: "19" } }),
      "tsconfig.json":
        '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }',
      "acme/kit.json": JSON.stringify(kit()),
      "acme/index.json": JSON.stringify(INDEX),
    })
    const { text } = await init(noEntry, "--registry", ACME)
    expect(text).toContain(
      'by hand: import "@/components/ui/reset.css" after Kirana\'s stylesheet'
    )
    expect(text).toContain("by hand: give <html> the design system's styles")
    const noSrc = project({
      "package.json": JSON.stringify({ dependencies: { vue: "3" } }),
      "tsconfig.json": '{ "compilerOptions": {} }',
      "acme/kit.json": JSON.stringify(kit({})),
      "acme/index.json": JSON.stringify(INDEX),
    })
    const vue = await init(noSrc, "--registry", ACME)
    expect(vue.text).toContain('setup: tsconfig.json: paths "@/*": ["./*"]')
    expect(existsSync(path.join(noSrc, "lib/kit/config.ts"))).toBe(true)
  })

  it("writes nothing on a dry run, and nothing over a file the project changed", async () => {
    const dry = vite()
    const result = await init(dry, "--registry", ACME, "--dry-run")
    expect(result.code).toBe(0)
    expect(result.text).toMatch(/dry run: nothing written\n$/)
    expect(result.commands).toEqual([])
    expect(existsSync(path.join(dry, "kirana.config.ts"))).toBe(false)
    const changed = vite({ "src/lib/kit/config.ts": "// mine\n" })
    const refused = await init(changed, "--registry", ACME)
    expect(refused.code).toBe(1)
    expect(refused.text).toContain("  ! src/lib/kit/config.ts")
    expect(existsSync(path.join(changed, "kirana.config.ts"))).toBe(false)
  })

  it("stops on its options, the settings, a registry without a design system, or a setup it cannot follow", async () => {
    const cwd = vite()
    const fails = async (...argv: string[]) => (await init(cwd, ...argv)).text
    expect(await fails("--yes")).toBe(
      "kirana-style ui init: unknown option --yes\n"
    )
    expect(await fails("--framework", "jquery")).toBe(
      "kirana-style ui init: --framework is one of react, vue, svelte, solid, angular\n"
    )
    expect(await fails("--base", "Base UI")).toBe(
      "kirana-style ui init: --base is a lower-case name, such as base or aria\n"
    )
    expect(await fails("--registry", "acme=x")).toBe(
      "kirana-style ui init: --registry is @namespace=<template holding {name}>, not acme=x\n"
    )
    expect(await fails("button")).toBe(
      "kirana-style ui init takes no item: button\n"
    )
    const none = vite({ "acme/index.json": JSON.stringify({ items: [] }) })
    expect((await init(none, "--registry", ACME)).text).toBe(
      "@acme has no design-system item in its index: name one with --design\n"
    )
    const lost = vite(
      {},
      kit({ config: { module: "@/registry/lib/kit/gone", export: "x" } })
    )
    expect((await init(lost, "--registry", ACME)).text).toBe(
      "kit: setup.config names @/registry/lib/kit/gone, which the item does not install\n"
    )
    writeFileSync(
      path.join(cwd, "kirana.config.json"),
      '{ "ui": { "base": 5 } }'
    )
    const broken = await init(cwd)
    expect(broken.code).toBe(2)
    expect(broken.text).toMatch(/ui\/base must be a string\n$/)
  })

  it("checks what it wrote with Kirana, on a project that has Kirana's core", async () => {
    const cwd = withCore(vite({ ".cache/x.css": "", "dist/y.css": "" }))
    let text = ""
    const code = await main(
      ["init", "--registry", ACME],
      cwd,
      (chunk) => void (text += chunk),
      { run: () => 0, load }
    )
    expect(code).toBe(0)
    expect(text).toMatch(
      /check: kirana-style check on 2 file\(s\)\n0 diagnostic\(s\), 0 error\(s\)\n$/
    )
    // A design system whose own file Kirana rejects.
    const wrong = withCore(
      vite({
        "acme/kit.json": JSON.stringify({
          ...kit(),
          files: [
            ...kit().files!,
            file(
              "kit/wrong.ts",
              "lib",
              'import { css } from "@kirana-style/core"\nexport const a = css({ colour: "red" })\n'
            ),
          ],
        }),
      })
    )
    let rejected = ""
    expect(
      await main(
        ["init", "--registry", ACME],
        wrong,
        (chunk) => void (rejected += chunk),
        { run: () => 0, load }
      )
    ).toBe(1)
    expect(rejected).toContain("unknown-property")
    // A setup naming a stylesheet the item does not install, where Kirana's stylesheet is CSS.
    const lost = next({
      "acme/kit.json": JSON.stringify(
        kit({ stylesheets: ["@/registry/ui/gone.css"] })
      ),
      // Never searched for Kirana's stylesheet: hidden folders and installed packages.
      ".next/a.css": "@kirana;\n",
      "node_modules/x/b.css": "@kirana;\n",
    })
    expect((await init(lost, "--registry", ACME)).text).toBe(
      "kit: setup.stylesheets names @/registry/ui/gone.css, which the item does not install\n"
    )
  })

  it("keeps what it wrote when a package fails to install, without the lockfile", async () => {
    const cwd = vite()
    let text = ""
    const code = await main(
      ["init", "--registry", ACME],
      cwd,
      (chunk) => void (text += chunk),
      { run: () => 1, load }
    )
    expect(code).toBe(1)
    expect(text).toMatch(
      /failed: the files are written, the lockfile is not\n$/
    )
    expect(existsSync(path.join(cwd, "kirana.config.ts"))).toBe(true)
    expect(existsSync(path.join(cwd, "kirana-style.lock.json"))).toBe(false)
  })
})

/** React Router's example: its tsconfig compiles `app` and the root's scripts, not the root's folders. */
function reactRouter(extra: Record<string, string | undefined> = {}) {
  return project({
    "package.json": JSON.stringify({
      type: "module",
      dependencies: { react: "^19.0.0", "react-router": "^8.0.0" },
      devDependencies: { "@react-router/dev": "^8.0.0", vite: "^8.0.0" },
    }),
    "vite.config.ts":
      'import { reactRouter } from "@react-router/dev/vite"\nimport { defineConfig } from "vite"\n\nexport default defineConfig({\n  plugins: [reactRouter()],\n})\n',
    "tsconfig.json":
      '{\n  "include": ["app", "*.ts", ".react-router/types/**/*"],\n  "compilerOptions": { "noEmit": true }\n}\n',
    "app/root.tsx":
      'import "@kirana-style/core/stylesheet.css"\n\nexport function Layout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  )\n}\n',
    "acme/kit.json": JSON.stringify(kit()),
    "acme/index.json": JSON.stringify(INDEX),
    ...extra,
  })
}

/** Nuxt's example: no tsconfig until `nuxt prepare` writes `.nuxt`'s, and the stylesheet in `css`. */
function nuxt(extra: Record<string, string | undefined> = {}, source = "app/") {
  return project({
    "package.json": `${JSON.stringify(
      {
        type: "module",
        scripts: { build: "nuxt generate" },
        dependencies: { nuxt: "^4.5.0", vue: "^3.5.0" },
        devDependencies: { "@kirana-style/vite": "0.4.0" },
      },
      null,
      2
    )}\n`,
    "nuxt.config.ts":
      'import kirana from "@kirana-style/vite"\n\nexport default defineNuxtConfig({\n  css: ["@kirana-style/core/stylesheet.css"],\n  vite: { plugins: [kirana()] },\n})\n',
    [`${source}app.vue`]: "<template><p>Styled by Kirana.</p></template>\n",
    "acme/kit.json": JSON.stringify(kit()),
    "acme/index.json": JSON.stringify(INDEX),
    ...extra,
  })
}

/** SvelteKit 3's example: no tsconfig until `svelte-kit sync` writes `$app/tsconfig`. */
function svelteKit(
  extra: Record<string, string | undefined> = {},
  kitVersion = "^3.1.0"
) {
  return project({
    "package.json": `${JSON.stringify(
      {
        type: "module",
        scripts: { build: "vite build" },
        devDependencies: {
          "@sveltejs/kit": kitVersion,
          svelte: "^5.0.0",
          vite: "^8.0.0",
        },
      },
      null,
      "\t"
    )}\n`,
    "vite.config.ts":
      'import { sveltekit } from "@sveltejs/kit/vite"\nimport { defineConfig } from "vite"\n\nexport default defineConfig({\n  plugins: [sveltekit()],\n})\n',
    "src/routes/+layout.svelte":
      '<script lang="ts">\n  import "@kirana-style/core/stylesheet.css"\n</script>\n',
    "acme/kit.json": JSON.stringify(kit()),
    "acme/index.json": JSON.stringify(INDEX),
    ...extra,
  })
}

describe("KF-107 ui init where the tsconfig compiles one folder, or the framework generates it", () => {
  it("maps @/* inside the include of React Router's tsconfig, to app/", async () => {
    const cwd = reactRouter()
    const { code, text } = await init(cwd, "--registry", ACME)
    expect(code).toBe(0)
    expect(text).toContain("  + app/lib/kit/config.ts\n")
    expect(text).toContain(
      'setup: tsconfig.json: paths "@/*": ["./app/*"], inside its include\n'
    )
    expect(text).toContain("setup: app/root.tsx: <html sx={htmlStyles}>\n")
    expect(text).not.toContain("by hand:")
    expect(read(cwd, "tsconfig.json")).toContain(
      '"paths": { "@/*": ["./app/*"] },'
    )
    expect(read(cwd, "kirana.config.ts")).toContain(
      'import { kitConfig } from "./app/lib/kit/config.ts"'
    )
    // An `app` include names that is not there, and a `src` it leaves out: `src` is added to it.
    const left = reactRouter({
      "tsconfig.json":
        '{ "include": ["./app/", "src/*.ts"], "compilerOptions": {} }',
      "app/root.tsx": undefined,
      "src/main.ts": "",
    })
    const added = await init(left, "--registry", ACME)
    expect(added.text).toContain(
      'setup: tsconfig.json: paths "@/*": ["./src/*"]\nsetup: tsconfig.json: include takes src, where ui installs\n'
    )
    expect(read(left, "tsconfig.json")).toContain(
      '"include": ["./app/", "src/*.ts", "src"]'
    )
    // The root's folders, each once; an include with no entry to follow is said, not edited.
    const rootFolders = reactRouter({
      "tsconfig.json": '{ "include": ["*.ts"], "compilerOptions": {} }',
    })
    expect((await init(rootFolders, "--registry", ACME)).text).toContain(
      "setup: tsconfig.json: include takes components, lib, hooks, where ui installs\n"
    )
    const empty = reactRouter({
      "tsconfig.json": '{ "include": [], "compilerOptions": {} }',
    })
    expect((await init(empty, "--registry", ACME)).text).toContain(
      "by hand: tsconfig.json: add components, lib, hooks to its include, so TypeScript, Vite and Kirana compile what ui installs\n"
    )
  })

  it("adds the framework's component files to an include whose patterns take scripts only", async () => {
    // A folder in include takes only scripts, as TypeScript reads it: Vite would resolve no alias
    // in a .vue file there.
    const vue = vite({
      "package.json": JSON.stringify({
        dependencies: { vue: "^3.5.0" },
        devDependencies: { vite: "^8.0.0" },
      }),
      "tsconfig.json": '{ "compilerOptions": {}, "include": ["src"] }',
    })
    const { text } = await init(vue, "--registry", ACME)
    expect(text).toContain(
      "setup: tsconfig.json: include takes src/**/*.vue, where ui installs\n"
    )
    expect(read(vue, "tsconfig.json")).toContain(
      '"include": ["src", "src/**/*.vue"]'
    )
    // At the root, after the last of several entries.
    const atRoot = project({
      "package.json": JSON.stringify({ dependencies: { vue: "3" } }),
      "tsconfig.json":
        '{ "compilerOptions": {}, "include": ["**/*.ts", "./types/"] }',
      "acme/kit.json": JSON.stringify(kit({})),
      "acme/index.json": JSON.stringify(INDEX),
    })
    expect((await init(atRoot, "--registry", ACME)).text).toContain(
      'setup: tsconfig.json: paths "@/*": ["./*"]\nsetup: tsconfig.json: include takes **/*.vue, where ui installs\n'
    )
    expect(read(atRoot, "tsconfig.json")).toContain(
      '"include": ["**/*.ts", "./types/", "**/*.vue"]'
    )
    // An include that names them already.
    const named = vite({
      "package.json": JSON.stringify({ dependencies: { svelte: "^5.0.0" } }),
      "tsconfig.json":
        '{ "compilerOptions": {}, "include": ["src/**/*.ts", "src/**/*.svelte"] }',
    })
    expect((await init(named, "--registry", ACME)).text).not.toContain(
      "include takes"
    )
  })

  it("gives Nuxt its starter's tsconfig, the script that writes .nuxt's, and its own @/*", async () => {
    const cwd = nuxt()
    const { code, text, commands } = await init(cwd, "--registry", ACME)
    expect(code).toBe(0)
    expect(text.split("\n")).toEqual([
      "kirana: config: create kirana.config.ts",
      "kirana: types: create kirana.d.ts",
      "@acme/kit 1.0.0",
      "  + app/lib/kit/config.ts",
      "  + app/lib/kit/document.ts",
      "  + app/components/ui/reset.css",
      "setup: tsconfig.json: Nuxt's, referencing the tsconfigs nuxt prepare writes in .nuxt",
      "setup: package.json: scripts.postinstall nuxt prepare, as the starter has it",
      'setup: kirana.config.ts: ui {"framework":"vue","registries":{"@acme":"acme/{name}.json"}}',
      "setup: kirana.config.ts: spreads kitConfig (./app/lib/kit/config.ts)",
      "setup: nuxt.config.ts: css lists @/components/ui/reset.css",
      "setup: app/app.vue: <Html />, which Nuxt renders <html> from",
      'setup: app/app.vue: <Html :sx="htmlStyles">',
      "packages: npm install --save-exact @kirana-style/core@0.3.2",
      `packages: npm install --save-exact -D kirana-style@${await version()} @kirana-style/registry@${await version()}`,
      "packages: npm run postinstall",
      "kirana-style.lock.json: 1 item(s) recorded",
      "",
    ])
    // `npm install <package>` runs none of the project's scripts: init runs it after them.
    expect(commands.at(-1)).toBe("npm run postinstall")
    expect(JSON.parse(read(cwd, "tsconfig.json"))).toEqual({
      files: [],
      references: [
        { path: "./.nuxt/tsconfig.app.json" },
        { path: "./.nuxt/tsconfig.server.json" },
        { path: "./.nuxt/tsconfig.shared.json" },
        { path: "./.nuxt/tsconfig.node.json" },
      ],
    })
    expect(JSON.parse(read(cwd, "package.json"))).toMatchObject({
      scripts: { build: "nuxt generate", postinstall: "nuxt prepare" },
    })
    // The configuration runs in Node: the reset beside Kirana's stylesheet in `css`, nothing imported.
    expect(read(cwd, "nuxt.config.ts")).toBe(
      'import kirana from "@kirana-style/vite"\n\nexport default defineNuxtConfig({\n  css: ["@kirana-style/core/stylesheet.css", "@/components/ui/reset.css"],\n  vite: { plugins: [kirana()] },\n})\n'
    )
    expect(existsSync(path.join(cwd, ".nuxt"))).toBe(false)
  })

  it("follows Nuxt's source folder, what .nuxt holds once written, and a postinstall of the project's own", async () => {
    // Nuxt 3's layout, at the root, and the configuration's quotes.
    const flat = nuxt(
      {
        "nuxt.config.ts":
          "export default defineNuxtConfig({ css: ['@kirana-style/core/stylesheet.css'] })\n",
      },
      ""
    )
    const atRoot = await init(flat, "--registry", ACME)
    expect(atRoot.text).toContain("  + lib/kit/config.ts\n")
    expect(read(flat, "nuxt.config.ts")).toContain(
      "css: ['@kirana-style/core/stylesheet.css', '@/components/ui/reset.css']"
    )
    // Generated already, mapping `@/*` elsewhere: that is what counts, and nothing runs again.
    const prepared = nuxt({
      "tsconfig.json": NUXT_REFERENCES,
      ".nuxt/tsconfig.app.json":
        '{ "compilerOptions": { "paths": { "@/*": ["../app/source/*"] } } }',
      "package.json": JSON.stringify({
        scripts: { postinstall: "nuxt prepare && husky" },
        dependencies: { nuxt: "^4.5.0" },
      }),
    })
    const ready = await init(prepared, "--registry", ACME)
    expect(ready.text).toContain("  + app/source/lib/kit/config.ts\n")
    expect(ready.text).not.toContain("tsconfig.json: Nuxt's")
    expect(ready.text).not.toContain("package.json:")
    expect(ready.commands.some((command) => command.includes(" run "))).toBe(
      false
    )
    // A postinstall that does not prepare: said, and not run.
    const other = nuxt({
      "package.json": JSON.stringify({
        scripts: { postinstall: "husky" },
        dependencies: { nuxt: "^4.5.0" },
      }),
    })
    const mine = await init(other, "--registry", ACME)
    expect(mine.text).toContain(
      "by hand: package.json: scripts.postinstall does not run nuxt prepare: add it and run it, for the tsconfig the aliases are in\n"
    )
    expect(mine.commands.some((command) => command.includes(" run "))).toBe(
      false
    )
  })

  it("gives SvelteKit 3 its starter's tsconfig with @/*, the script that syncs, and Vite the paths", async () => {
    const cwd = svelteKit()
    const { code, text, commands } = await init(cwd, "--registry", ACME)
    expect(code).toBe(0)
    expect(text).toContain("  + src/lib/kit/config.ts\n")
    expect(text).toContain(
      [
        "setup: tsconfig.json: SvelteKit's, extending the $app/tsconfig svelte-kit sync writes",
        'setup: tsconfig.json: paths "@/*": ["./src/*"]',
        "setup: tsconfig.json: include takes src/**/*.svelte, where ui installs",
        "setup: vite.config.ts: resolve: { tsconfigPaths: true }",
        "setup: package.json: scripts.prepare svelte-kit sync || echo '', as the starter has it",
      ].join("\n")
    )
    expect(commands.at(-1)).toBe("npm run prepare")
    expect(JSON.parse(read(cwd, "tsconfig.json"))).toEqual({
      extends: "$app/tsconfig",
      compilerOptions: { paths: { "@/*": ["./src/*"] }, strict: true },
      include: ["src", "vite.config.ts", "src/**/*.svelte"],
    })
    // The project's own indentation, a tab.
    expect(read(cwd, "package.json")).toContain(
      '\n\t"scripts": {\n\t\t"build": "vite build",\n\t\t"prepare": "svelte-kit sync || echo \'\'"\n\t},'
    )
    // Any version without a major is the current one; Deno runs the script as a task; a package.json
    // on one line is written as npm writes one.
    const latest = svelteKit({
      "deno.lock": "{}",
      "package.json": JSON.stringify({
        devDependencies: { "@sveltejs/kit": "latest" },
      }),
    })
    const deno = await init(latest, "--registry", ACME)
    expect(deno.text).toContain("SvelteKit's, extending the $app/tsconfig")
    expect(deno.commands.at(-1)).toBe("deno task prepare")
    expect(read(latest, "package.json")).toBe(
      '{\n  "devDependencies": {\n    "@sveltejs/kit": "latest"\n  },\n  "scripts": {\n    "prepare": "svelte-kit sync || echo \'\'"\n  }\n}\n'
    )
    // SvelteKit 2 generates `.svelte-kit/tsconfig.json`, whose `$lib` a root `paths` would hide.
    const two = await init(svelteKit({}, "^2.20.0"), "--registry", ACME)
    expect(two).toMatchObject({
      code: 1,
      text: '@/lib: no compilerOptions.paths entry in tsconfig.json maps it to a directory (for example "@/*": ["./src/*"])\n',
    })
  })

  it("runs the generator after every install, which can remove what it wrote, and stops when it fails", async () => {
    const cwd = svelteKit()
    await init(cwd, "--registry", ACME)
    // The configuration as Node.js loads it: vitest's own loader would follow the tsconfig's
    // `extends`, which is not there yet.
    const configured = async () => ({
      default: {
        ui: {
          framework: "svelte",
          registries: { "@acme": "acme/{name}.json" },
        },
      },
    })
    // `ui add` installs what the stub left out, then writes `$app/tsconfig`, before its check.
    let text = ""
    const commands: string[] = []
    const add = () =>
      main(
        ["add", "@acme/kit", "--no-check", "--overwrite"],
        cwd,
        (chunk) => void (text += chunk),
        { run: (command) => (commands.push(command), 0), load: configured }
      )
    expect(await add()).toBe(0)
    expect(commands).toEqual([
      "npm install @kirana-style/core@0.3.2",
      "npm run prepare",
    ])
    expect(text).toContain("packages: npm run prepare\n")
    // Once it is there, nothing runs.
    mkdirSync(path.join(cwd, "node_modules/$app"), { recursive: true })
    writeFileSync(path.join(cwd, "node_modules/$app/tsconfig.json"), "{}")
    commands.length = 0
    expect(await add()).toBe(0)
    expect(commands).toEqual(["npm install @kirana-style/core@0.3.2"])
    let failed = ""
    expect(
      await main(
        ["init", "--registry", ACME],
        svelteKit(),
        (chunk) => void (failed += chunk),
        {
          run: (command) => (command === "npm run prepare" ? 1 : 0),
          load,
        }
      )
    ).toBe(1)
    expect(failed).toMatch(
      /npm run prepare failed: the files are written, the lockfile is not\n$/
    )
  })
})

/** SvelteKit's `src/app.html`: static, `<html>`'s attributes and nothing else. */
const APP_HTML =
  '<!doctype html>\n<html lang="en">\n  <head>%sveltekit.head%</head>\n  <body>%sveltekit.body%</body>\n</html>\n'

/** The server hook `init` writes into SvelteKit 3's `src/hooks.server.ts`. */
const HOOK = (specifier: string, handle = "@sveltejs/kit/hooks") =>
  [
    'import { props } from "@kirana-style/core"',
    `import type { Handle } from "${handle}"`,
    "",
    `import { htmlStyles } from "${specifier}"`,
    "",
    "/** `<html>`'s classes from the design system's styles: `src/app.html` is static. */",
    "export const handle: Handle = ({ event, resolve }) =>",
    "  resolve(event, {",
    "    transformPageChunk: ({ html }) =>",
    '      html.replace("<html", `<html class="${props(htmlStyles).className ?? ""}"`),',
    "  })",
    "",
  ].join("\n")

describe("KF-112 KF-113 ui init sets the document up on Nuxt and SvelteKit", () => {
  it("adds Nuxt's <Html> to app.vue where no component renders one, with the styles and the attributes (KF-112)", async () => {
    const cwd = nuxt()
    const { code, text } = await init(cwd, "--registry", ACME, "--pointer")
    expect(code).toBe(0)
    expect(text).toContain(
      [
        "setup: nuxt.config.ts: css lists @/components/ui/reset.css",
        "setup: app/app.vue: <Html />, which Nuxt renders <html> from",
        'setup: app/app.vue: <Html :sx="htmlStyles">',
        "setup: app/app.vue: <Html data-pointer>",
      ].join("\n")
    )
    expect(text).not.toContain("by hand")
    // A script for the import, as the template had none.
    expect(read(cwd, "app/app.vue")).toBe(
      '<script setup>\nimport { htmlStyles } from "@/lib/kit/document"\n</script>\n\n<template><Html data-pointer :sx="htmlStyles" /><p>Styled by Kirana.</p></template>\n'
    )
    // Nuxt 3's app.vue at the root, its script and its template's lines as they are.
    const flat = nuxt(
      {
        "app.vue":
          '<script setup lang="ts">\nimport { css } from "@kirana-style/core"\n\nconst a = css({})\n</script>\n\n<template>\n  <p :sx="a">x</p>\n</template>\n',
        "nuxt.config.ts":
          "export default defineNuxtConfig({ css: ['@kirana-style/core/stylesheet.css'] })\n",
      },
      "none/"
    )
    expect((await init(flat, "--registry", ACME)).text).toContain(
      'setup: app.vue: <Html :sx="htmlStyles">\n'
    )
    expect(read(flat, "app.vue")).toBe(
      '<script setup lang="ts">\nimport { css } from "@kirana-style/core"\nimport { htmlStyles } from "@/lib/kit/document"\n\nconst a = css({})\n</script>\n\n<template>\n  <Html :sx="htmlStyles" />\n  <p :sx="a">x</p>\n</template>\n'
    )
  })

  it("sets Nuxt's <Html> up where a component renders it, and says so where there is no app.vue to add it to (KF-112)", async () => {
    const layout =
      '<script setup lang="ts">\n// Renders <Html> for the document.\n</script>\n\n<template>\n  <Html lang="en">\n    <Body><slot /></Body>\n  </Html>\n</template>\n'
    const cwd = nuxt({ "app/layouts/default.vue": layout })
    const { code, text } = await init(cwd, "--registry", ACME, "--rtl")
    expect(code).toBe(0)
    expect(text).toContain(
      'setup: app/layouts/default.vue: <Html :sx="htmlStyles">\n'
    )
    expect(text).toContain('setup: app/layouts/default.vue: <Html dir="rtl">\n')
    expect(text).not.toContain("<Html />")
    expect(read(cwd, "app/layouts/default.vue")).toContain(
      '<script setup lang="ts">\nimport { htmlStyles } from "@/lib/kit/document"\n\n// Renders <Html> for the document.\n</script>\n\n<template>\n  <Html dir="rtl" :sx="htmlStyles" lang="en">'
    )
    expect(read(cwd, "app/app.vue")).toBe(
      "<template><p>Styled by Kirana.</p></template>\n"
    )
    // No app.vue (Nuxt's own, around pages), or one without a template: the two steps by hand.
    for (const app of [undefined, "<script setup>\n</script>\n"]) {
      const bare = nuxt({ "app/app.vue": app })
      const manual = await init(bare, "--registry", ACME, "--pointer")
      expect(manual.text).toContain(
        "by hand: give <html> the design system's styles"
      )
      expect(manual.text).toContain(
        "by hand: set <html>'s attributes: data-pointer\n"
      )
    }
    // Outside Nuxt, a component called Html is no document: index.html is.
    const vue = vite({
      "package.json": JSON.stringify({
        dependencies: { vue: "^3.5.0" },
        devDependencies: { vite: "^8.0.0" },
      }),
      "src/App.vue": '<template><Html lang="en" /></template>\n',
    })
    expect((await init(vue, "--registry", ACME, "--pointer")).text).toContain(
      "setup: index.html: <html data-pointer>\n"
    )
    expect(read(vue, "src/App.vue")).toBe(
      '<template><Html lang="en" /></template>\n'
    )
  })

  it("imports the reset and the fonts in SvelteKit's +layout.svelte, and writes the hook that sets <html>'s classes (KF-113)", async () => {
    const font: Item = {
      name: "font-inter",
      type: "font",
      version: "1.0.0",
      dependencies: { "@fontsource-variable/inter": "^5.2.0" },
      font: {
        family: "'Inter Variable'",
        import: "@fontsource-variable/inter",
      },
    }
    const design = {
      axes: {
        font: {
          attribute: "data-font",
          values: ["inter"],
          items: { inter: "font-inter" },
        },
      },
      presets: { k: [{ axis: "font", values: ["inter"], bits: 1 }] },
    }
    const cwd = svelteKit({
      "src/app.html": APP_HTML,
      "acme/kit.json": JSON.stringify({ ...kit(), design }),
      "acme/font-inter.json": JSON.stringify(font),
    })
    const { code, text } = await init(
      cwd,
      "--registry",
      ACME,
      "--preset",
      "k0",
      "--pointer"
    )
    expect(code).toBe(0)
    expect(text).toContain(
      [
        "setup: src/routes/+layout.svelte: imports @/components/ui/reset.css",
        "setup: src/hooks.server.ts: sets <html>'s classes from htmlStyles",
        "setup: src/routes/+layout.svelte: imports @fontsource-variable/inter",
        'setup: src/app.html: <html data-font="inter" data-pointer>',
      ].join("\n")
    )
    expect(text).not.toContain("by hand")
    expect(read(cwd, "src/routes/+layout.svelte")).toBe(
      '<script lang="ts">\n  import "@kirana-style/core/stylesheet.css"\n  import "@/components/ui/reset.css"\n  import "@fontsource-variable/inter"\n</script>\n'
    )
    expect(read(cwd, "src/hooks.server.ts")).toBe(HOOK("@/lib/kit/document"))
    expect(read(cwd, "src/app.html")).toContain(
      '<html data-pointer data-font="inter" lang="en">'
    )
    // The hook there already: left as it is, and no root document, though it writes `<html `.
    const hooked = svelteKit({
      "src/app.html": APP_HTML,
      "src/hooks.server.ts": HOOK("@/lib/kit/document"),
    })
    const again = await init(hooked, "--registry", ACME, "--pointer")
    expect(again.text).not.toContain("by hand")
    expect(again.text).not.toContain("hooks.server.ts")
    expect(again.text).toContain("setup: src/app.html: <html data-pointer>")
  })

  it("leaves a SvelteKit hook of the project's own to edit by hand, and imports SvelteKit 2's Handle from the kit (KF-113)", async () => {
    const own =
      'export const handle = ({ event, resolve }) =>\n  resolve(event, { transformPageChunk: ({ html }) => html.replace("<html", `<html data-own="${1}"`) })\n'
    const cwd = svelteKit({
      "src/app.html": APP_HTML,
      "src/hooks.server.js": own,
    })
    const { code, text } = await init(cwd, "--registry", ACME, "--pointer")
    expect(code).toBe(0)
    expect(text).toContain(
      'by hand: src/hooks.server.js: give <html> the design system\'s styles in handle\'s transformPageChunk: html.replace("<html", `<html class="${props(htmlStyles).className ?? ""}"`), with import { props } from "@kirana-style/core" and import { htmlStyles } from "@/lib/kit/document"\n'
    )
    expect(text).toContain("setup: src/app.html: <html data-pointer>\n")
    expect(read(cwd, "src/hooks.server.js")).toBe(own)
    expect(existsSync(path.join(cwd, "src/hooks.server.ts"))).toBe(false)
    // SvelteKit 2, its tsconfig mapping the alias.
    const two = svelteKit(
      {
        "tsconfig.json":
          '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }',
      },
      "^2.20.0"
    )
    expect((await init(two, "--registry", ACME)).code).toBe(0)
    expect(read(two, "src/hooks.server.ts")).toBe(
      HOOK("@/lib/kit/document", "@sveltejs/kit")
    )
    // A Svelte component that imports the stylesheet outside SvelteKit sets no classes on the server.
    const svelte = svelteKit({
      "package.json": JSON.stringify({
        dependencies: { svelte: "^5.0.0" },
        devDependencies: { vite: "^8.0.0" },
      }),
      "tsconfig.json":
        '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }',
    })
    const plain = await init(svelte, "--registry", ACME)
    expect(plain.text).toContain(
      "setup: src/routes/+layout.svelte: imports @/components/ui/reset.css\n"
    )
    expect(plain.text).toContain(
      "by hand: give <html> the design system's styles"
    )
  })

  it("adds the component files to a workspace's tsconfigs, the package's and the app's (KF-113)", async () => {
    const svelte = { svelte: "^5.0.0" }
    const top = project({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["apps/*", "packages/*"],
      }),
      "apps/web/package.json": JSON.stringify({
        type: "module",
        devDependencies: {
          "@sveltejs/kit": "^3.1.0",
          ...svelte,
          vite: "^8.0.0",
        },
      }),
      "apps/web/vite.config.ts":
        'import { sveltekit } from "@sveltejs/kit/vite"\nimport { defineConfig } from "vite"\n\nexport default defineConfig({\n  plugins: [sveltekit()],\n})\n',
      "apps/web/src/app.html": APP_HTML,
      "apps/web/src/routes/+layout.svelte":
        '<script lang="ts">\n  import "@kirana-style/core/stylesheet.css"\n</script>\n',
      "packages/ui/package.json": JSON.stringify({
        name: "@workspace/ui",
        type: "module",
        dependencies: svelte,
      }),
      "packages/ui/acme/kit.json": JSON.stringify(kit()),
      "packages/ui/acme/index.json": JSON.stringify(INDEX),
    })
    const app = path.join(top, "apps/web")
    const ui = path.join(top, "packages/ui")
    const { code, text } = await init(
      app,
      "--workspace",
      "packages/ui",
      "--registry",
      ACME
    )
    expect(code).toBe(0)
    expect(text).toContain(
      "setup: tsconfig.json: include takes src/**/*.svelte, where ui installs\n"
    )
    expect(text).toContain(
      "setup: app: tsconfig.json: include takes src/**/*.svelte, whose components import the package's\n"
    )
    expect(text).toContain(
      "setup: app: src/routes/+layout.svelte: imports @workspace/ui/components/reset.css\n"
    )
    expect(text).toContain(
      "setup: app: src/hooks.server.ts: sets <html>'s classes from htmlStyles\n"
    )
    expect(text).not.toContain("by hand")
    expect(JSON.parse(read(ui, "tsconfig.json")).include).toEqual([
      "src",
      "src/**/*.svelte",
    ])
    expect(JSON.parse(read(app, "tsconfig.json")).include).toEqual([
      "src",
      "vite.config.ts",
      "src/**/*.svelte",
    ])
    expect(read(app, "src/hooks.server.ts")).toBe(
      HOOK("@workspace/ui/lib/kit/document")
    )
    // A Vue app at its folder's root without a tsconfig, which is said, and a package whose
    // include takes its components already.
    const vue = project({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["apps/*", "packages/*"],
      }),
      "apps/web/package.json": JSON.stringify({
        type: "module",
        dependencies: { vue: "^3.5.0" },
        devDependencies: { vite: "^8.0.0" },
      }),
      "apps/web/index.html": '<html lang="en"></html>\n',
      "packages/ui/package.json": JSON.stringify({
        name: "@workspace/ui",
        type: "module",
        dependencies: { vue: "^3.5.0" },
      }),
      "packages/ui/tsconfig.json":
        '{ "compilerOptions": {}, "include": ["src/**/*.ts", "src/**/*.vue"] }',
      "packages/ui/acme/kit.json": JSON.stringify(kit()),
      "packages/ui/acme/index.json": JSON.stringify(INDEX),
    })
    const plain = await init(
      path.join(vue, "apps/web"),
      "--workspace",
      "packages/ui",
      "--registry",
      ACME
    )
    expect(plain.text).toContain(
      'by hand: app: tsconfig.json: add "@workspace/ui/*": ["../../packages/ui/src/*"] to compilerOptions.paths'
    )
    expect(plain.text).not.toContain("include takes")
  })
})

const NUXT_REFERENCES = JSON.stringify({
  files: [],
  references: [{ path: "./.nuxt/tsconfig.app.json" }],
})

describe("KF-108 ui init in a workspace (D-129)", () => {
  it("makes the workspace's package the project with --workspace, the app wired to it (KF-108, D-129)", async () => {
    const release = await version()
    const { app, ui } = turborepo()
    const { code, text, commands } = await init(
      app,
      "--workspace",
      "packages/ui",
      "--registry",
      ACME
    )
    expect(code).toBe(0)
    expect(text.split("\n")).toEqual([
      "workspace: ui installs into ../../packages/ui (@workspace/ui), as ui.workspace names it",
      "kirana: config: create kirana.config.ts",
      "app: kirana: config: create kirana.config.ts",
      "app: kirana: adapter: add @kirana-style/vite to vite.config.ts",
      "app: kirana: stylesheet: import the stylesheet in src/main.tsx",
      "app: kirana: types: create src/kirana.d.ts",
      "@acme/kit 1.0.0",
      "  + src/lib/kit/config.ts",
      "  + src/lib/kit/document.ts",
      "  + src/components/reset.css",
      'setup: tsconfig.json: paths "@workspace/ui/*": ["./src/*"], its JSX as the app\'s',
      'setup: kirana.config.ts: ui {"framework":"react","aliases":{"ui":"@workspace/ui/components","lib":"@workspace/ui/lib","component":"@workspace/ui/components","hook":"@workspace/ui/hooks"},"registries":{"@acme":"acme/{name}.json"}}',
      "setup: kirana.config.ts: spreads kitConfig (./src/lib/kit/config.ts)",
      'setup: app: tsconfig.app.json: paths "@workspace/ui/*": ["../../packages/ui/src/*"]',
      "setup: app: vite.config.ts: resolve: { tsconfigPaths: true }",
      'setup: app: kirana.config.ts: ui {"workspace":"../../packages/ui"}',
      "setup: app: kirana.config.ts: spreads kitConfig (../../packages/ui/src/lib/kit/config.ts)",
      "setup: app: src/main.tsx: imports @workspace/ui/components/reset.css",
      "setup: app: src/main.tsx: sets <html>'s classes from htmlStyles",
      "packages: npm install --save-exact @kirana-style/core@0.3.2",
      "packages: app: npm install --save-exact @kirana-style/core@0.3.2",
      `packages: app: npm install --save-exact -D kirana-style@${release} @kirana-style/vite@${release} @kirana-style/registry@${release}`,
      "kirana-style.lock.json: 1 item(s) recorded",
      "",
    ])
    // The package's packages in the package, the app's in the app, at one core.
    expect(commands).toEqual([
      "npm install --save-exact @kirana-style/core@0.3.2",
      "npm install --save-exact @kirana-style/core@0.3.2",
      `npm install --save-exact -D kirana-style@${release} @kirana-style/vite@${release} @kirana-style/registry@${release}`,
    ])
    expect(read(ui, "kirana.config.ts")).toBe(
      [
        'import { defineConfig } from "@kirana-style/core/config"',
        'import { kitConfig } from "./src/lib/kit/config.ts"',
        "",
        "export default defineConfig({",
        "  ...kitConfig,",
        "  ui: {",
        '    "framework": "react",',
        '    "aliases": {',
        '      "ui": "@workspace/ui/components",',
        '      "lib": "@workspace/ui/lib",',
        '      "component": "@workspace/ui/components",',
        '      "hook": "@workspace/ui/hooks"',
        "    },",
        '    "registries": {',
        '      "@acme": "acme/{name}.json"',
        "    }",
        "  },",
        "})",
        "",
      ].join("\n")
    )
    expect(JSON.parse(read(ui, "tsconfig.json"))).toEqual({
      compilerOptions: {
        jsx: "react-jsx",
        paths: { "@workspace/ui/*": ["./src/*"] },
      },
      include: ["src"],
    })
    expect(read(app, "kirana.config.ts")).toBe(
      [
        'import { defineConfig } from "@kirana-style/core/config"',
        'import { kitConfig } from "../../packages/ui/src/lib/kit/config.ts"',
        "",
        "export default defineConfig({",
        "  ...kitConfig,",
        "  ui: {",
        '    "workspace": "../../packages/ui"',
        "  },",
        "})",
        "",
      ].join("\n")
    )
    expect(read(app, "tsconfig.app.json")).toContain(
      '"compilerOptions": {\n    "paths": { "@workspace/ui/*": ["../../packages/ui/src/*"] },'
    )
    const entry = read(app, "src/main.tsx")
    expect(entry).toContain("import '@workspace/ui/components/reset.css'")
    expect(entry).toContain(
      "import { htmlStyles } from '@workspace/ui/lib/kit/document'"
    )
    expect(Object.keys(readLockfile(ui).items)).toEqual(["@acme/kit"])
    expect(existsSync(path.join(app, "kirana-style.lock.json"))).toBe(false)

    // Run again, the app's ui.workspace names the package: nothing new for the app's configuration.
    const again = await init(app, "--registry", ACME, "--dry-run")
    expect(again.code).toBe(0)
    expect(again.text).toContain(
      "workspace: ui installs into ../../packages/ui (@workspace/ui)"
    )
    expect(again.text).not.toContain('app: kirana.config.ts: ui {"workspace"')
    expect(
      (await init(app, "--workspace", "packages/ui", "--dry-run")).code
    ).toBe(0)
  })

  it("installs a preset's fonts' packages in the app, which imports their stylesheets (KF-111, D-129)", async () => {
    const release = await version()
    const font = (name: string): Item => ({
      name: `font-${name}`,
      type: "font",
      version: "1.0.0",
      dependencies: { [`@fontsource-variable/${name}`]: "^5.2.0" },
      font: {
        family: `'${name} Variable'`,
        import: `@fontsource-variable/${name}`,
      },
    })
    const design = {
      axes: {
        font: {
          attribute: "data-font",
          values: ["inter", "lora"],
          items: { inter: "font-inter", lora: "font-lora" },
        },
        fontHeading: {
          attribute: "data-font-heading",
          values: ["inherit", "lora"],
          items: { lora: "font-lora" },
        },
      },
      presets: {
        k: [
          { axis: "font", values: ["inter", "lora"], bits: 1 },
          { axis: "fontHeading", values: ["inherit", "lora"], bits: 1 },
        ],
      },
    }
    // The app lists Lora already, the package neither: only Inter is missing, and from the app.
    const { app, ui } = turborepo(
      {
        "package.json": JSON.stringify({
          type: "module",
          dependencies: {
            react: "^19.0.0",
            "react-dom": "^19.0.0",
            "@fontsource-variable/lora": "^5.2.0",
          },
          devDependencies: { vite: "^8.0.0", "@vitejs/plugin-react": "^6.0.0" },
        }),
      },
      {
        "acme/kit.json": JSON.stringify({ ...kit(), design }),
        "acme/font-inter.json": JSON.stringify(font("inter")),
        "acme/font-lora.json": JSON.stringify(font("lora")),
      }
    )
    let text = ""
    const ran: [string, string][] = []
    const code = await main(
      [
        "init",
        "--no-check",
        "--workspace",
        "packages/ui",
        "--registry",
        ACME,
        "--preset",
        "k2",
      ],
      app,
      (chunk) => void (text += chunk),
      { run: (command, cwd) => (ran.push([command, cwd]), 0), load }
    )
    expect(code).toBe(0)
    expect(text).toContain(
      "setup: app: src/main.tsx: imports @fontsource-variable/inter\n"
    )
    expect(text).toContain(
      "packages: app: npm install @fontsource-variable/inter@^5.2.0\n"
    )
    expect(ran).toEqual([
      ["npm install --save-exact @kirana-style/core@0.3.2", ui],
      ["npm install --save-exact @kirana-style/core@0.3.2", app],
      [
        `npm install --save-exact -D kirana-style@${release} @kirana-style/vite@${release} @kirana-style/registry@${release}`,
        app,
      ],
      ["npm install @fontsource-variable/inter@^5.2.0", app],
    ])
    const entry = read(app, "src/main.tsx")
    expect(entry).toContain("import '@fontsource-variable/inter'")
    expect(entry).toContain("import '@fontsource-variable/lora'")
    // The items stay the package's, the fonts among them.
    expect(Object.keys(readLockfile(ui).items)).toEqual([
      "@acme/font-inter",
      "@acme/font-lora",
      "@acme/kit",
    ])
  })

  it("maps the package's aliases where each tsconfig has its paths, and makes the package's config a module's (D-129)", async () => {
    // A package with a tsconfig and paths of its own, an app whose tsconfig has paths, and Vite
    // reading them already.
    const { app, ui } = turborepo(
      {
        "tsconfig.json":
          '{ "compilerOptions": { "jsx": "react-jsx", "paths": { "@/*": ["./src/*"] } }, "include": ["src"] }',
        "tsconfig.app.json": undefined,
        "vite.config.ts":
          "import { defineConfig } from 'vite'\n\nexport default defineConfig({ resolve: { tsconfigPaths: true } })\n",
      },
      {
        "package.json": JSON.stringify({ name: "@acme/ui" }),
        "tsconfig.json":
          '{ "compilerOptions": { "strict": true, "paths": {} }, "include": ["."] }',
      }
    )
    const { code, text } = await init(
      app,
      "--workspace",
      "packages/ui",
      "--registry",
      ACME,
      "--dry-run"
    )
    expect(code).toBe(0)
    expect(text).toContain("kirana: config: create kirana.config.mts\n")
    expect(text).toContain(
      'setup: tsconfig.json: paths "@acme/ui/*": ["./src/*"]\n'
    )
    expect(text).toContain(
      'setup: app: tsconfig.json: paths "@acme/ui/*": ["../../packages/ui/src/*"]\n'
    )
    expect(text).not.toContain("tsconfigPaths")
    expect(existsSync(path.join(ui, "kirana.config.mts"))).toBe(false)

    // A package that maps its aliases already, and an app without a tsconfig, which is told.
    const mapped = turborepo(
      { "tsconfig.json": undefined, "tsconfig.app.json": undefined },
      {
        "package.json": JSON.stringify({
          name: "@workspace/ui",
          dependencies: { "@kirana-style/core": "0.3.2" },
        }),
        "tsconfig.json":
          '{ "compilerOptions": { "paths": { "@workspace/ui/*": ["./lib/*"] } } }',
      }
    )
    const told = await init(
      mapped.app,
      "--workspace",
      "packages/ui",
      "--registry",
      ACME,
      "--dry-run"
    )
    expect(told.code).toBe(0)
    expect(told.text).toContain("  + lib/components/reset.css\n")
    // The package lists the core already: nothing to install there.
    expect(told.text).not.toMatch(/^packages: npm/m)
    expect(told.text).not.toContain("setup: tsconfig.json")
    expect(told.text).toContain(
      'by hand: app: tsconfig.json: add "@workspace/ui/*": ["../../packages/ui/src/*"] to compilerOptions.paths, so the app resolves the package\'s files\n'
    )

    // A package with no tsconfig, beside an app with none either: no JSX options to take.
    const bare = turborepo({
      "tsconfig.json": undefined,
      "tsconfig.app.json": undefined,
    })
    const created = await init(
      bare.app,
      "--workspace",
      "packages/ui",
      "--registry",
      ACME
    )
    expect(created.code).toBe(0)
    expect(JSON.parse(read(bare.ui, "tsconfig.json"))).toEqual({
      compilerOptions: { paths: { "@workspace/ui/*": ["./src/*"] } },
      include: ["src"],
    })

    // A Solid app whose tsconfig references a folder's: the package takes its JSX import source.
    const solid = turborepo({
      "package.json": JSON.stringify({
        type: "module",
        dependencies: { "solid-js": "^1.9.0" },
        devDependencies: { vite: "^8.0.0" },
      }),
      "tsconfig.json": '{ "files": [], "references": [{ "path": "./web" }] }',
      "tsconfig.app.json": undefined,
      "web/tsconfig.json":
        '{ "compilerOptions": { "jsx": "preserve", "jsxImportSource": "solid-js" } }',
    })
    const sourced = await init(
      solid.app,
      "--workspace",
      "packages/ui",
      "--registry",
      ACME,
      "--dry-run"
    )
    expect(sourced.code).toBe(0)
    expect(sourced.text).toContain(
      'setup: app: web/tsconfig.json: paths "@workspace/ui/*": ["../../packages/ui/src/*"]\n'
    )
  })

  it("gives a JavaScript Next.js app in a workspace Next.js's tsconfig with the package's aliases (KF-046)", async () => {
    const { app } = turborepo({
      "package.json": JSON.stringify({
        dependencies: { next: "^16.0.0", react: "19", "react-dom": "19" },
      }),
      "vite.config.ts": undefined,
      "tsconfig.json": undefined,
      "tsconfig.app.json": undefined,
      "tsconfig.node.json": undefined,
      "index.html": undefined,
      "src/main.tsx": undefined,
      "src/App.tsx": undefined,
      "app/layout.jsx":
        'export default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  )\n}\n',
    })
    const { code, text } = await init(
      app,
      "--workspace",
      "packages/ui",
      "--registry",
      ACME,
      "--dry-run"
    )
    expect(code).toBe(0)
    expect(text).toContain(
      "setup: app: tsconfig.json: Next.js's compiler options, as `next` would write them\n"
    )
    expect(text).toContain(
      'setup: app: tsconfig.json: paths "@workspace/ui/*": ["../../packages/ui/src/*"]\n'
    )
    expect(text).toContain(
      "setup: app: app/layout.jsx: <html sx={htmlStyles}>\n"
    )
  })

  it("keeps what it wrote when the app's packages fail to install (D-129)", async () => {
    const { app, ui } = turborepo()
    let text = ""
    const code = await main(
      ["init", "--workspace", "packages/ui", "--registry", ACME],
      app,
      (chunk) => void (text += chunk),
      { run: (_, cwd) => (cwd === app ? 1 : 0), load }
    )
    expect(code).toBe(1)
    expect(text).toContain(
      "failed: the files are written, the lockfile is not\n"
    )
    expect(existsSync(path.join(ui, "src/lib/kit/config.ts"))).toBe(true)
    expect(existsSync(path.join(ui, "kirana-style.lock.json"))).toBe(false)
  })

  it("stops on a --workspace it cannot take (D-129)", async () => {
    const lone = vite()
    const outside = await init(lone, "--workspace", "packages/ui")
    expect(outside.code).toBe(2)
    expect(outside.text).toContain(
      "--workspace packages/ui needs a workspace: no package.json with workspaces, nor a pnpm-workspace.yaml"
    )
    const { top, app } = turborepo()
    const atTop = await init(top, "--workspace", "packages/ui")
    expect(atTop.code).toBe(2)
    expect(atTop.text).toContain(
      "--workspace runs in the app that imports the package (apps/web), not at the workspace's root"
    )
    const missing = await init(app, "--workspace", "packages/none")
    expect(missing.code).toBe(2)
    expect(missing.text).toContain(
      "packages/none/package.json: a workspace package needs its name"
    )
    expect(
      (await init(app, "--workspace", "packages/ui", "--registry", ACME)).code
    ).toBe(0)
    const other = await init(app, "--workspace", "packages/other")
    expect(other.code).toBe(2)
    expect(other.text).toContain(
      "kirana.config.ts: ui.workspace names packages/ui, not packages/other"
    )
    // pnpm's workspace file marks the root as well.
    const pnpm = turborepo({}, {})
    writeFileSync(path.join(pnpm.top, "package.json"), "{}")
    writeFileSync(
      path.join(pnpm.top, "pnpm-workspace.yaml"),
      "packages:\n  - apps/*\n  - packages/*\n"
    )
    expect(
      (
        await init(
          pnpm.app,
          "--workspace",
          "packages/ui",
          "--registry",
          ACME,
          "--dry-run"
        )
      ).code
    ).toBe(0)
  })

  it("checks what it wrote in the package with the package's configuration (D-129)", async () => {
    const { app, ui } = turborepo()
    withCore(ui)
    let text = ""
    const code = await main(
      ["init", "--workspace", "packages/ui", "--registry", ACME],
      app,
      (chunk) => void (text += chunk),
      { run: () => 0, load }
    )
    expect(text).toContain("check: kirana-style check on 2 file(s)\n")
    expect(text).toContain("0 diagnostic(s), 0 error(s)\n")
    expect(code).toBe(0)
  })
})
