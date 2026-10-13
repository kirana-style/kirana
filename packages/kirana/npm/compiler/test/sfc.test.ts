import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vite-plus/test"

import { Driver, frameworkOf } from "../src/index.ts"
import { compileComponent } from "../src/sfc.ts"

const load = (url: string) => import(url)
const created: string[] = []
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

/** A project inside the workspace, so the frameworks' parsers resolve from its `node_modules`. */
function project(): string {
  const root = mkdtempSync(path.join(import.meta.dirname, ".app-"))
  created.push(root)
  writeFileSync(
    path.join(root, "package.json"),
    '{"name":"app","type":"module"}'
  )
  return root
}

/** A project outside the workspace whose `node_modules` holds exactly `packages`. */
function isolated(
  packages: Record<string, string | Record<string, string>>
): string {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "kirana-sfc-")))
  created.push(root)
  writeFileSync(
    path.join(root, "package.json"),
    '{"name":"app","type":"module"}'
  )
  for (const [name, target] of Object.entries(packages)) {
    const directory = path.join(root, "node_modules", name)
    mkdirSync(path.dirname(directory), { recursive: true })
    if (typeof target === "string") symlinkSync(target, directory)
    else {
      mkdirSync(directory, { recursive: true })
      for (const [file, text] of Object.entries(target)) {
        mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
        writeFileSync(path.join(directory, file), text)
      }
    }
  }
  return root
}
const workspacePackage = (name: string) =>
  realpathSync(path.join(import.meta.dirname, "../../../node_modules", name))

async function compile(
  name: string,
  source: string,
  root = project(),
  importModule = load
) {
  const driver = await Driver.create({ root, importModule })
  return {
    driver,
    file: path.join(root, name),
    result: await driver.transformComponent(path.join(root, name), source),
  }
}

const SCRIPT =
  'import { css } from "@kirana-style/core"\nconst card = css({ padding: "1rem" })\n'

