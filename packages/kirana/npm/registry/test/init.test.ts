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
  return project({
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
  })
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

function project(files: Record<string, string>): string {
  const directory = mkdtempSync(path.join(root, "project-"))
  for (const [name, text] of Object.entries(files)) {
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
    // No root document the CLI can write (Nuxt, Astro, Laravel, Rails), or two layouts: said.
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
    const resolved = vite({
      "vite.config.ts":
        "import { defineConfig } from 'vite'\n\nexport default defineConfig({ resolve: { alias: {} } })\n",
    })
    expect((await init(resolved, "--registry", ACME)).text).toContain(
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
