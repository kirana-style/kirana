/**
 * The language server reads Vue, Svelte and Astro components with a scanner of its own
 * (`kirana_frontend::sfc`), since it cannot load the frameworks' parsers the build uses. This holds
 * the scanner to them: on every example component and on each construct below, both must find the
 * same script blocks and the same `sx` bindings (`design-notes/editor-components.md`).
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { loadNative } from "../src/native.ts"
import { parseComponent } from "../src/sfc.ts"

const native = loadNative()
const load = (url: string) => import(url)
const root = path.join(import.meta.dirname, "..")
const examples = path.join(import.meta.dirname, "../../../examples")

/** Every component under the examples, without installed or generated files. */
function components(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    if (name === "node_modules" || name.startsWith(".") || name === "dist")
      return []
    const file = path.join(directory, name)
    if (statSync(file).isDirectory()) return components(file)
    return /\.(vue|svelte|astro)$/.test(name) ? [file] : []
  })
}

/** Both views of one component, in the same shape. */
async function both(file: string, source: string) {
  const parsed = await parseComponent(file, source, root, load)
  const framework = {
    blocks: parsed.blocks.map(({ label, start, end, lang }) => ({
      label,
      start,
      end,
      lang,
    })),
    bindings: parsed.bindings.map(({ start, end, expression }) => ({
      start,
      end,
      expression,
    })),
    target: parsed.target?.label ?? null,
  }
  return {
    framework,
    scanner: JSON.parse(native.scanComponent(file, source)) as unknown,
  }
}

const CONSTRUCTS: Record<string, string> = {
  "vue-setup.vue": `<script setup lang="ts">\nconst card = css({})\n</script>\n<template>\n  <div class="own" :sx="[card, on && card]"><p v-if="on" v-bind:sx='card["x"]' title="t">t</p><i sx="static" /></div>\n</template>\n`,
  "vue-both.vue": `<template><p :sx="x">{{ a > b ? 1 : 2 }}</p></template>\n<script setup>\nlet x\n</script>\n<script lang="ts">\nexport default {}\n</script>\n`,
  "vue-pre.vue": `<template><div v-pre><p :sx="pre"></p></div><p :sx="yes"></p><!-- <p :sx="c"> --></template>`,
  "vue-entities.vue": `<template><p :sx="x + &quot;y&quot; + 'z'"></p></template>\n`,
  "vue-unicode.vue": `<script setup>\nconst é = css({}) // ✓\n</script>\n<template><p title="✓ ü" :sx="é"></p></template>\n`,
  "svelte-both.svelte": `<script module>\nexport const shared = 1\n</script>\n<script lang="ts">\nconst card = css({})\n</script>\n\n<div class="own {on ? 'x' : ''}" style="opacity: 1" sx={[card]}>{#if on}<p sx="{card}" hidden>t</p><i sx="text" /><b class sx={card} /><u {sx} />{/if}</div>\n<style>p { color: red }</style>\n`,
  "svelte-each.svelte": `<script>\nlet items = []\n</script>\n{#each items as item (item.id)}\n  <li sx={[item.on && a, \`\${item.x}}\`]}>{item.name}</li>\n{:else}\n  <p sx={empty}></p>\n{/each}\n`,
  "svelte-context.svelte": `<script context="module">\nexport const a = 1\n</script>\n<p sx={a}></p>\n`,
  "astro-map.astro": `---\nconst card = css({})\n---\n<ul sx={card}>{items.map((item) => <li sx={[card, item.on && card]}>{item.name}</li>)}</ul>\n<script>let s = '<p sx={no} />'</script>\n`,
  "astro-none.astro": `<p sx={a} title="t" />\n`,
  "astro-shorthand.astro": `---\nconst sx = 1\n---\n<p {sx} /><Comp.Part sx={b} {...rest} /><Fragment><i sx={/* empty */} /></Fragment>\n`,
  "astro-ternary.astro": `---\n---\n{on ? <p sx={a}>x</p> : <span sx={\`\${b}\`} />}\n<style>p { color: red }</style>\n`,
  "svelte-special.svelte": `<script lang="ts">\nlet a\n</script>\n<svelte:element this="p" sx={a} />\n<Comp sx={a}>{#snippet s(x)}<b sx={x}></b>{/snippet}</Comp>\n<!-- <p sx={c} /> -->\n`,
  "vue-nested.vue": `<template>\n  <template v-if="on"><Comp :sx="a" /></template>\n  <ul><li v-for="i in items" :key="i" :sx='[i.on && a]'>{{ i }}</li></ul>\n</template>\n<style scoped>\np { color: red }\n</style>\n`,
}

describe("the language server's component scanner", () => {
  for (const file of components(examples)) {
    it(`agrees with the framework on ${path.relative(examples, file)}`, async () => {
      const { framework, scanner } = await both(
        file,
        readFileSync(file, "utf8")
      )
      expect(scanner).toEqual(framework)
    })
  }
  for (const [name, source] of Object.entries(CONSTRUCTS)) {
    it(`agrees with the framework on ${name}`, async () => {
      const { framework, scanner } = await both(path.join(root, name), source)
      expect(scanner).toEqual(framework)
    })
  }
  it("returns null for any other file", () => {
    expect(native.scanComponent("a.tsx", "")).toBe("null")
    expect(() => native.scanComponent(1 as never, "")).toThrow()
    expect(() => native.scanComponent("a.vue", 1 as never)).toThrow()
    expect(() =>
      (native.scanComponent as (...args: unknown[]) => string)()
    ).toThrow()
  })
})
