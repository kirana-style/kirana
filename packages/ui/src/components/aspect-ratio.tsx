import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"

/**
 * The ratio is dynamic, so it is bridged: one class reads a custom property the
 * element sets inline, rather than a class per ratio.
 */

const styles = {
  root: css({ position: "relative", width: "100%" }),
  ratio: (value: number) => css({ aspectRatio: String(value) }),
}

export type AspectRatioProps = Omit<
  React.ComponentProps<"div">,
  "className"
> & {
  /** Width divided by height, e.g. `16 / 9`. */
  ratio?: number
  sx?: Sx
}

function AspectRatio({ ratio = 1, sx, ...props }: AspectRatioProps) {
  return (
    <div
      data-slot="aspect-ratio"
      {...props}
      sx={[styles.root, styles.ratio(ratio), sx]}
    />
  )
}

export { AspectRatio }
