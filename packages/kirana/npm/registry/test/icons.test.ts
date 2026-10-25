import { describe, expect, it } from "vite-plus/test"

import { resolveIcons } from "../src/icons.ts"

const REACT = `import { Select } from "@base-ui/react/select"
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

  it("leaves a file without placeholders, and stops where it cannot draw one", () => {
    expect(resolveIcons("x", "const a = 1\n", "svelte", "lucide")).toEqual({
      content: "const a = 1\n",
      packages: [],
    })
    expect(() => resolveIcons("x", REACT, "svelte", "lucide")).toThrow(
      "x draws icons, which svelte cannot resolve yet"
    )
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
