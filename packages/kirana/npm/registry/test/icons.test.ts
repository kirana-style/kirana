import { describe, expect, it } from "vite-plus/test"

import { inlineNames, resolveIcons } from "../src/icons.ts"
import type { InlineIcon } from "../src/inline-icons.ts"

const REACT = `import "./select.css"
import { Select } from "@base-ui/react/select"
import { IconPlaceholder } from "@/registry/lib/kit/icons/icon-placeholder"
import { select } from "@/registry/ui/select.styles"

export const Trigger = () => (
  <Select.Icon
    render={
      <IconPlaceholder
        lucide="ChevronDownIcon"
        hugeicons="UnfoldMoreIcon"
        tabler="IconSelector"
        {...props(select.icon, { onClick: () => go(a > b) })}
      />
    }
  />
)
export const Check = () => <IconPlaceholder lucide="CheckIcon" hugeicons="Tick02Icon" tabler="IconCheck" />
`

const VUE = `<script setup lang="ts">
import IconPlaceholder from "@/registry/lib/kit/icons/IconPlaceholder.vue"
import { select } from "@/registry/ui/select.styles"
</script>

<template>
  <IconPlaceholder lucide="ChevronDownIcon" hugeicons="UnfoldMoreIcon" tabler="IconSelector" phosphor="CaretDownIcon" remixicon="RiArrowDownSLine" :sx="[select.icon]" />
</template>
`

describe("KRN-DX-028 the icon placeholder, resolved at install", () => {
  it("draws Lucide's components in React, every other attribute kept, the placeholder's import dropped", () => {
    const { content, packages } = resolveIcons("x", REACT, "react", "lucide")
    expect(packages).toEqual(["lucide-react"])
    expect(content).not.toContain("IconPlaceholder")
    expect(content).toContain(
      'import { select } from "@/registry/ui/select.styles"\nimport { CheckIcon, ChevronDownIcon } from "lucide-react"\n'
    )
    expect(content).toContain(
      "<ChevronDownIcon\n        {...props(select.icon, { onClick: () => go(a > b) })} />"
    )
    expect(content).toContain("export const Check = () => <CheckIcon />")
  })

  it("draws Hugeicons through its own component, and Tabler as itself", () => {
    const huge = resolveIcons("x", REACT, "react", "hugeicons")
    expect(huge.packages).toEqual([
      "@hugeicons/react",
      "@hugeicons/core-free-icons",
    ])
    expect(huge.content).toContain(
      'import { HugeiconsIcon } from "@hugeicons/react"\nimport { Tick02Icon, UnfoldMoreIcon } from "@hugeicons/core-free-icons"'
    )
    expect(huge.content).toContain(
      "<HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />"
    )
    expect(resolveIcons("x", REACT, "react", "tabler").content).toContain(
      "<IconCheck />"
    )
    for (const library of ["phosphor", "remixicon"] as const)
      expect(() => resolveIcons("x", REACT, "react", library)).toThrow(
        `x: an <IconPlaceholder> names no ${library} icon`
      )
  })

  it("draws them in a Vue part's template, with the imports in its <script setup>", () => {
    const lucide = resolveIcons("x", VUE, "vue", "lucide")
    expect(lucide.packages).toEqual(["@lucide/vue"])
    expect(lucide.content).toBe(`<script setup lang="ts">
import { select } from "@/registry/ui/select.styles"
import { ChevronDownIcon } from "@lucide/vue"
</script>

<template>
  <ChevronDownIcon :sx="[select.icon]" />
</template>
`)
    expect(resolveIcons("x", VUE, "vue", "hugeicons").content).toContain(
      '<HugeiconsIcon :icon="UnfoldMoreIcon" :stroke-width="2" :sx="[select.icon]" />'
    )
    for (const library of ["tabler", "phosphor", "remixicon"] as const)
      expect(resolveIcons("x", VUE, "vue", library).packages).toHaveLength(1)
  })

  it("finds a Vue part's script whatever its tag's case", () => {
    const upper = VUE.replace("<script setup", "<SCRIPT setup")
    expect(resolveIcons("x", upper, "vue", "lucide").content).toContain(
      '<SCRIPT setup lang="ts">\nimport { select } from "@/registry/ui/select.styles"\nimport { ChevronDownIcon } from "@lucide/vue"\n'
    )
  })

  it("leaves a file without placeholders, and stops where it cannot draw one", () => {
    expect(resolveIcons("x", "const a = 1\n", "svelte", "lucide")).toEqual({
      content: "const a = 1\n",
      packages: [],
    })
    expect(() => resolveIcons("x", REACT, undefined, "lucide")).toThrow(
      "x draws icons, which a file for every framework cannot resolve yet"
    )
    expect(() =>
      resolveIcons(
        "x",
        '<IconPlaceholder lucide="A" title="unclosed>',
        "react",
        "lucide"
      )
    ).toThrow("an <IconPlaceholder> is not closed with />")
    expect(() =>
      resolveIcons("x", '<IconPlaceholder lucide="A"', "react", "lucide")
    ).toThrow("an <IconPlaceholder> is not closed with />")
  })
})

