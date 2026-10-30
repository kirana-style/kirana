import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, describe, expect, it } from "vite-plus/test"

import { hashOf } from "../src/check.ts"
import { main } from "../src/index.ts"
import { readLockfile } from "../src/lockfile.ts"
import {
  attributeList,
  decodePreset,
  documentOf,
  optionAttributes,
  rendersHtml,
  setUi,
  settingsOf,
  withAttributes,
} from "../src/preset.ts"
import type { Design, Item, RegistryFile } from "../src/types.ts"

const root = mkdtempSync(path.join(tmpdir(), "kirana-registry-preset-"))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const file = (
  where: string,
  content: string,
  type: RegistryFile["type"] = "ui"
): RegistryFile => ({ path: where, type, content, hash: hashOf(content) })

/** Two styles, two colours; a layout `k` of every field the installer reads, and one it ignores. */
const DESIGN: Design = {
  axes: {
    style: { attribute: "data-style", values: ["nova", "vega"] },
    color: { attribute: "data-color", values: ["neutral", "stone"] },
  },
  flatten: "style",
  presets: {
    k: [
      { axis: "style", values: ["nova", "vega"], bits: 2 },
      { axis: "color", values: ["neutral", "stone"], bits: 2 },
      { axis: "base", values: ["base", "aria", "radix"], bits: 2 },
      { axis: "framework", values: ["react", "jquery"], bits: 2 },
      { axis: "iconLibrary", values: ["lucide", "hugeicons"], bits: 1 },
      { axis: "unknown", values: ["x"], bits: 1 },
    ],
  },
}

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
/** A `k` code from field indexes, as a design system's site writes one. */
function code(
  style: number,
  color: number,
  base = 0,
  framework = 0,
  icons = 0
): string {
  let value = style + color * 4 + base * 16 + framework * 64 + icons * 256
  let digits = ""
  do {
    digits = BASE62[value % 62] + digits
    value = Math.floor(value / 62)
  } while (value > 0)
  return `k${digits}`
}

const KIT: Item = {
  name: "kit",
  type: "design-system",
  version: "1.0.0",
  design: DESIGN,
  files: [file("kit/tokens.ts", "export const tokens = {}\n", "lib")],
}

/** A component flattened for each style and base, its markup per base, an icon in it. */
const build = (style: string, base: string) => [
  file("button.styles.ts", `export const button = "${style} ${base}"\n`),
]
const BUTTON: Item = {
  name: "button",
  type: "component",
  version: "1.0.0",
  registryDependencies: ["kit", "shared"],
  styles: [file("button.styles.ts", 'export const button = "every style"\n')],
  flattened: {
    axis: "style",
    builds: {
      nova: { base: build("nova", "base"), aria: build("nova", "aria") },
      vega: { base: build("vega", "base"), aria: build("vega", "aria") },
    },
  },
  frameworks: {
    react: {
      base: {
        files: [
          file(
            "button.tsx",
            '<IconPlaceholder lucide="CheckIcon" hugeicons="Tick02Icon" />\n'
          ),
        ],
      },
      aria: { files: [file("button-aria.tsx", "aria\n")] },
    },
  },
}
/** Style modules alone, flattened for every base: the project's base decides. */
const SHARED: Item = {
  name: "shared",
  type: "lib",
  version: "1.0.0",
  styles: [file("shared.styles.ts", "every\n")],
  flattened: {
    axis: "style",
    builds: { vega: { base: [file("shared.styles.ts", "vega base\n")] } },
  },
}

/** A project with the kit and the button installed from `@acme`, with these settings. */
async function installed(
  ui: Record<string, unknown> = { base: "base" },
  extra: Record<string, string> = {}
) {
  const cwd = mkdtempSync(path.join(root, "project-"))
  const files: Record<string, string> = {
    "package.json":
      '{ "dependencies": { "react": "19", "lucide-react": "1" } }',
    "tsconfig.json":
      '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }',
    "index.html": '<!doctype html>\n<html lang="en"><body></body></html>\n',
    "kirana.config.json": JSON.stringify({
      ui: { registries: { "@acme": "acme/{name}.json" }, ...ui },
    }),
    "acme/kit.json": JSON.stringify(KIT),
    "acme/button.json": JSON.stringify(BUTTON),
    "acme/shared.json": JSON.stringify(SHARED),
    ...extra,
  }
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true })
    writeFileSync(path.join(cwd, name), text)
  }
  expect((await run(cwd, "add", "@acme/button", "--no-check")).code).toBe(0)
  return cwd
}

