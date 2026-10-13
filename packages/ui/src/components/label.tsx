import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import { fieldMarker, peer } from "../theme/markers"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight } from "../tokens/typography"

const styles = {
  root: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 1,
    userSelect: "none",
  }),
  // Was `group-data-[disabled=true]:` on the surrounding Field, and
  // `peer-disabled:` on the control this label is paired with. The first is an
  // ancestor relationship, the second a sibling one, and each marker scopes
  // which element is being observed.
  context: css({
    pointerEvents: {
      [fieldMarker.within('[data-disabled="true"]')]: "none",
    },
    cursor: {
      [peer.after(":disabled")]: "not-allowed",
    },
    opacity: {
      [fieldMarker.within('[data-disabled="true"]')]: 0.5,
      [peer.after(":disabled")]: 0.5,
    },
  }),
}

function Label({
  sx,
  ...props
}: Omit<React.ComponentProps<"label">, "className"> & { sx?: Sx }) {
  return (
    <label
      data-slot="label"
      {...props}
      sx={[styles.root, styles.context, sx]}
    />
  )
}

export { Label }