const SVELTE = `<script lang="ts">
  import IconPlaceholder from "@/registry/lib/kit/icons/IconPlaceholder.svelte"
  import { dialog } from "@/registry/ui/dialog.styles"
</script>

<IconPlaceholder lucide="XIcon" tabler="IconX" hugeicons="Cancel01Icon" phosphor="XIcon" remixicon="RiCloseLine" sx={dialog.close} />
`

const SOLID = `import { IconPlaceholder } from "./icon-placeholder"

export const Close = () => <IconPlaceholder lucide="XIcon" tabler="IconX" hugeicons="Cancel01Icon" phosphor="XIcon" remixicon="RiCloseLine" class="close" width="16" />
`

const ANGULAR = `import { Component } from "@angular/core"
import { SxDirective } from "@kirana-style/angular"
import { IconPlaceholder } from "@/registry/lib/kit/icons/angular"

/** \`<svg iconPlaceholder lucide="…">\`, as written in documentation. */
@Component({
  selector: "kui-close",
  imports: [IconPlaceholder, SxDirective],
  template: \`
    <button>
      <svg
        iconPlaceholder
        lucide="XIcon"
        tabler="IconX"
        hugeicons="Cancel01Icon"
        phosphor="XIcon"
        remixicon="RiCloseLine"
        [sx]="styles.icon"
        data-label="a > b"
      ></svg>
      <svg viewBox="0 0 1 1"></svg>
    </button>
  \`,
})
export class Close {}
`

const X: InlineIcon = {
  attributes: [
    ["xmlns", "http://www.w3.org/2000/svg"],
    ["width", "24"],
    ["viewBox", "0 0 24 24"],
  ],
  inner: '<path d="M18 6 6 18" />',
}
const DRAWN = new Map([
  ["XIcon", X],
  ["IconX", X],
  ["Cancel01Icon", X],
  ["RiCloseLine", X],
])