async function run(cwd: string, ...argv: string[]) {
  let text = ""
  const commands: string[] = []
  const exit = await main(argv, cwd, (chunk) => void (text += chunk), {
    run: (command) => (commands.push(command), 0),
  })
  return { code: exit, text, commands }
}

const read = (cwd: string, name: string) =>
  readFileSync(path.join(cwd, name), "utf8")

describe("D-110 a design system's preset codes", () => {
  it("decode with the layout their first letter names, an index past a list reading as its first", () => {
    expect(decodePreset(code(1, 1, 1, 0, 1), DESIGN)).toEqual({
      style: "vega",
      color: "stone",
      base: "aria",
      framework: "react",
      iconLibrary: "hugeicons",
      unknown: "x",
    })
    expect(decodePreset("k3", DESIGN)!.style).toBe("nova")
    expect(decodePreset("b0", DESIGN)).toBeUndefined()
    expect(decodePreset("k", DESIGN)).toBeUndefined()
    expect(decodePreset("k-1", DESIGN)).toBeUndefined()
    expect(decodePreset("", { axes: DESIGN.axes })).toBeUndefined()
    expect(decodePreset("", DESIGN)).toBeUndefined()
  })

  it("give the design's axes, and the framework, base and icon library they name", () => {
    expect(
      settingsOf(decodePreset(code(1, 1, 1, 0, 1), DESIGN)!, DESIGN)
    ).toEqual({
      design: { style: "vega", color: "stone" },
      framework: "react",
      base: "aria",
      iconLibrary: "hugeicons",
    })
    expect(
      settingsOf({ framework: "jquery", iconLibrary: "emoji" }, DESIGN)
    ).toEqual({ design: {} })
  })
})

