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

/**
 * The helpers a Svelte or Astro component's spreads call, taken from its compiled code and run on
 * the private runtime, as the browser runs them.
 */
async function compiledHelpers(code: string) {
  const { runtime } = await import("@kirana-style/core/internal")
  const start = code.indexOf("const __kirana_class")
  let end = code.indexOf("\n};\n", start) + 4
  if (code.startsWith("const __kirana_rest", end))
    end = code.indexOf("\n};\n", end) + 4
  return new Function(
    "__kirana_sfc",
    `${code.slice(start, end)}return { attrs: __kirana_attrs, rest: typeof __kirana_rest === "function" ? __kirana_rest : undefined };`
  )(runtime("k", "class")) as {
    attrs: (
      handles: unknown[],
      classes: unknown[],
      styles: unknown[],
      component?: boolean
    ) => { class?: string; style?: string }
    rest?: (attributes: unknown) => unknown
  }
}

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

  it("folds an element's v-bind object into :sx, for a component that takes its caller's sx (KF-019)", async () => {
    const { result } = await compile(
      "Button.vue",
      `<script setup lang="ts">\nimport { useSx } from "@kirana-style/core/vue"\ndefineOptions({ inheritAttrs: false })\nconst { sx, attrs } = useSx()\n${SCRIPT}</script>\n<template>\n  <button v-bind="attrs" :sx="[card, sx]"><slot /></button>\n</template>\n`
    )
    expect(result.code).toContain(
      '<button  v-bind="__kirana_merge(attrs, __kirana_sfc.sx([[card, sx]], [], []))">'
    )
    expect(result.code).toContain(
      'import { mergeProps as __kirana_merge } from "vue";'
    )
    // The template reads `sx`; the script block alone does not, and is not told it never applies it.
    expect(result.diagnostics.map((diagnostic) => diagnostic.name)).toEqual([])
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

  it("places diagnostics by byte after non-ASCII text", async () => {
    // Spans count UTF-8 bytes, the parser's offsets characters: text before the block or in it
    // moved a diagnostic, and one near the block's end was taken for the template's and dropped.
    const source = `<template><p>Café — ${"é".repeat(40)}</p></template>\n<script setup>\nimport { css } from "@kirana-style/core"\n// ${"é".repeat(40)}\nconst a = css({ width: 5 })\n</script>\n`
    const { result } = await compile("G.vue", source)
    const [diagnostic] = result.diagnostics
    expect(diagnostic?.name).toBe("unitless-length")
    expect(
      Buffer.from(source)
        .subarray(diagnostic!.span.start, diagnostic!.span.end)
        .toString()
    ).toBe("width: 5")
  })

  it("passes a removal on to a component, not to an element (KF-089)", async () => {
    const { result } = await compile(
      "Field.vue",
      `<script setup lang="ts">\n${SCRIPT}</script>\n<template>\n  <Label :sx="card"><p :sx="card" /></Label><component :is="x" :sx="card" />\n</template>\n`
    )
    expect(result.code).toContain(
      '<Label v-bind="__kirana_sfc.sx([card], [], [], true)"><p v-bind="__kirana_sfc.sx([card], [], [])" /></Label>'
    )
    expect(result.code).toContain(
      '<component :is="x" v-bind="__kirana_sfc.sx([card], [], [], true)" />'
    )
  })

  it("applies a relation's anchor written only in the template (KF-088)", async () => {
    const root = project()
    const styles = path.join(root, "toggle.styles.ts")
    const text =
      'import { css, relation } from "@kirana-style/core"\nexport const toggle = relation("toggle")\nexport const icon = css({ color: { base: "red", [toggle.within("[data-pressed]")]: "blue" } })\n'
    writeFileSync(styles, text)
    const driver = await Driver.create({ root, importModule: load })
    driver.transform(styles, text)
    const unanchored = () =>
      driver
        .diagnostics()
        .filter((diagnostic) => diagnostic.name === "relation-without-anchor")
        .map((diagnostic) => diagnostic.message)
    expect(unanchored()).toEqual([
      'relation "toggle" is read but its anchor is never applied',
    ])
    // On a component, among other styles, beside a name the template alone has.
    const { code, diagnostics } = await driver.transformComponent(
      path.join(root, "Toggle.vue"),
      `<script setup lang="ts">\nimport { css } from "@kirana-style/core"\nimport { toggle, icon } from "./toggle.styles.ts"\nconst root = css({ padding: "1rem" })\n</script>\n<template>\n  <Button :sx="[toggle.anchor, root, css.anchor]"><i v-for="item in items" :sx="[icon, item.anchor, root.x?.anchor]" /></Button>\n</template>\n`
    )
    expect(unanchored()).toEqual([])
    // The anchors are compiled with the block and cut from it; what the engine said of them is
    // the template's (`css` read without a call), not the block's.
    expect(code).not.toContain("KF-088")
    expect(code).toContain(
      "__kirana_sfc.sx([[toggle.anchor, root, css.anchor]], [], [], true)"
    )
    expect(diagnostics).toEqual([])
    // A relation the component declares, reads and anchors itself, on an element.
    await driver.transformComponent(
      path.join(root, "Tree.vue"),
      `<script setup>\nimport { css, relation } from "@kirana-style/core"\nconst group = relation("folder")\nconst chevron = css({ rotate: { base: "0deg", [group.within("[data-open]")]: "90deg" } })\n</script>\n<template>\n  <div :sx="group.anchor"><i :sx="chevron" /></div>\n</template>\n`
    )
    expect(unanchored()).toEqual([])
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
      `{...__kirana_attrs([[card]], ["own " + (on ? 'x' : '')], ["opacity: 1"])}`
    )
    expect(result.code).toContain(
      "<p {...__kirana_attrs([card], [], [])} hidden>"
    )
    expect(result.code).toContain('sx="text"')
    expect(result.code).toContain(
      "<b class {...__kirana_attrs([card], [], [])} />"
    )
    expect(result.code).toContain(
      "<u  {...__kirana_attrs([card], [], [(s)])} />"
    )
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

  it("passes a removal on to a component, not to an element (KF-089)", async () => {
    const { result } = await compile(
      "Field.svelte",
      `<script lang="ts">\n${SCRIPT}</script>\n<Label class="own" sx={card}><p sx={card} /></Label>\n`
    )
    expect(result.code).toContain(
      '<Label  {...__kirana_attrs([card], ["own"], [], true)}><p {...__kirana_attrs([card], [], [])} /></Label>'
    )
    expect(result.code).toContain(
      "const props = __kirana_sfc.sx(handles, classes.map(__kirana_class), [], component);"
    )
  })
  it("puts a caller's class beside the sx last, so it wins (KF-098, D-122)", async () => {
    const { result } = await compile(
      "Label.svelte",
      `<script lang="ts">\nlet { class: className, ...rest } = $props()\nconst own = "k3T_own k4I_own"\n</script>\n<label {...rest} class={className} sx={own}></label>\n`
    )
    expect(result.code).toContain(
      "<label {...rest}  {...__kirana_attrs([own], [(rest)?.class, (className)], [(rest)?.style])}>"
    )
    const { attrs } = await compiledHelpers(result.code!)
    // The part's own leading loses to its caller's where both set it, and stays where only it does.
    expect(attrs(["k3T_own k4I_own"], [undefined, "k3T_caller"], [])).toEqual({
      class: "k4I_own k3T_caller",
      style: undefined,
    })
    // A caller's removal reaches the part's own entries.
    expect(attrs(["k3T_own k4I_own"], [undefined, "k3T_"], [])).toEqual({
      class: "k4I_own",
      style: undefined,
    })
  })

  it("folds the class and style of a spread written before the sx (KF-098)", async () => {
    const { result } = await compile(
      "Trigger.svelte",
      `<script lang="ts">\n${SCRIPT}</script>\n<button {...props()} type="button" sx={card}>t</button>\n<Button {...a} class="own" {...b} style="opacity: 1" sx={card} {...after} />\n<i class="first" {...a} sx={card} />\n`
    )
    // The spread stays where it is, ahead of the attributes that override it, and its class and
    // style are read again at the sx.
    expect(result.code).toContain(
      '<button {...props()} type="button" {...__kirana_attrs([card], [(props())?.class], [(props())?.style])}>'
    )
    // Several spreads give theirs in order, beside the element's own; one after the sx is left.
    expect(result.code).toContain(
      '<Button {...a}  {...b}  {...__kirana_attrs([card], [(a)?.class, "own", (b)?.class], [(a)?.style, (b)?.style, "opacity: 1"], true)} {...after} />'
    )
    expect(result.code).toContain(
      '<i  {...a} {...__kirana_attrs([card], ["first", (a)?.class], [(a)?.style])} />'
    )
    expect(result.code).not.toContain("__kirana_rest")
    const { attrs } = await compiledHelpers(result.code!)
    const { runtime } = await import("@kirana-style/core/internal")
    const bridged = runtime("k", "class").b
    const part = { class: "k3T_part", style: "flex: 0 0 auto" }
    // The spread's class merges before the element's own, the element's style after the spread's,
    // and bridged declarations last.
    expect(
      attrs(
        [["k3T_own k4I_own", bridged("k60_4ko", "--k60", 2)]],
        [part.class, "k4I_mine"],
        [part.style, "opacity: 1"]
      )
    ).toEqual({
      class: "k60_4ko k3T_part k4I_mine",
      style: "flex: 0 0 auto;opacity: 1;--k60:2",
    })
    // Svelte's ClassValue, as a caller or Ark hands one on.
    expect(
      attrs([], [["k3T_a", { k4I_b: true, k5X_c: false }, ["k6Y_d", null]]], [])
    ).toEqual({ class: "k3T_a k4I_b k6Y_d", style: undefined })
    expect(attrs([], [undefined], [undefined])).toEqual({
      class: undefined,
      style: undefined,
    })
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
    expect(result.code).toContain(
      '{...__kirana_attrs([[card]], ["own"], [(s)])}'
    )
    expect(result.code).toContain(
      "<p {...__kirana_attrs([card], [], [])} hidden>"
    )
    expect(result.code).toContain("<i sx={} />")
    expect(result.code).toContain(
      "<b class {...__kirana_attrs([card], [], [])} />"
    )
  })

  it("passes a removal on to a component, not to an element (KF-089)", async () => {
    const source = `---\n${SCRIPT}---\n<Card sx={card} /><ui.Card sx={card} /><my-card sx={card} />\n`
    const element = "<my-card {...__kirana_attrs([card], [], [])} />"
    const { result } = await compile("Page.astro", source)
    expect(result.code).toContain(
      "<Card {...__kirana_attrs([card], [], [], true)} /><ui.Card {...__kirana_attrs([card], [], [], true)} />"
    )
    expect(result.code).toContain(element)
    const legacy = isolated({
      "@astrojs/compiler": workspacePackage("@astrojs/compiler"),
    })
    const old = await compile("Page.astro", source, legacy)
    expect(old.result.code).toContain(
      "<Card {...__kirana_attrs([card], [], [], true)} />"
    )
    expect(old.result.code).toContain(element)
  })

  it("folds a spread's class and style into the sx, and spreads the rest (KF-098)", async () => {
    const source = `---\n${SCRIPT}---\n<button {...props} type="button" class="own" sx={card} {...after}>t</button><Card {...a} {...b} sx={card} />\n`
    for (const root of [
      project(),
      isolated({
        "@astrojs/compiler": workspacePackage("@astrojs/compiler"),
      }),
    ]) {
      const { result } = await compile("Page.astro", source, root)
      // Astro writes a spread's attributes where it stands and the browser keeps the first, so the
      // spread before the sx gives its class and style there only.
      expect(result.code).toContain(
        '<button {...__kirana_rest(props)} type="button"  {...__kirana_attrs([card], [(props)?.class, "own"], [(props)?.style])} {...after}>'
      )
      expect(result.code).toContain(
        "<Card {...__kirana_rest(a)} {...__kirana_rest(b)} {...__kirana_attrs([card], [(a)?.class, (b)?.class], [(a)?.style, (b)?.style], true)} />"
      )
      const { attrs, rest } = await compiledHelpers(result.code!)
      expect(rest!({ class: "a", style: "b", id: "c" })).toEqual({ id: "c" })
      expect(rest!(undefined)).toBeUndefined()
      // Astro's style object is written as Astro writes it.
      expect(
        attrs([], [], [{ fontSize: "1px", "--gap": "2px" }, "opacity: 1"])
      ).toEqual({
        class: undefined,
        style: "font-size:1px;--gap:2px;opacity: 1",
      })
    }
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
      '{...__kirana_attrs([ [card] ], ["own"], [(s)])}'
    )
    expect(result.code).toContain("<p {...__kirana_attrs([card], [], [])}>")
    expect(result.code).toContain(
      "<b class {...__kirana_attrs([card], [], [])} />"
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

describe("props() and cx() called in a template (KF-096)", () => {
  const helpers = [
    'import { css, props as styleProps, cx, type Sx } from "@kirana-style/core"',
    'import { props } from "@kirana-style/core"',
    'const booked = css({ color: "red" })',
  ].join("\n")

  it("defines the names a Vue template calls from the runtime, in the class attribute props() returns", async () => {
    const { result } = await compile(
      "Calendar.vue",
      `<script setup lang="ts">\n${helpers}\n</script>\n<template>\n  <Day :classes="{ booked: styleProps(booked).className, all: cx(booked) }" />\n</template>\n`
    )
    expect(result.code).toContain(
      'const __kirana_props = __kirana_runtime_sfc("k", "className");'
    )
    expect(result.code).toContain(
      "const styleProps = (...handles) => __kirana_props.sx(handles, [], []);"
    )
    expect(result.code).toContain("const cx = __kirana_props.cx;")
    // Imported but never called in the template: nothing to define.
    expect(result.code).not.toContain("const props =")
    expect(result.code).not.toContain('from "@kirana-style/core"\n')

    // The runtime's merge, run as the template runs it.
    const { runtime } = await import("@kirana-style/core/internal")
    const sx = runtime("k", "className").sx
    expect(sx(["k3T_aaa", "k3T_bbb"], [], [])).toEqual({ className: "k3T_bbb" })
  })

  it("does the same in Svelte's markup and Astro's", async () => {
    const svelte = await compile(
      "Day.svelte",
      `<script lang="ts">\n${helpers}\n</script>\n<span class={styleProps (booked).className}></span>\n`
    )
    expect(svelte.result.code).toContain(
      "const styleProps = (...handles) => __kirana_props.sx(handles, [], []);"
    )
    const astro = await compile(
      "Day.astro",
      `---\n${helpers}\n---\n<span class={styleProps(booked).className} />\n`
    )
    expect(astro.result.code).toContain(
      "const styleProps = (...handles) => __kirana_props.sx(handles, [], []);"
    )
  })

  it("follows the project's class attribute, and leaves a template with nothing to call alone", async () => {
    const root = project()
    writeFileSync(
      path.join(root, "kirana.config.mjs"),
      'export default { jsx: "preact" }\n'
    )
    const { result } = await compile(
      "Day.vue",
      `<script setup lang="ts">\n${helpers}\n</script>\n<template>\n  <i :class="styleProps(booked).class" />\n</template>\n`,
      root
    )
    expect(result.code).toContain('__kirana_runtime_sfc("k", "class");')

    // A name only read in the script, a member that shares it, and a template with no script.
    const quiet = await compile(
      "Quiet.vue",
      `<script setup lang="ts">\n${helpers}\nconst c = styleProps(booked)\n</script>\n<template>\n  <i :class="c.className" :title="x.styleProps(1)" :data-a="styleProps" :data-b="stylePropsX(1)" />\n</template>\n`
    )
    expect(quiet.result.code).not.toContain("__kirana_props")
    const bare = await compile(
      "Bare.vue",
      `<template>\n  <i :class="styleProps(x)" />\n</template>\n`
    )
    expect(bare.result.code).toBeUndefined()
  })
})

describe("templates outside the module (KF-090)", () => {
  /** A relation read in `styles`, the driver that compiled it, and what is left unanchored. */
  async function unanchored() {
    const root = project()
    writeFileSync(
      path.join(root, "kirana.config.json"),
      '{"externals":["@angular/","@ember/"]}'
    )
    const driver = await Driver.create({ root, importModule: load })
    const missing = () =>
      driver
        .diagnostics()
        .filter((diagnostic) => diagnostic.name === "relation-without-anchor")
        .map((diagnostic) => diagnostic.message.split('"')[1])
    return { root, driver, missing }
  }
  const STYLES = (name: string) =>
    `import { css, relation } from "@kirana-style/core"\nconst ${name} = relation("${name}")\nconst item = css({ color: { base: "black", [${name}.within("[data-open]")]: "red" } })\n`

  it("compiles an Angular component with its template's anchors, inline or in its file", async () => {
    const { root, driver, missing } = await unanchored()
    const inline = `${STYLES("menu")}@Component({\n  selector: "app-menu",\n  template: \`<ul [sx]="[menu.anchor, item]"><li [sx]="item">é</li></ul>\`,\n})\nexport class Menu {\n  protected readonly menu = menu\n  protected readonly item = item\n}\n`
    const result = driver.transform(
      path.join(root, "menu.component.ts"),
      inline
    )
    expect(result.code).toContain("export class Menu")
    expect(result.code).not.toContain("KF-088")
    writeFileSync(
      path.join(root, "panel.component.html"),
      '<section [sx]="panel.anchor"><p [sx]="item">x</p></section>\n'
    )
    const external = `${STYLES("panel")}@Component({ selector: "app-panel", templateUrl: "./panel.component.html" })\nexport class Panel {\n  protected readonly panel = panel\n}\n`
    await driver.transformAsync(path.join(root, "panel.component.ts"), external)
    expect(missing()).toEqual([])
    // Analog compiles after Angular: the compiled module has no decorator, and the source on disk
    // has the template. Without the source, nothing is appended.
    const compiled = `${STYLES("tabs")}export class Tabs {\n  static ɵcmp = i0.ɵɵdefineComponent({ template: (rf, ctx) => ctx.tabs.anchor })\n}\n`
    writeFileSync(
      path.join(root, "tabs.component.ts"),
      `${STYLES("tabs")}@Component({ template: '<div [sx]="tabs.anchor"></div>' })\nexport class Tabs {}\n`
    )
    driver.transform(path.join(root, "tabs.component.ts"), compiled)
    driver.transform(
      path.join(root, "gone.component.ts"),
      compiled.replaceAll("tabs", "gone")
    )
    expect(missing()).toEqual(["gone"])
    // A component whose template names no anchor is compiled as it is.
    const plain = `${STYLES("plain")}@Component({ template: '<p [sx]="item"></p>' })\nexport class Plain {}\n`
    expect(
      driver.transform(path.join(root, "plain.component.ts"), plain).diagnostics
    ).toEqual([])
    expect(missing()).toEqual(["gone", "plain"])
  })

  it("counts a template's anchor for a relation imported from another module (KF-101)", async () => {
    const { root, driver, missing } = await unanchored()
    // The relation, and a condition on it, live in a styles module the component imports, as
    // kirana-ui's `collapsible.styles.ts` does; the component holds the relation as a member.
    const styles = `import { relation } from "@kirana-style/core"\nexport const collapsibleScope = relation("collapsible")\nexport const OPEN = collapsibleScope.within("[data-open]")\n`
    writeFileSync(path.join(root, "collapsible.styles.ts"), styles)
    // A build reports a relation unanchored once it compiled the module declaring it (D-062).
    driver.transform(path.join(root, "collapsible.styles.ts"), styles)
    const imports = `import { css } from "@kirana-style/core"\nimport { collapsibleScope, OPEN } from "./collapsible.styles"\nconst chevron = css({ rotate: { base: "0deg", [OPEN]: "90deg" } })\n`
    writeFileSync(
      path.join(root, "nav.component.ts"),
      `${imports}@Component({ template: '<div [sx]="collapsibleScope.anchor"><svg [sx]="chevron"></svg></div>' })\nexport class Nav {\n  protected readonly collapsibleScope = collapsibleScope\n  protected readonly chevron = chevron\n}\n`
    )
    // What Analog hands Kirana: Angular's output, where the template reads the member off `ctx`.
    const compiled = `${imports}export class Nav {\n  constructor() { this.collapsibleScope = collapsibleScope; this.chevron = chevron }\n  static ɵcmp = i0.ɵɵdefineComponent({ template: (rf, ctx) => [ctx.collapsibleScope.anchor, ctx.chevron] })\n}\n`
    // Without the template, the member's anchor is nowhere in the module.
    driver.transform(
      path.join(root, "bare.component.ts"),
      compiled.replaceAll("Nav", "Bare")
    )
    expect(missing()).toEqual(["collapsible"])
    await driver.transformAsync(path.join(root, "nav.component.ts"), compiled)
    expect(missing()).toEqual([])
  })

  it("compiles an Ember template tag with its template's anchors", async () => {
    const { root, driver, missing } = await unanchored()
    // Embroider has turned the template into data, so the template tag is read from the source.
    const source = `${STYLES("folder")}<template>\n  <li data-open class={{sx folder.anchor @other.anchor}}><span class={{sx item}}>x</span></li>\n</template>\n`
    writeFileSync(path.join(root, "tree.gjs"), source)
    const embroidered = `${STYLES("folder")}export default setComponentTemplate(createTemplateFactory({ "block": "[[[10,\\"li\\"]]]", "scope": () => [sx, folder, item] }), templateOnly())\n`
    const { code } = driver.transform(
      path.join(root, "tree.gjs?v=1"),
      embroidered
    )
    expect(code).not.toContain("KF-088")
    expect(missing()).toEqual([])
    // `@arg` is the caller's argument, not the module's relation; an unclosed mustache ends the
    // search.
    writeFileSync(
      path.join(root, "args.gts"),
      `${STYLES("arg")}<template><ul class={{sx @arg.anchor}}></ul>{{</template>\n`
    )
    driver.transform(
      path.join(root, "args.gts"),
      embroidered.replaceAll("folder", "arg")
    )
    expect(missing()).toEqual(["arg"])
  })
})

describe("template scans on long input", () => {
  it("stay linear on unclosed tags and runs of spaces", async () => {
    const { moduleAnchors, templateAnchors } = await import("../src/sfc.ts")
    const root = project()
    const spaces = " ".repeat(200_000)
    writeFileSync(
      path.join(root, "long.gjs"),
      `<template>{{sx a.anchor}}${"{{".repeat(50_000)}${"<template>".repeat(20_000)}`
    )
    const started = performance.now()
    expect(
      moduleAnchors(`${path.join(root, "long.gjs")}${"#".repeat(200_000)}`, "")
    ).toBe("")
    expect(
      templateAnchors([
        { expression: `.${spaces}` },
        { expression: `a${spaces}?` },
      ])
    ).toBe("")
    expect(performance.now() - started).toBeLessThan(1000)
  })
})
