import { readdirSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { beforeAll, describe, expect, it } from "vite-plus/test"

import type { State } from "../states-ui-sdk.ts"
import { UI_SDK_NOT_STATES, uiSdk } from "../states-ui-sdk.ts"

const require = createRequire(import.meta.url)
const dist = path.join(
  path.dirname(require.resolve("@ui-sdk/core/package.json")),
  "dist"
)

let result: ReturnType<typeof uiSdk>

/** A part's states, by name. */
function part(component: string, name: string): Map<string, State> {
  const parts = result.vocabulary.get(component)
  if (!(parts instanceof Map)) throw new Error(`${component} has no parts`)
  return new Map((parts.get(name) ?? []).map((state) => [state.name, state]))
}

/** `navigation-menu` → `NavigationMenu`. */
const pascal = (value: string) =>
  value
    .replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())
    .replace(/^\w/, (letter) => letter.toUpperCase())

type Primitive = ((options: Record<string, unknown>) => {
  part: (slot: string, props: Record<string, unknown>) => unknown
}) & { slots: Record<string, unknown>; options: Record<string, unknown> }

/** Every primitive the components' modules export, by its `data-slot` name. */
async function primitives(): Promise<Primitive[]> {
  const out = new Set<Primitive>()
  const components = path.join(dist, "components")
  for (const folder of readdirSync(components))
    for (const entry of readdirSync(path.join(components, folder))) {
      if (!entry.endsWith(".js")) continue
      const module = (await import(
        pathToFileURL(path.join(components, folder, entry)).href
      )) as Record<string, unknown>
      for (const value of Object.values(module)) {
        const candidate = value as Primitive
        if (
          typeof candidate === "function" &&
          candidate.slots &&
          candidate.options
        )
          out.add(candidate)
      }
    }
  return [...out]
}