describe("D-110 the settings and the document a preset writes", () => {
  it("set ui's keys in a configuration module, leaving the rest as written", () => {
    const text = `export default defineConfig({
  ...kitConfig,
  ui: {
    "registries": { "@acme": "acme/{name}.json", "design": "a string, not the key" },
    // a comment, }
    base: 'base', // the base
    note: \`a { template }\`,
  },
})
`
    const set = setUi(text, { base: "aria", design: { style: "vega" } })!
    expect(set).toContain('base: "aria", // the base')
    expect(set).toContain('ui: {\n    design: {\n      "style": "vega"\n    },')
    expect(set).toContain('"design": "a string, not the key"')
    expect(set).toContain("note: `a { template }`")
    expect(
      setUi(
        'ui: { /* first */ framework: "react", other: { a: 1 /* } */ }, /* last */ }',
        {
          framework: "vue",
          other: 2,
        }
      )
    ).toBe('ui: { /* first */ framework: "vue", other: 2, /* last */ }')
    expect(setUi("ui: { a: 1 /* unclosed", { b: 1 })).toContain("b: 1,")
    expect(setUi("ui: { a: 1 } // the end", { a: 2 })).toBe(
      "ui: { a: 2 } // the end"
    )
    expect(setUi('ui: { a: "x \\" y", b: 1 // to the end', { b: 2 })).toBe(
      'ui: { a: "x \\" y", b: 2 // to the end'
    )
    expect(setUi("ui: { // unclosed", { a: 1 })).toContain("a: 1,")
    expect(setUi("ui: { /* unclosed", { a: 1 })).toContain("a: 1,")
    expect(setUi("export default {}", { base: "aria" })).toBeUndefined()
    expect(setUi("ui: { base: 'base'", { base: "aria" })).toBe(
      'ui: { base: "aria"'
    )
  })

  it("set <html>'s attributes, replacing the ones it has", () => {
    expect(
      withAttributes(
        '<html sx={htmlStyles} data-style="nova" lang="en">\n<body />',
        { "data-style": "vega", "data-color": "stone" }
      )
    ).toBe(
      '<html data-color="stone" sx={htmlStyles} data-style="vega" lang="en">\n<body />'
    )
  })

  it("set the project options on <html>, in whatever form the tag has them (KF-077)", () => {
    expect(
      withAttributes("<html lang='en'>", { "data-pointer": "", dir: "rtl" })
    ).toBe("<html dir=\"rtl\" data-pointer lang='en'>")
    // Bare, single-quoted, a JSX expression: replaced in place, never doubled.
    expect(
      withAttributes("<html data-pointer dir='ltr' lang=\"en\">", {
        "data-pointer": "",
        dir: "rtl",
      })
    ).toBe('<html data-pointer dir="rtl" lang="en">')
    expect(
      withAttributes("<html data-pointer={true} dir={dir}>", {
        "data-pointer": undefined,
        dir: undefined,
      })
    ).toBe("<html>")
    // A longer name that starts the same is another attribute; taking off one it lacks changes nothing.
    expect(
      withAttributes('<html dirname="x" />', {
        dir: undefined,
        "data-pointer": "",
      })
    ).toBe('<html data-pointer dirname="x" />')
    expect(
      attributeList({
        "data-style": "vega",
        "data-pointer": "",
        dir: undefined,
      })
    ).toBe('data-style="vega" data-pointer without dir')
    expect(optionAttributes(new Set(["--pointer", "--no-rtl"]))).toEqual({
      "data-pointer": "",
      dir: undefined,
    })
    expect(optionAttributes(new Set())).toEqual({})
    expect(optionAttributes(new Set(["--rtl", "--no-rtl"]))).toBe(
      "--rtl and --no-rtl contradict each other"
    )
  })

  it("find the document: a layout that renders <html>, else index.html", () => {
    const at = (files: Record<string, string>) => {
      const cwd = mkdtempSync(path.join(root, "document-"))
      for (const [name, text] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true })
        writeFileSync(path.join(cwd, name), text)
      }
      const found = documentOf(cwd)
      return found && path.relative(cwd, found)
    }
    expect(at({ "app/layout.tsx": "<html>", "index.html": "<html>" })).toBe(
      path.join("app", "layout.tsx")
    )
    expect(at({ "index.html": "<html>" })).toBe("index.html")
    // A module that only mentions <html> in its comments renders none.
    expect(
      at({
        "app/layout.tsx": "<html>",
        "lib/kit/document.ts":
          "/** What `<html>` takes. */\n// on <html>\nexport const a = 1",
      })
    ).toBe(path.join("app", "layout.tsx"))
    expect(rendersHtml("// <html> to the end")).toBe(false)
    expect(rendersHtml("/* <html> unclosed")).toBe(false)
    expect(at({ "a.tsx": "<html>", "b.tsx": "<html>" })).toBeUndefined()
    expect(at({})).toBeUndefined()
    // The Angular CLI's page, then SvelteKit's, where the root has no index.html (KF-077).
    expect(at({ "src/index.html": "<html>", "src/app.html": "<html>" })).toBe(
      path.join("src", "index.html")
    )
    expect(at({ "src/app.html": "<html>" })).toBe(path.join("src", "app.html"))
    expect(at({ "index.html": "<html>", "src/app.html": "<html>" })).toBe(
      "index.html"
    )
  })
})

describe("D-110 kirana-style ui add takes the registry's flattening", () => {
  it("for the project's design and base, and the modules as written for a design it did not build", async () => {
    const cwd = await installed({ base: "base", design: { style: "vega" } })
    expect(read(cwd, "src/components/ui/button.styles.ts")).toBe(
      'export const button = "vega base"\n'
    )
    expect(read(cwd, "src/components/ui/shared.styles.ts")).toBe("vega base\n")
    const locked = readLockfile(cwd).items
    expect(locked["@acme/button"]!.design).toBe("style=vega")
    expect(locked["@acme/kit"]!.design).toBeUndefined()
    const unbuilt = await installed({ base: "base", design: { style: "maia" } })
    expect(read(unbuilt, "src/components/ui/button.styles.ts")).toBe(
      'export const button = "every style"\n'
    )
    // A design, but no base for an item without markup: as written.
    const baseless = await installed(
      { framework: "react", design: { style: "vega" } },
      {
        "acme/button.json": JSON.stringify({
          ...BUTTON,
          frameworks: undefined,
        }),
      }
    )
    expect(read(baseless, "src/components/ui/shared.styles.ts")).toBe("every\n")
  })
})