describe("KRN-INT-004 Vue", () => {
  it("compiles <script setup> and turns :sx into a runtime spread", async () => {
    const { result } = await compile(
      "Card.vue",
      `<script setup lang="ts">\n${SCRIPT}</script>\n<template>\n  <div class="own" :sx="[card, on && card]"><p v-if="on" v-bind:sx='card["x"]' title="t">t</p><i sx="static" /></div>\n</template>\n`
    )
    expect(result.code).toContain('const card = "k0_HV2H"')
    expect(result.code).toContain('__kirana_runtime_sfc("k", "class")')
    expect(result.code).toContain(
      'class="own" v-bind="__kirana_sfc.sx([[card, on && card]], [], [])"'
    )
    expect(result.code).toContain(
      `v-bind='__kirana_sfc.sx([card["x"]], [], [])'`
    )
    expect(result.code).toContain('sx="static"')
    expect(result.map).toContain('"sources"')
    expect(result.cssChanged).toBe(true)
  })

  it("adds a <script setup> when the template has nothing to call", async () => {
    const withScript = await compile(
      "A.vue",
      `<script lang="ts">\nexport default {}\n</script>\n<template><p :sx="x"></p></template>\n`
    )
    expect(withScript.result.code).toMatch(
      /<script setup lang="ts">\n\nimport \{ runtime/
    )
    const bare = await compile(
      "B.vue",
      `<template><p :sx="x + &quot;y&quot; + 'z'"></p></template>\n`
    )
    expect(bare.result.code).toContain("<script setup>\n")
    expect(bare.result.code).toContain(
      `v-bind="__kirana_sfc.sx([x + &quot;y&quot; + 'z'], [], [])"`
    )
  })

  it("leaves a component without styles alone, and a component without a template", async () => {
    expect(
      (await compile("D.vue", "<template><p>t</p></template>\n")).result.code
    ).toBeUndefined()
    expect(
      (await compile("E.vue", "<script>\nexport default {}\n</script>\n"))
        .result.code
    ).toBeUndefined()
  })

  it("points diagnostics into the component", async () => {
    const { result } = await compile(
      "F.vue",
      `<template><p/></template>\n<script setup>\nimport { css } from "@kirana-style/core"\nconst a = css({ color: { "[data-a]": "red", "[data-b]": "blue" } })\n</script>\n`
    )
    const [diagnostic] = result.diagnostics
    expect(diagnostic?.name).toBe("ambiguous-precedence")
    expect(diagnostic?.file).toMatch(/F\.vue$/)
    expect(diagnostic!.span.start).toBeGreaterThan(40)
  })
})

describe("KRN-INT-004 Svelte", () => {
  it("compiles both scripts and folds the element's class and style into the spread", async () => {
    const { result } = await compile(
      "Card.svelte",
      `<script module>\nexport const shared = 1\n</script>\n<script lang="ts">\n${SCRIPT}</script>\n\n<div class="own {on ? 'x' : ''}" style="opacity: 1" sx={[card]}>{#if on}<p sx="{card}" hidden>t</p><i sx="text" /><b class sx={card} /><u style={s} sx={card} />{/if}</div>\n`
    )
    expect(result.code).toContain('const card = "k0_HV2H"')
    expect(result.code).toContain(
      `{...__kirana_attrs([[card]], ["own " + (on ? 'x' : '')], "opacity: 1")}`
    )
    expect(result.code).toContain(
      "<p {...__kirana_attrs([card], [], undefined)} hidden>"
    )
    expect(result.code).toContain('sx="text"')
    expect(result.code).toContain(
      "<b class {...__kirana_attrs([card], [], undefined)} />"
    )
    expect(result.code).toContain("<u  {...__kirana_attrs([card], [], (s))} />")
    expect(result.code).toContain("const __kirana_attrs")
  })

  it("adds an instance script when there is none, and fills an empty one", async () => {
    const { result } = await compile("A.svelte", "<p sx={x}>t</p>\n")
    expect(result.code).toMatch(/^<script>\n\nimport \{ runtime/)
    const empty = await compile(
      "B.svelte",
      "<script></script>\n<p sx={x}>t</p>\n"
    )
    expect(empty.result.code).toMatch(
      /^<script>\nimport \{ runtime[\s\S]*<\/script>\n<p \{\.\.\./
    )
  })
})

describe("KRN-INT-004 Astro", () => {
  it("compiles the frontmatter and turns sx into a spread (Astro 7's parser)", async () => {
    const { result } = await compile(
      "Card.astro",
      `---\n${SCRIPT}---\n<div class="own" style={s} sx={[card]}>{on && <p sx={card} hidden>t</p>}<i sx={} /><b class sx={card} /></div>\n`
    )
    expect(result.code).toMatch(/^---\nimport \{ runtime/)
    expect(result.code).toContain('const card = "k0_HV2H"')
    expect(result.code).toContain('{...__kirana_attrs([[card]], ["own"], (s))}')
    expect(result.code).toContain(
      "<p {...__kirana_attrs([card], [], undefined)} hidden>"
    )
    expect(result.code).toContain("<i sx={} />")
    expect(result.code).toContain(
      "<b class {...__kirana_attrs([card], [], undefined)} />"
    )
  })

  it("adds a frontmatter when there is none", async () => {
    const { result } = await compile("A.astro", "<p sx={x}>t</p>\n")
    expect(result.code).toMatch(
      /^---\n\nimport \{ runtime[\s\S]*---\n<p \{\.\.\./
    )
  })

  it("falls back to Astro 5 and 6's parser, and to a framework's own dependencies", async () => {
    const legacy = isolated({
      "@astrojs/compiler": workspacePackage("@astrojs/compiler"),
    })
    const { result } = await compile(
      "Card.astro",
      `---\n${SCRIPT}---\n<div class="own" style = {s} data-x sx={ [card] }>{on && <p sx={card}>t</p>}<b class sx={card} /></div>\n`,
      legacy
    )
    expect(result.code).toContain('const card = "k0_HV2H"')
    expect(result.code).toContain(
      '{...__kirana_attrs([ [card] ], ["own"], (s))}'
    )
    expect(result.code).toContain(
      "<p {...__kirana_attrs([card], [], undefined)}>"
    )
    expect(result.code).toContain(
      "<b class {...__kirana_attrs([card], [], undefined)} />"
    )
    const bare = await compile("B.astro", "<p sx={x}>t</p>\n", legacy)
    expect(bare.result.code).toMatch(/^---\n\nimport \{ runtime/)
    const nested = isolated({
      astro: {
        "package.json": '{"name":"astro"}',
        "node_modules/@astrojs/compiler-rs": "",
      },
    })
    rmSync(
      path.join(nested, "node_modules/astro/node_modules/@astrojs/compiler-rs")
    )
    symlinkSync(
      workspacePackage("@astrojs/compiler-rs"),
      path.join(nested, "node_modules/astro/node_modules/@astrojs/compiler-rs")
    )
    const found = await compile("A.astro", "<p sx={x}>t</p>\n", nested)
    expect(found.result.code).toContain("__kirana_attrs([x]")
  })

  it("refuses to guess where an attribute is", async () => {
    const stub = isolated({
      "@astrojs/compiler": {
        "package.json":
          '{"name":"@astrojs/compiler","type":"module","main":"index.js"}',
        // Only a default export, as a CommonJS build arrives through `import()`.
        "index.js": `export default { parse: async () => ({ ast: { type: "root", children: [{ type: "element", attributes: [{ kind: "expression", name: "sx", value: "x", raw: "", position: { start: { offset: 1 } } }] }] } }) }\n`,
      },
    })
    // Vitest's interop adds a default export's keys to the namespace; `import()` in Node does not.
    const defaultOnly = async (url: string) => ({
      default: ((await import(url)) as { default: unknown }).default,
    })
    await expect(
      compile("A.astro", "<p sx={x}>t</p>\n", stub, defaultOnly)
    ).rejects.toThrow("could not locate the `sx` attribute at offset 1")
  })
})

describe("components", () => {
  it("names the framework, and says which parser is missing", async () => {
    expect(frameworkOf("/a/B.vue")).toBe("vue")
    expect(frameworkOf("/a/B.tsx")).toBeUndefined()
    const empty = isolated({})
    for (const [name, missing] of [
      ["A.vue", "vue/compiler-sfc"],
      ["A.svelte", "svelte/compiler"],
      ["A.astro", "@astrojs/compiler"],
    ]) {
      await expect(compile(name!, "<p/>", empty)).rejects.toThrow(
        `Kirana needs ${missing}`
      )
    }
  })

  it("tracks a component's blocks for invalidation and removal", async () => {
    const root = project()
    writeFileSync(
      path.join(root, "tokens.ts"),
      'import { defineTokens } from "@kirana-style/core"\nexport const space = defineTokens("space", { 4: "1rem" })\n'
    )
    const driver = await Driver.create({ root, importModule: load })
    const file = path.join(root, "Card.vue")
    // Registered first, so looking a block's component up passes over one that does not own it.
    await driver.transformComponent(
      path.join(root, "Other.svelte"),
      "<script>\nconst a = 1\n</script>\n"
    )
    await driver.transformComponent(
      file,
      `<script>\nexport default {}\n</script>\n<script setup>\nimport { css } from "@kirana-style/core"\nimport { space } from "./tokens.ts"\nconst card = css({ gap: space[4] })\n</script>\n`
    )
    expect(driver.invalidate(path.join(root, "tokens.ts"))).toEqual([file])
    expect(driver.invalidate(file)).toEqual([])
    // The setup block is gone: its module leaves the graph and its atom the stylesheet.
    await driver.transformComponent(
      file,
      "<script>\nexport default {}\n</script>\n"
    )
    expect(driver.stylesheet(true)).not.toContain("gap:")
    expect(driver.remove(file)).toBe(false)
    expect(driver.remove(path.join(root, "tokens.ts"))).toBe(false)
  })

  it("compiles through an injected compile function", async () => {
    const result = await compileComponent({
      file: path.join(project(), "A.svelte"),
      source: "<script>\nconst a = 1\n</script>\n",
      root: import.meta.dirname,
      prefix: "k",
      compile: () => ({ diagnostics: [], cssChanged: false, dependencies: [] }),
      load,
    })
    expect(result.code).toBeUndefined()
    expect(result.modules).toHaveLength(1)
  })
})