describe("ui-sdk vocabulary", () => {
  beforeAll(() => {
    result = uiSdk()
  })

  it("reads the pinned release, every expression of every part", () => {
    expect(result.version).toBe("0.1.0-beta.9")
    expect(result.unread).toEqual([])
  })

  it("names components and parts from the primitive's name and slots", async () => {
    // Every primitive under `dist/components/` and each of its slots.
    for (const primitive of await primitives()) {
      const read = result.parts.get(primitive.name)
      expect(read, primitive.name).toBeDefined()
      for (const slot of Object.keys(primitive.slots))
        expect(read, `${primitive.name}.${slot}`).toContain(slot)
    }
    expect(result.vocabulary.has("NavigationMenu")).toBe(true)
    expect(result.vocabulary.has("AlertDialog")).toBe(true)
    // Checkbox's group writes `data-slot="checkbox-group"`: one component.
    expect(part("Checkbox", "Group").has("disabled")).toBe(true)
  })

  it("reads Popover's content: open and closed, and the side the positioner writes", () => {
    const content = part("Popover", "Content")
    expect(content.get("open")).toMatchObject({
      attribute: "data-open",
      values: [],
    })
    expect(content.get("closed")).toMatchObject({
      attribute: "data-closed",
      values: [],
    })
    expect(content.get("side")?.values.sort()).toEqual([
      "bottom",
      "left",
      "right",
      "top",
    ])
    expect(content.get("align")?.values).toEqual(["start", "center", "end"])
    expect(content.get("startingStyle")?.attribute).toBe("data-starting-style")
    expect(part("Popover", "Arrow").get("side")?.values).toHaveLength(4)
    expect(content.get("open")?.doc).toBe("Present when the popover is open.")
  })

  it("follows spreads of helpers and of other slots, across files", () => {
    // `toggleSlots` spreads `toggleDataAttrs`, which spreads `checkedAttrs` (kernel/attrs.js).
    const checkbox = part("Checkbox", "Root")
    for (const name of ["checked", "unchecked", "indeterminate", "disabled"])
      expect(checkbox.get(name), name).toMatchObject({ values: [] })
    expect(checkbox.get("checked")?.attribute).toBe("data-checked")
    // Popover's trigger spreads `popupTrigger(slot)`'s `attrs`, which writes `openAttrs(…)`.
    const trigger = part("Popover", "Trigger")
    expect([...trigger.keys()].sort()).toEqual(["closed", "disabled", "open"])
    // An attribute `live(read)` writes as it changes.
    expect(part("Select", "Item").has("highlighted")).toBe(true)
  })

  it("lists a valued attribute's values from its type", () => {
    // `"data-side": state.side`, where `DrawerContentState.side` is `PhysicalSide`.
    expect(part("Drawer", "Content").get("side")).toMatchObject({
      attribute: "data-side",
      values: ["top", "bottom", "left", "right"],
    })
    expect(part("Toast", "Root").get("type")?.values).toEqual([
      "default",
      "success",
      "error",
      "info",
      "warning",
      "loading",
    ])
    expect(part("Separator", "Root").get("orientation")?.values).toEqual([
      "horizontal",
      "vertical",
    ])
  })

  it("leaves out attributes that carry identifiers, with why", () => {
    expect(part("Slider", "Thumb").has("index")).toBe(false)
    expect(part("Tree", "Item").has("level")).toBe(false)
    expect(part("Drawer", "Content").has("snapPoint")).toBe(false)
    expect(part("Popover", "Content").has("slot")).toBe(false)
    expect(result.leftOut).toContainEqual({
      component: "Slider",
      part: "Thumb",
      attribute: "data-index",
      reason: UI_SDK_NOT_STATES.get("data-index"),
    })
    expect(result.leftOut).toContainEqual(
      expect.objectContaining({
        component: "ColorPicker",
        part: "AreaThumb",
        attribute: "data-area-thumb",
      })
    )
  })

  it("has every attribute a part renders, without a DOM", async () => {
    // ui-sdk's testing entry reads what a part renders (`partAttrs`), and its kernel what `live`
    // writes (`liveAttrs`); `mount` would need a DOM this environment does not have.
    const { partAttrs } = (await import(
      pathToFileURL(path.join(dist, "testing.js")).href
    )) as { partAttrs: (part: unknown) => Record<string, unknown> }
    const { liveAttrs } = (await import(
      pathToFileURL(path.join(dist, "foundation/kernel/part.js")).href
    )) as { liveAttrs: (part: unknown) => Record<string, unknown> }
    const options: Record<string, unknown>[] = [
      {},
      { open: true },
      { disabled: true },
      { checked: true },
      { checked: false },
      { checked: "indeterminate" },
      { readOnly: true, required: true },
      { orientation: "vertical" },
      { value: "a" },
      { value: ["a"] },
      { invalid: true },
      { pressed: true },
    ]
    const props: Record<string, unknown>[] = [
      {},
      { disabled: true },
      { value: "a" },
      { orientation: "vertical" },
    ]
    const left = new Set(
      result.leftOut.map(
        (entry) => `${entry.component}.${entry.part} ${entry.attribute}`
      )
    )
    const missing: string[] = []
    let checked = 0
    for (const primitive of await primitives()) {
      const component = pascal(primitive.name)
      for (const [index, given] of options.entries()) {
        let instance: ReturnType<Primitive>
        try {
          instance = primitive({ id: `check-${index}`, ...given })
        } catch {
          continue
        }
        for (const slot of Object.keys(primitive.slots))
          for (const partProps of props) {
            const rendered: Record<string, unknown> = {}
            try {
              const made = instance.part(slot, partProps)
              Object.assign(rendered, partAttrs(made), liveAttrs(made))
            } catch {
              // A part that reads its element, which only a DOM has.
              continue
            }
            for (const [attribute, value] of Object.entries(rendered)) {
              if (!attribute.startsWith("data-") || value == null) continue
              if (attribute === "data-slot") continue
              checked++
              const name = `${component}.${pascal(slot)}`
              if (left.has(`${name} ${attribute}`)) continue
              const state = [...part(component, pascal(slot)).values()].find(
                (candidate) => candidate.attribute === attribute
              )
              const keyed =
                state &&
                (state.values.length === 0 ||
                  state.values.includes(String(value)) ||
                  (value === "" && state.presence))
              if (!keyed)
                missing.push(`${name} ${attribute}=${JSON.stringify(value)}`)
            }
          }
      }
    }
    expect(checked).toBeGreaterThan(10_000)
    expect([...new Set(missing)]).toEqual([])
  })
})
