import { props as styleProps } from "@kirana-style/core"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import type { Sx } from "../lib/sx"
import type { VariantProps } from "../recipes/recipe"
import { badge, badgeRing } from "../recipes/badge"

type BadgeProps = Omit<useRender.ComponentProps<"span">, "className"> &
  VariantProps<typeof badge> & { sx?: Sx }

function Badge({ sx, variant, render, ...props }: BadgeProps) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      styleProps(badgeRing, ...badge({ variant }), sx),
      props
    ),
    render,
    state: { slot: "badge", variant },
  })
}

export { Badge, badge as badgeVariants }
export type { BadgeProps }
