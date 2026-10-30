import { css, props as styleProps } from "@kirana-style/core"
import * as ResizablePrimitive from "react-resizable-panels"

import type { Sx } from "../lib/sx"
import { radius, theme } from "../theme/semantic"
import { spacing } from "../tokens/spacing"
import { peer } from "../theme/markers"

const styles = {
  group: css({
    display: "flex",
    width: "100%",
    height: "100%",
    flexDirection: {
      base: "row",
      '[aria-orientation="vertical"]': "column",
    },
  }),

  handle: css({
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.border,
    outlineStyle: "none",
    width: { base: "1px", '[aria-orientation="horizontal"]': "100%" },
    height: { '[aria-orientation="horizontal"]': "1px" },
    boxShadow: { ":focus-visible": `0 0 0 1px ${theme.ring}` },

    // A wider invisible strip so the 1px line is actually grabbable. The
    // library sets `aria-orientation` on the handle, so its axis follows the
    // group's direction with no prop.
    "::after": {
      content: "''",
      position: "absolute",
      top: 0,
      bottom: { base: 0, '[aria-orientation="horizontal"]': null },
      left: { base: "50%", '[aria-orientation="horizontal"]': 0 },
      width: { base: spacing[1], '[aria-orientation="horizontal"]': "100%" },
      height: { '[aria-orientation="horizontal"]': spacing[1] },
      translate: {
        base: "-50% 0",
        '[aria-orientation="horizontal"]': "0 -50%",
      },
    },
  }),

  grip: css({
    zIndex: 10,
    display: "flex",
    height: spacing[6],
    width: spacing[1],
    flexShrink: 0,
    borderRadius: radius.lg,
    backgroundColor: theme.border,
    rotate: {
      [peer.within('[aria-orientation="horizontal"]')]: "90deg",
    },
  }),
}

function ResizablePanelGroup({
  sx,
  ...props
}: Omit<ResizablePrimitive.GroupProps, "className"> & { sx?: Sx }) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      {...props}
      {...styleProps(styles.group, sx)}
    />
  )
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  sx,
  ...props
}: Omit<ResizablePrimitive.SeparatorProps, "className"> & {
  withHandle?: boolean
  sx?: Sx
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      {...props}
      {...styleProps(peer.anchor, styles.handle, sx)}
    >
      {withHandle && <div sx={styles.grip} />}
    </ResizablePrimitive.Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
