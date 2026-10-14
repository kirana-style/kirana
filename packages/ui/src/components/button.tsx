import { props as styleProps } from "@kirana-style/core"
import * as React from "react"

import { Button as ButtonPrimitive } from "@base-ui/react/button"

import type { Sx } from "../lib/sx"
import type { VariantProps } from "../recipes/recipe"
import { button, buttonLabel, buttonRing } from "../recipes/button"
import { groupedItem } from "../recipes/button-group"

type ButtonProps = Omit<ButtonPrimitive.Props, "className"> &
  VariantProps<typeof button> & { sx?: Sx }

/**
 * Wraps each run of text in a label element so it can be trimmed to cap height.
 * Icons and other elements pass through untouched and stay flex items.
 */
function withLabels(children: React.ReactNode) {
  return React.Children.map(children, (child) =>
    typeof child === "string" || typeof child === "number" ? (
      <span data-slot="button-label" sx={buttonLabel}>
        {child}
      </span>
    ) : (
      child
    )
  )
}

function Button({ sx, variant, size, children, ...props }: ButtonProps) {
  // `nativeButton={false}` is a button drawn on a link (`render={<a href>}`): it keeps the link's
  // role, where Base UI would announce it as a button.
  const link =
    props.nativeButton === false ? { role: props.role ?? "link" } : null
  return (
    <ButtonPrimitive
      data-slot="button"
      {...props}
      {...link}
      {...styleProps(buttonRing, ...button({ variant, size }), groupedItem, sx)}
    >
      {typeof children === "function" ? children : withLabels(children)}
    </ButtonPrimitive>
  )
}

export { Button, button as buttonVariants }
export type { ButtonProps }