describe("KRN-DX-032 kirana-style ui preset", () => {
  it("writes the design, sets <html>'s attributes, and places every item again", async () => {
    const cwd = await installed()
    const vegaAria = code(1, 1, 1, 0, 1)
    const { code: exit, text, commands } = await run(cwd, "preset", vegaAria)
    expect(exit).toBe(0)
    expect(text).toContain(`${vegaAria}: style vega, color stone, base aria\n`)
    expect(text).toContain("@acme/button · style=vega · react/aria\n")
    expect(text).toContain("  + src/components/ui/button.styles.ts\n")
    expect(text).toContain("  + src/components/ui/button-aria.tsx\n")
    expect(text).toContain("  - src/components/ui/button.tsx\n")
    expect(text).toContain(
      'document: index.html: <html> data-style="vega" data-color="stone"\n'
    )
    expect(text).toContain("check: kirana-style check on")
    expect(commands).toEqual([])
    expect(read(cwd, "src/components/ui/button.styles.ts")).toBe(
      'export const button = "vega aria"\n'
    )
    expect(read(cwd, "index.html")).toContain(
      '<html data-color="stone" data-style="vega" lang="en">'
    )
    const config = JSON.parse(read(cwd, "kirana.config.json"))
    expect(config.ui).toMatchObject({
      base: "aria",
      framework: "react",
      iconLibrary: "hugeicons",
      design: { style: "vega", color: "stone" },
    })
    expect(readLockfile(cwd).items["@acme/button"]).toMatchObject({
      base: "aria",
      design: "style=vega",
    })
    // The same code again changes nothing.
    const again = await run(cwd, "preset", vegaAria, "--no-check")
    expect(again.text).not.toContain("  + ")
  })

  it("installs the font a code's value names, and leaves one no value names for remove (KF-050)", async () => {
    const font = (name: string, files: RegistryFile[] = []): Item => ({
      name: `font-${name}`,
      type: "font",
      version: "1.0.0",
      dependencies: { [`@fontsource/${name}`]: "^5.0.0" },
      font: { family: name, import: `@fontsource/${name}` },
      files,
    })
    const values = ["inter", "lora", "serif", "gone"]
    const fonted: Item = {
      ...KIT,
      design: {
        ...DESIGN,
        axes: {
          ...DESIGN.axes,
          font: {
            attribute: "data-font",
            values,
            items: {
              inter: "font-inter",
              lora: "@acme/font-lora",
              serif: "font-serif",
              gone: "font-gone",
            },
          },
        },
        // style from bit 0, font from bit 1: f0 inter, f2 lora, f4 serif, f6 gone.
        presets: {
          f: [
            { axis: "style", values: ["nova", "vega"], bits: 1 },
            { axis: "font", values, bits: 2 },
          ],
        },
      },
    }
    const cwd = await installed(
      { base: "base" },
      {
        "acme/kit.json": JSON.stringify(fonted),
        "acme/font-inter.json": JSON.stringify(font("inter")),
        "acme/font-lora.json": JSON.stringify(font("lora")),
        "acme/font-serif.json": JSON.stringify(
          font("serif", [
            {
              ...file("serif.css", "@font-face {}\n", "file"),
              target: "src/serif.css",
            },
          ])
        ),
        "src/main.ts": 'import "@kirana-style/core/stylesheet.css"\n',
        "src/serif.css": "/* mine */\n",
      }
    )
    const inter = await run(cwd, "preset", "f0", "--no-check")
    expect(inter.code).toBe(0)
    expect(inter.text).toContain("@acme/font-inter 1.0.0\n")
    expect(inter.text).toContain(
      "font: src/main.ts: imports @fontsource/inter\n"
    )
    expect(inter.commands).toEqual(["npm install @fontsource/inter@^5.0.0"])
    expect(read(cwd, "src/main.ts")).toContain('import "@fontsource/inter"')
    expect(readLockfile(cwd).items["@acme/font-inter"]).toBeDefined()
    const lora = await run(cwd, "preset", "f2", "--no-check")
    expect(lora.text).toContain("@acme/font-lora 1.0.0\n")
    expect(lora.text).toContain(
      "unused: @acme/font-inter, which no value names now: kirana-style ui remove @acme/font-inter\n"
    )
    // The four installed, and the one added.
    expect(lora.text).toContain("kirana-style.lock.json: 5 item(s) recorded\n")
    // A file the project has stops it, unless --overwrite; an item the registry lacks stops it too.
    const serif = await run(cwd, "preset", "f4", "--no-check")
    expect(serif.code).toBe(1)
    expect(serif.text).toContain("  ! src/serif.css\n")
    expect(read(cwd, "src/serif.css")).toBe("/* mine */\n")
    const overwritten = await run(cwd, "preset", "f4", "--overwrite")
    expect(overwritten.code).toBe(0)
    expect(read(cwd, "src/serif.css")).toBe("@font-face {}\n")
    const gone = await run(cwd, "preset", "f6", "--no-check")
    expect(gone.code).toBe(1)
    expect(gone.text).toContain("acme/font-gone.json")
    // No script imports Kirana's stylesheet: the import is a step by hand.
    const bare = await installed(
      { base: "base" },
      {
        "acme/kit.json": JSON.stringify(fonted),
        "acme/font-inter.json": JSON.stringify(font("inter")),
      }
    )
    expect((await run(bare, "preset", "f0", "--no-check")).text).toContain(
      `by hand: import "@fontsource/inter" after Kirana's stylesheet\n`
    )
  })

  it("redraws icons with the library a code names, adding its packages", async () => {
    const cwd = await installed()
    const { commands } = await run(
      cwd,
      "preset",
      code(0, 0, 0, 0, 1),
      "--no-check"
    )
    expect(commands).toEqual([
      "npm install @hugeicons/core-free-icons @hugeicons/react",
    ])
    expect(read(cwd, "src/components/ui/button.tsx")).toContain(
      "<HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />"
    )
  })

  it("stops at a file the project changed, writes nothing on a dry run, and sets a TypeScript configuration", async () => {
    const cwd = await installed()
    rmSync(path.join(cwd, "kirana.config.json"))
    writeFileSync(
      path.join(cwd, "kirana.config.mjs"),
      'export default { ui: { base: "base", registries: { "@acme": "acme/{name}.json" } } }\n'
    )
    writeFileSync(
      path.join(cwd, "src/components/ui/button.styles.ts"),
      "mine\n"
    )
    const vega = code(1, 0)
    let text = ""
    const exit = await main(
      ["preset", vega],
      cwd,
      (chunk) => void (text += chunk),
      {
        run: () => 0,
        load: (url) => import(url),
      }
    )
    expect(exit).toBe(1)
    expect(text).toContain(
      "  ! src/components/ui/button.styles.ts: you and the registry both changed it\n"
    )
    expect(text).toMatch(
      /1 file\(s\) you changed would change: nothing written; --overwrite replaces them\n$/
    )
    const dry = await main(
      ["preset", vega, "--overwrite", "--dry-run"],
      cwd,
      () => {},
      { run: () => 0, load: (url) => import(url) }
    )
    expect(dry).toBe(0)
    expect(read(cwd, "src/components/ui/button.styles.ts")).toBe("mine\n")
    expect(
      await main(["preset", vega, "--overwrite", "--no-check"], cwd, () => {}, {
        run: () => 0,
        load: (url) => import(url),
      })
    ).toBe(0)
    expect(read(cwd, "kirana.config.mjs")).toContain(
      'design: {\n      "style": "vega",'
    )
  })

  it("keeps the framework the project has, and a layout without a base or framework sets neither", async () => {
    const cwd = await installed()
    // Field `framework` decodes as jquery, which no project is: the installed framework stays.
    const { code: exit } = await run(
      cwd,
      "preset",
      code(1, 0, 0, 1),
      "--no-check"
    )
    expect(exit).toBe(0)
    expect(JSON.parse(read(cwd, "kirana.config.json")).ui).not.toHaveProperty(
      "framework"
    )
    const styleOnly = await installed(
      { base: "base" },
      {
        "acme/kit.json": JSON.stringify({
          ...KIT,
          design: {
            ...DESIGN,
            presets: {
              s: [{ axis: "style", values: ["nova", "vega"], bits: 1 }],
            },
          },
        }),
      }
    )
    const { text } = await run(styleOnly, "preset", "s1", "--no-check")
    expect(text).toContain("s1: style vega\n")
    expect(JSON.parse(read(styleOnly, "kirana.config.json")).ui).toEqual({
      registries: { "@acme": "acme/{name}.json" },
      base: "base",
      design: { style: "vega" },
    })
  })

  it("checks what it wrote", async () => {
    const wrong = {
      ...BUTTON,
      flattened: {
        axis: "style",
        builds: {
          vega: {
            base: [
              file(
                "button.styles.ts",
                'import { css } from "@kirana-style/core"\nexport const button = css({ colour: "red" })\n'
              ),
            ],
          },
        },
      },
    }
    const cwd = await installed(
      { base: "base" },
      { "acme/button.json": JSON.stringify(wrong) }
    )
    const { code: exit, text } = await run(cwd, "preset", code(1, 0))
    expect(exit).toBe(1)
    expect(text).toContain("unknown-property")
  })

  it("sets --pointer and --rtl on <html> once, takes them off, and says where it cannot (KF-077)", async () => {
    const cwd = await installed()
    const on = await run(
      cwd,
      "preset",
      code(1, 0),
      "--pointer",
      "--rtl",
      "--no-check"
    )
    expect(on.code).toBe(0)
    expect(on.text).toContain(
      'document: index.html: <html> data-style="vega" data-color="neutral" data-pointer dir="rtl"\n'
    )
    expect(on.text).toContain(
      'by hand: dir="rtl" is on <html>: give your components\' library the direction too'
    )
    const document =
      '<html dir="rtl" data-pointer data-color="neutral" data-style="vega" lang="en">'
    expect(read(cwd, "index.html")).toContain(document)
    // Already set: the same document again.
    await run(cwd, "preset", code(1, 0), "--pointer", "--rtl", "--no-check")
    expect(read(cwd, "index.html")).toContain(document)
    // A code alone leaves them as they are.
    await run(cwd, "preset", code(1, 0), "--no-check")
    expect(read(cwd, "index.html")).toContain(document)
    const off = await run(
      cwd,
      "preset",
      code(1, 0),
      "--no-pointer",
      "--no-rtl",
      "--no-check"
    )
    expect(off.text).toContain(
      'document: index.html: <html> data-style="vega" data-color="neutral" without data-pointer without dir\n'
    )
    expect(off.text).not.toContain("DirectionProvider")
    expect(read(cwd, "index.html")).toContain(
      '<html data-color="neutral" data-style="vega" lang="en">'
    )
    // No <html> to write to: the step by hand names every attribute.
    rmSync(path.join(cwd, "index.html"))
    const missing = await run(
      cwd,
      "preset",
      code(1, 0),
      "--pointer",
      "--no-check"
    )
    expect(missing.code).toBe(0)
    expect(missing.text).toContain(
      'by hand: set <html>\'s attributes, as no layout or HTML page renders it: data-style="vega" data-color="neutral" data-pointer\n'
    )
    expect(
      await run(cwd, "preset", code(1, 0), "--pointer", "--no-pointer")
    ).toMatchObject({
      code: 2,
      text: "kirana-style ui preset: --pointer and --no-pointer contradict each other\n",
    })
  })

  it("says what it cannot do", async () => {
    const cwd = await installed()
    const fails = async (...argv: string[]) => await run(cwd, "preset", ...argv)
    expect(await fails()).toMatchObject({
      code: 2,
      text: "kirana-style ui preset takes one code\n",
    })
    expect((await fails("--all", "k0")).code).toBe(2)
    expect(await fails("z0")).toMatchObject({
      code: 1,
      text: "z0 is not a preset code of @acme/kit, whose layouts start with k\n",
    })
    expect(await fails(code(0, 0, 2))).toMatchObject({ code: 1 })
    // A code whose base no item has: named, nothing written.
    expect((await fails(code(0, 0, 2))).text).toContain(
      "@acme/button has no react markup for the base radix"
    )
    const noLayouts = await installed(
      { base: "base" },
      {
        "acme/kit.json": JSON.stringify({
          ...KIT,
          design: { axes: DESIGN.axes },
        }),
      }
    )
    expect((await run(noLayouts, "preset", "k0")).text).toBe(
      "k0 is not a preset code of @acme/kit, whose layouts start with nothing\n"
    )
    const noSystem = await installed(
      { base: "base" },
      {
        "acme/kit.json": JSON.stringify({ ...KIT, design: undefined }),
      }
    )
    expect((await run(noSystem, "preset", "k0")).text).toBe(
      "no design system with a design is installed: kirana-style ui init installs one\n"
    )
    writeFileSync(path.join(cwd, "acme/kit.json"), "{")
    expect((await run(cwd, "preset", "k0")).code).toBe(1)
    writeFileSync(path.join(cwd, "kirana-style.lock.json"), "{")
    expect((await run(cwd, "preset", "k0")).code).toBe(2)
  })

  it("says what is left to do by hand, and stops where the settings cannot be written or packages installed", async () => {
    const cwd = await installed()
    rmSync(path.join(cwd, "index.html"))
    expect((await run(cwd, "preset", code(1, 0), "--no-check")).text).toContain(
      'by hand: set <html>\'s attributes, as no layout or HTML page renders it: data-style="vega" data-color="neutral"\n'
    )
    const plain = await installed()
    rmSync(path.join(plain, "kirana.config.json"))
    writeFileSync(
      path.join(plain, "kirana.config.mjs"),
      'const registries = { "@acme": "acme/{name}.json" }\nexport default { ["ui"]: { registries } }\n'
    )
    let text = ""
    expect(
      await main(["preset", "k0"], plain, (chunk) => void (text += chunk), {
        run: () => 0,
        load: (url) => import(url),
      })
    ).toBe(1)
    expect(text).toMatch(
      /kirana\.config\.mjs: no ui: \{ … \} to set the design in; set ui\.design by hand\n$/
    )
    const failing = await installed()
    let output = ""
    expect(
      await main(
        ["preset", code(0, 0, 0, 0, 1)],
        failing,
        (chunk) => void (output += chunk),
        {
          run: () => 1,
        }
      )
    ).toBe(1)
    expect(output).toMatch(
      /failed: the files are written, the lockfile is not\n$/
    )
  })

  it("reads @kirana's design system with no configuration, and needs one to write the design to", async () => {
    const cwd = mkdtempSync(path.join(root, "bare-"))
    writeFileSync(path.join(cwd, "package.json"), "{}")
    writeFileSync(
      path.join(cwd, "tsconfig.json"),
      '{ "compilerOptions": { "paths": { "@/*": ["./*"] } } }'
    )
    const served: Record<string, unknown> = { kit: KIT }
    const fetch = (async (url: string) =>
      new Response(
        JSON.stringify(
          served[String(url).split("/").pop()!.replace(".json", "")]
        )
      )) as unknown as typeof globalThis.fetch
    writeFileSync(
      path.join(cwd, "kirana-style.lock.json"),
      JSON.stringify({
        lockfileVersion: 1,
        items: {
          "@kirana/kit": { registry: "x", version: "1.0.0", files: {} },
        },
      })
    )
    let text = ""
    expect(
      await main(["preset", "k0"], cwd, (chunk) => void (text += chunk), {
        fetch,
      })
    ).toBe(1)
    expect(text).toMatch(
      /no kirana\.config to write the design to: kirana-style ui init makes one\n$/
    )
  })
})