describe("KRN-DX-033 icons on Svelte, Solid and Angular", () => {
  it("draws Svelte's packages where they exist, imports in its <script>", () => {
    const lucide = resolveIcons("x", SVELTE, "svelte", "lucide")
    expect(lucide.packages).toEqual(["@lucide/svelte"])
    expect(lucide.content).toContain('import { XIcon } from "@lucide/svelte"')
    expect(lucide.content).toContain("<XIcon sx={dialog.close} />")
    expect(lucide.content).not.toContain("IconPlaceholder")
    expect(resolveIcons("x", SVELTE, "svelte", "hugeicons").content).toContain(
      "<HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} sx={dialog.close} />"
    )
    expect(resolveIcons("x", SVELTE, "svelte", "tabler").packages).toEqual([
      "@tabler/icons-svelte",
    ])
    expect(resolveIcons("x", SVELTE, "svelte", "phosphor").packages).toEqual([
      "phosphor-svelte",
    ])
  })

  it("draws a library a framework has no package for inline, with its notice", () => {
    const remix = resolveIcons("x", SVELTE, "svelte", "remixicon", DRAWN)
    expect(remix.packages).toEqual([])
    expect(remix.content).toMatch(
      /^<!-- Icons drawn from Remix Icon, https:\/\/remixicon\.com/
    )
    expect(remix.content).toContain(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" viewBox="0 0 24 24" sx={dialog.close}><path d="M18 6 6 18" /></svg>'
    )
    expect(remix.content).not.toContain("IconPlaceholder")
    // A size the placeholder gives wins over the data's.
    const huge = resolveIcons("x", SOLID, "solid", "hugeicons", DRAWN)
    expect(huge.content).toMatch(/^\/\* Icons drawn from Hugeicons, /)
    expect(huge.content).toContain(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="close" width="16"><path d="M18 6 6 18" /></svg>'
    )
    expect(huge.content).not.toContain("./icon-placeholder")
    expect(resolveIcons("x", SOLID, "solid", "lucide").content).toContain(
      'import { XIcon } from "lucide-solid"'
    )
    expect(() => resolveIcons("x", SOLID, "solid", "phosphor")).toThrow(
      "x: the phosphor icon XIcon was not read"
    )
  })

  it("fills Angular's <svg iconPlaceholder>, its import and its imports entry dropped", () => {
    const { content, packages } = resolveIcons(
      "x",
      ANGULAR,
      "angular",
      "lucide",
      DRAWN
    )
    expect(packages).toEqual([])
    expect(content).toMatch(
      /^\/\* Icons drawn from Lucide, https:\/\/lucide\.dev/
    )
    expect(content).not.toContain("import { IconPlaceholder }")
    expect(content).toContain("imports: [SxDirective]")
    expect(content).toContain(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" viewBox="0 0 24 24"\n        [sx]="styles.icon"\n        data-label="a > b"><path d="M18 6 6 18" /></svg>'
    )
    // Documentation and another <svg> stay as written.
    expect(content).toContain('<svg iconPlaceholder lucide="…">')
    expect(content).toContain('<svg viewBox="0 0 1 1"></svg>')
  })

  it("keeps an Angular import that names more than the placeholder", () => {
    const shared = ANGULAR.replace(
      'import { IconPlaceholder } from "@/registry/lib/kit/icons/angular"',
      'import { ICON_LIBRARY, IconPlaceholder } from "@/registry/lib/kit/icons/angular"'
    )
    expect(
      resolveIcons("x", shared, "angular", "tabler", DRAWN).content
    ).toContain(
      'import { ICON_LIBRARY } from "@/registry/lib/kit/icons/angular"\n'
    )
  })

  it("leaves Angular's bound placeholders to the directive, with its import", () => {
    const bound = ANGULAR.replace(
      "      <svg viewBox",
      '      <svg iconPlaceholder [lucide]="icon.lucide"></svg>\n      <svg viewBox'
    )
    const { content } = resolveIcons("x", bound, "angular", "lucide", DRAWN)
    expect(content).toContain(
      '<svg iconPlaceholder [lucide]="icon.lucide"></svg>'
    )
    expect(content).toContain("import { IconPlaceholder }")
    expect(content).toContain("imports: [IconPlaceholder, SxDirective]")
    const only =
      'const t = `<svg iconPlaceholder [lucide]="icon.lucide"></svg>`\n'
    expect(resolveIcons("x", only, "angular", "lucide").content).toBe(only)
    expect(
      resolveIcons("x", "const a = 1\n", "angular", "lucide").content
    ).toBe("const a = 1\n")
  })

  it("stops where an Angular placeholder cannot be drawn", () => {
    expect(() =>
      resolveIcons(
        "x",
        '`<svg iconPlaceholder lucide="XIcon"><path /></svg>`',
        "angular",
        "lucide",
        DRAWN
      )
    ).toThrow("x: an <svg iconPlaceholder> holds content")
    expect(() =>
      resolveIcons(
        "x",
        '`<svg iconPlaceholder tabler="IconX"></svg>`',
        "angular",
        "lucide",
        DRAWN
      )
    ).toThrow("x: an <svg iconPlaceholder> names no lucide icon")
    expect(() =>
      resolveIcons(
        "x",
        '`<svg iconPlaceholder lucide="XIcon"></svg>`',
        "angular",
        "lucide"
      )
    ).toThrow("x: the lucide icon XIcon was not read")
    expect(() =>
      resolveIcons("x", '`<svg iconPlaceholder title="a>', "angular", "lucide")
    ).toThrow("an <svg> is not closed with >")
    expect(() =>
      resolveIcons("x", "`<svg iconPlaceholder", "angular", "lucide")
    ).toThrow("an <svg> is not closed with >")
  })

  it("lists the icons a file draws inline, once each", () => {
    expect(inlineNames(SVELTE, "svelte", "remixicon")).toEqual(["RiCloseLine"])
    expect(inlineNames(SVELTE + SVELTE, "svelte", "remixicon")).toEqual([
      "RiCloseLine",
    ])
    expect(inlineNames(SVELTE, "svelte", "lucide")).toEqual([])
    expect(inlineNames(SVELTE, undefined, "remixicon")).toEqual([])
    expect(inlineNames(ANGULAR, "angular", "phosphor")).toEqual(["XIcon"])
    expect(
      inlineNames(
        '`<svg iconPlaceholder tabler="IconX"></svg>`',
        "angular",
        "lucide"
      )
    ).toEqual([])
    // A placeholder on a comment's line is documentation.
    expect(
      inlineNames(
        '// <IconPlaceholder remixicon="RiX" />\n',
        "solid",
        "remixicon"
      )
    ).toEqual([])
  })
})
