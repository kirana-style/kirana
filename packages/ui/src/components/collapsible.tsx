import { props as styleProps } from "@kirana-style/core"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

import type { Sx } from "../lib/sx"

/**
 * Collapsible carries no styling of its own — Base UI animates the panel height
 * and the caller decides what the trigger and panel look like. Each part still
 * takes `sx` so the caller can.
 *
 * Because they have no styles, a part used as another component's `render`
 * element keeps the class that component hands it:
 * `<SidebarMenuButton render={<CollapsibleTrigger />}>` still looks like the
 * button.
 */

/** The class a composing component passed at runtime, joined with `sx`'s. */
function withSx(props: object, sx: Sx) {
  const passed = (props as { className?: unknown }).className
  const own = styleProps(sx)
  return {
    ...own,
    className:
      [typeof passed === "string" ? passed : "", own.className ?? ""]
        .join(" ")
        .trim() || undefined,
  }
}

function Collapsible({
  sx,
  ...props
}: Omit<CollapsiblePrimitive.Root.Props, "className"> & { sx?: Sx }) {
  return (
    <CollapsiblePrimitive.Root
      data-slot="collapsible"
      {...props}
      {...withSx(props, sx)}
    />
  )
}

function CollapsibleTrigger({
  sx,
  ...props
}: Omit<CollapsiblePrimitive.Trigger.Props, "className"> & { sx?: Sx }) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      {...props}
      {...withSx(props, sx)}
    />
  )
}

function CollapsibleContent({
  sx,
  ...props
}: Omit<CollapsiblePrimitive.Panel.Props, "className"> & { sx?: Sx }) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      {...props}
      {...withSx(props, sx)}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
