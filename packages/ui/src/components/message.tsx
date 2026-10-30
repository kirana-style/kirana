import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import { messageMarker } from "../theme/markers"
import { theme } from "../theme/semantic"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"

/**
 * A message row: avatar on one side, content on the other, optional header and
 * footer bands.
 *
 * `align="end"` reverses the row for the current user's own messages. Parts read
 * that from the row's marker rather than being styled by it.
 */

const styles = {
  group: css({
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: spacing[2],
  }),

  root: css({
    position: "relative",
    display: "flex",
    width: "100%",
    minWidth: 0,
    gap: spacing[2],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    flexDirection: { base: "row", '[data-align="end"]': "row-reverse" },
  }),

  avatar: css({
    display: "flex",
    width: "fit-content",
    minWidth: spacing[8],
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
    overflow: "hidden",
    borderRadius: "calc(infinity * 1px)",
    backgroundColor: theme.muted,
    translate: {
      [messageMarker.within(':has([data-slot="message-footer"])')]:
        `0 calc(${spacing[8]} * -1)`,
    },
  }),

  content: css({
    display: "flex",
    width: "100%",
    minWidth: 0,
    flexDirection: "column",
    gap: spacing["2.5"],
    overflowWrap: "break-word",
    alignItems: {
      [messageMarker.within('[data-align="end"]')]: "flex-end",
    },
  }),

  band: css({
    display: "flex",
    maxWidth: "100%",
    minWidth: 0,
    alignItems: "center",
    paddingInline: {
      base: spacing[3],
      [messageMarker.within(':has([data-variant="ghost"])')]: 0,
    },
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    color: theme.mutedForeground,
  }),
  footer: css({
    justifyContent: {
      [messageMarker.within('[data-align="end"]')]: "flex-end",
    },
  }),
}

type El = Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }

function MessageGroup({ sx, ...props }: El) {
  return <div data-slot="message-group" {...props} sx={[styles.group, sx]} />
}

function Message({
  sx,
  align = "start",
  ...props
}: El & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      {...props}
      sx={[messageMarker.anchor, styles.root, sx]}
    />
  )
}

function MessageAvatar({ sx, ...props }: El) {
  return <div data-slot="message-avatar" {...props} sx={[styles.avatar, sx]} />
}

function MessageContent({ sx, ...props }: El) {
  return (
    <div data-slot="message-content" {...props} sx={[styles.content, sx]} />
  )
}

function MessageHeader({ sx, ...props }: El) {
  return <div data-slot="message-header" {...props} sx={[styles.band, sx]} />
}

function MessageFooter({ sx, ...props }: El) {
  return (
    <div
      data-slot="message-footer"
      {...props}
      sx={[styles.band, styles.footer, sx]}
    />
  )
}

export {
  MessageGroup,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
}
