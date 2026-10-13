import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import { animation } from "../theme/animations"
import { radius, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"

const styles = {
  root: css({
    borderRadius: radius.md,
    backgroundColor: theme.muted,
    animationName: animation.pulse,
    animationDuration: duration[2000],
    animationIterationCount: "infinite",
    animationTimingFunction: easing.pulse,
  }),
}

function Skeleton({
  sx,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }) {
  return <div data-slot="skeleton" {...props} sx={[styles.root, sx]} />
}

export { Skeleton }
