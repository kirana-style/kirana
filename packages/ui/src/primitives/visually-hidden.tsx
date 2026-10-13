/**
 * Layer 5: visually hidden text, replacing Tailwind's `sr-only`.
 *
 * Used for the accessible names of icon-only controls — a dialog's close button
 * has nothing but an X in it, so the label has to live somewhere a screen reader
 * can still reach.
 */

import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"

const styles = {
  root: css({
    position: "absolute",
    width: "1px",
    height: "1px",
    // Caps the box even where a parent forces a width on its children, as a
    // vertical Field does (see "Field layout" in globals.css).
    maxWidth: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    // `rect(0 0 0 0)` rather than `display: none`, so the text stays in the
    // accessibility tree instead of being removed from it.
    clipPath: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  }),
}

export type VisuallyHiddenProps = Omit<
  React.ComponentProps<"span">,
  "className"
> & { sx?: Sx }

export function VisuallyHidden({ sx, ...props }: VisuallyHiddenProps) {
  return <span {...props} sx={[styles.root, sx]} />
}

/** The style itself, for elements that cannot be a `span`. */
export const visuallyHidden = styles.root
