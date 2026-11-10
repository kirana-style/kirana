import { existsSync, readFileSync, realpathSync } from "node:fs"
import path from "node:path"

import { css } from "@kirana-style/core"
import { describe, expect, it } from "vite-plus/test"

import * as bits from "../src/bits-ui.ts"
import * as ng from "../src/ng-primitives.ts"
import * as reka from "../src/reka-ui.ts"
import { entries, SELECTOR } from "./entries.ts"

/** A package's directory: Bits UI's `exports` hide its `package.json` from the resolver. */
const packageOf = (name: string) =>
  realpathSync(path.join(import.meta.dirname, "../../../node_modules", name))

/** Reka UI, Bits UI and Angular Primitives: the vocabularies read from each library's own code. */
describe("@kirana-style/states for Vue, Svelte and Angular libraries", () => {
  it("names only parts each library exports", () => {
    const rekaSource = path.join(packageOf("reka-ui"), "src")
    for (const [component, part] of entries(reka)) {
      const index = readFileSync(
        path.join(rekaSource, component, "index.ts"),
        "utf8"
      )
      const name =
        part === "Root" && !index.includes(`default as ${component}Root`)
          ? component
          : `${component}${part}`
      expect(index, `${component}.${part}`).toContain(`default as ${name}`)
    }
    const bitsSource = path.join(packageOf("bits-ui"), "dist/bits")
    const folders = new Map(
      [
        ...readFileSync(path.join(bitsSource, "index.d.ts"), "utf8").matchAll(
          /export \{ ([^}]+) \} from "\.\/([\w-]+)\/index\.js"/g
        ),
      ].flatMap(([, names, folder]) =>
        names!
          .split(",")
          .map((name) => name.trim())
          .map((name) => [name, folder!] as const)
      )
    )
    for (const [component, part] of entries(bits)) {
      const exports = readFileSync(
        path.join(bitsSource, folders.get(component)!, "exports.d.ts"),
        "utf8"
      )
      expect(exports, `${component}.${part}`).toContain(`default as ${part} }`)
    }
    const ngModules = path.join(packageOf("ng-primitives"), "fesm2022")
    for (const [component, part] of entries(ng)) {
      const kebab = component.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
      const file = path.join(ngModules, `ng-primitives-${kebab}.mjs`)
      expect(existsSync(file), component).toBe(true)
      const directive =
        part === "Root" ? `Ngp${component}` : `Ngp${component}${part}`
      expect(readFileSync(file, "utf8"), `${component}.${part}`).toMatch(
        new RegExp(`class (?:${directive}|Ngp${part}) \\{`)
      )
    }
  })

  it("holds attribute selectors only, one per state or value", () => {
    for (const vocabulary of [reka, bits, ng]) {
      const all = entries(vocabulary)
      expect(all.length).toBeGreaterThan(200)
      for (const [component, part, state, selector] of all)
        expect(selector, `${component}.${part}.${state}`).toMatch(SELECTOR)
    }
    // A value read from the template, through the helper it calls.
    expect(reka.Checkbox.Root.state.indeterminate).toBe(
      '[data-state="indeterminate"]'
    )
    // An attribute set by the component the part renders through (`PopperContent`).
    expect(reka.Popover.Content.side).toBe("[data-side]")
    // Values the code computes, followed through what the template reads (KF-115): the component
    // a part renders inside `as-child` (`Radio`), a context's member by its declared type, a helper
    // imported from another component (`getOpenState`), an enum, a `ref<…>`'s type.
    expect(reka.RadioGroup.Item.state).toEqual({
      checked: '[data-state="checked"]',
      unchecked: '[data-state="unchecked"]',
    })
    for (const part of [reka.Tooltip.Content, reka.Tooltip.Trigger])
      expect(part.state).toEqual({
        open: '[data-state$="open"]',
        closed: '[data-state="closed"]',
        delayedOpen: '[data-state="delayed-open"]',
        instantOpen: '[data-state="instant-open"]',
      })
    expect(reka.Dialog.Content.state).toEqual({
      open: '[data-state="open"]',
      closed: '[data-state="closed"]',
    })
    expect(reka.Accordion.Header.state).toEqual({
      open: '[data-state="open"]',
      closed: '[data-state="closed"]',
    })
    expect(reka.Progress.Indicator.state).toEqual({
      indeterminate: '[data-state="indeterminate"]',
      loading: '[data-state="loading"]',
      complete: '[data-state="complete"]',
    })
    expect(reka.Splitter.ResizeHandle.state).toEqual({
      drag: '[data-state="drag"]',
      hover: '[data-state="hover"]',
      inactive: '[data-state="inactive"]',
    })
    for (const part of [reka.Stepper.Separator, reka.Stepper.Trigger])
      expect(part.state).toEqual({
        completed: '[data-state="completed"]',
        active: '[data-state="active"]',
        inactive: '[data-state="inactive"]',
      })
    expect(bits.Popover.Content.state.open).toBe('[data-state="open"]')
    expect(bits.Popover.Content.startingStyle).toBe("[data-starting-style]")
    // Angular Primitives' interactions, which `ngpInteractions()` turns on.
    expect(ng.Checkbox.Root.hover).toBe("[data-hover]")
    expect(ng.Checkbox.Root.checked).toBe("[data-checked]")
    // A host binding (KF-099): a boolean Angular writes as text, and a value the code computes.
    expect(ng.Toast.Root.visible.true).toBe('[data-visible="true"]')
    expect(ng.Toast.Root.positionX.end).toBe('[data-position-x="end"]')
    expect(ng.Combobox.Root.pristine).toBe("[data-pristine]")
    expect(ng.exclusive).toContainEqual(["[data-pristine]", "[data-dirty]"])
    // A binding's values from the type it reads (KF-100): an alias in another entry point, an
    // overlay's placement, a string enum, a signal of the block computed from literals.
    expect(ng.Tabs.Tabset.orientation.vertical).toBe(
      '[data-orientation="vertical"]'
    )
    expect(ng.Menu.Trigger.placement.bottomStart).toBe(
      '[data-placement="bottom-start"]'
    )
    expect(ng.Tooltip.Root.placement.top).toBe('[data-placement="top"]')
    expect(ng.Avatar.Root.status.loaded).toBe('[data-status="loaded"]')
    expect(ng.FormField.Error.validator).toEqual({
      fail: '[data-validator="fail"]',
      pass: '[data-validator="pass"]',
    })
    // A boolean stays a presence: `dataBinding` writes `true` as an empty attribute.
    expect(ng.Tabs.TabButton.active).toBe("[data-active]")
    // A part that composes another primitive has its states (KF-102): the accordion's item, trigger
    // and content the collapsible's, a menu item its button's at two levels, a checkbox its form
    // control's, Dialog its host directive's, an arrow its overlay's placement.
    expect(ng.Accordion.Item.open).toBe("[data-open]")
    expect(ng.Accordion.Trigger.disabled).toBe("[data-disabled]")
    expect(ng.Accordion.Content.closed).toBe("[data-closed]")
    expect(ng.Accordion.Item.orientation.vertical).toBe(
      '[data-orientation="vertical"]'
    )
    expect(ng.Menu.Item.hover).toBe("[data-hover]")
    expect(ng.Menu.ItemCheckbox.focusVisible).toBe("[data-focus-visible]")
    expect(ng.ContextMenu.Item.press).toBe("[data-press]")
    expect(ng.Checkbox.Root.invalid).toBe("[data-invalid]")
    expect(ng.Dialog.Root.focusTrap).toBe("[data-focus-trap]")
    expect(ng.Popover.Arrow.placement.top).toBe('[data-placement="top"]')
    // A state bound with `attrBinding`, which writes its value as text.
    expect(ng.Menu.Root.placement.bottomStart).toBe(
      '[data-placement="bottom-start"]'
    )
    expect(ng.Separator.Root.orientation.horizontal).toBe(
      '[data-orientation="horizontal"]'
    )
    expect(ng.exclusive).toContainEqual(["[data-open]", "[data-closed]"])
  })

  it("names a state written bare and with a value, and what a portal writes (KF-100, KF-102)", () => {
    // Button writes `data-disabled="soft"`, or an empty one when hard-disabled: `any` is the
    // attribute's presence, whatever its value. A menu item composes the button.
    expect(ng.Button.Root.disabled).toEqual({
      any: "[data-disabled]",
      soft: '[data-disabled="soft"]',
    })
    expect(ng.Menu.Item.disabled.any).toBe("[data-disabled]")
    expect(ng.Menu.ItemCheckbox.disabled.any).toBe("[data-disabled]")
    expect(ng.Menu.Item.disabled.soft).toBe('[data-disabled="soft"]')
    // The portal marks the elements it renders as they enter and leave: an overlay's content, which
    // places itself where the overlay positions it, a toast, and a dialog through `NgpExitAnimation`.
    for (const part of [
      ng.Popover.Root,
      ng.Tooltip.Root,
      ng.Menu.Root,
      ng.ContextMenu.Root,
      ng.PreviewCard.Root,
      ng.NavigationMenu.Content,
      ng.Select.Dropdown,
      ng.Combobox.Dropdown,
      ng.Toast.Root,
      ng.Dialog.Root,
      ng.Dialog.Overlay,
    ])
      expect(part).toMatchObject({ enter: "[data-enter]", exit: "[data-exit]" })
    // The overlay also marks an instant transition on its content.
    expect(ng.Popover.Root.instant).toBe("[data-instant]")
    expect(ng.Dialog.Root).not.toHaveProperty("instant")
    // The trigger and the arrow are not what the portal renders.
    expect(ng.Popover.Trigger).not.toHaveProperty("enter")
    expect(ng.Popover.Arrow).not.toHaveProperty("enter")
  })

  it("names what Bits UI's floating layer writes on each content it positions (KF-117)", () => {
    // The popper layer renders the floating layer's content four files below the part, and its
    // state's `props` (`$derived`, not `readonly` in the declarations) write the placed side and
    // alignment.
    const floating = [
      bits.Popover.Content,
      bits.Tooltip.Content,
      bits.DropdownMenu.Content,
      bits.DropdownMenu.SubContent,
      bits.ContextMenu.Content,
      bits.ContextMenu.SubContent,
      bits.Menubar.Content,
      bits.Menubar.SubContent,
      bits.LinkPreview.Content,
      bits.Select.Content,
      bits.Combobox.Content,
      bits.DatePicker.Content,
      bits.DateRangePicker.Content,
    ]
    for (const part of floating)
      expect(part).toMatchObject({
        side: {
          top: '[data-side="top"]',
          right: '[data-side="right"]',
          bottom: '[data-side="bottom"]',
          left: '[data-side="left"]',
        },
        align: {
          start: '[data-align="start"]',
          center: '[data-align="center"]',
          end: '[data-align="end"]',
        },
      })
    // A static content is not positioned: the popper layer renders the static one, which writes
    // neither, also through another component's static content (Menubar's is Menu's).
    for (const part of [
      bits.Popover.ContentStatic,
      bits.DropdownMenu.ContentStatic,
      bits.Menubar.ContentStatic,
      bits.DatePicker.ContentStatic,
      bits.Select.ContentStatic,
    ]) {
      expect(part).not.toHaveProperty("side")
      expect(part).not.toHaveProperty("align")
    }
    expect(bits.Popover.Arrow.side.top).toBe('[data-side="top"]')
    // A marker naming another component is not a state; a value naming one is.
    expect(bits.Menubar.Content).not.toHaveProperty("menuContent")
    expect(bits.Menubar.Trigger.menuValue).toBe("[data-menu-value]")
    // Other writable `props` the same reading finds.
    expect(bits.Avatar.Root.status).toBe("[data-status]")
    expect(bits.TimeRangeField.Root.invalid).toBe("[data-invalid]")
  })

  it("names a floating content's side and alignment wherever its arrow has a side (KF-117)", () => {
    // Read more simply than the generator: an arrow follows the floating content's side, so a
    // component with one positions its content.
    const missing = Object.entries(bits).flatMap(([component, parts]) => {
      const { Arrow, Content } = parts as Record<
        string,
        Record<string, unknown>
      >
      if (!Arrow || !("side" in Arrow)) return []
      return Content && "side" in Content && "align" in Content
        ? []
        : [component]
    })
    expect(missing).toEqual([])
  })

  it("compiles as condition keys", () => {
    const thumb = css({
      opacity: {
        [reka.Switch.Root.state.checked]: 1,
        [reka.Tooltip.Content.state.open]: 1,
      },
      color: { [bits.Switch.Root.state.checked]: "red" },
      translate: { [ng.Switch.Root.checked]: "1rem" },
    })
    expect(String(thumb)).toMatch(/^k\S+( k\S+){3}$/)
  })
})
