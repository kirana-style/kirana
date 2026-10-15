import { css } from "@kirana-style/core"
import * as React from "react"
import {
  ComputerIcon,
  LinkSquare02Icon,
  SmartPhone01Icon,
  Tablet01Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { Icon } from "@workspace/ui/primitives/icon"
import { VisuallyHidden } from "@workspace/ui/primitives/visually-hidden"
import { radius, surface, theme } from "@workspace/ui/theme/semantic"
import { useTheme } from "@workspace/ui/theme/theme-provider"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

const WIDTHS = [
  { value: "100%", icon: ComputerIcon, label: "Desktop" },
  { value: "768px", icon: Tablet01Icon, label: "Tablet" },
  { value: "390px", icon: SmartPhone01Icon, label: "Mobile" },
] as const

const styles = {
  root: css({
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: spacing["4"],
    padding: { base: spacing["4"], [breakpoint.sm]: spacing["6"] },
  }),
  toolbar: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing["4"],
  }),
  heading: css({
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    gap: spacing["1"],
  }),
  title: css({
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: fontWeight.medium,
  }),
  description: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
  }),
  stage: css({
    display: "flex",
    justifyContent: "center",
    borderRadius: radius.xl,
    backgroundColor: surface.page,
    padding: spacing["2"],
  }),
  frame: css({
    height: "800px",
    maxWidth: "100%",
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.background,
  }),
  width: (width: string) => css({ width }),
}

/**
 * A full-page block shown inside the app. The block renders in an iframe on its
 * own bare `/view/<name>` route, so its sidebar never nests inside ours and its
 * breakpoints answer to the frame's width, as they would on a real page.
 */
export function BlockViewer({
  name,
  title,
  description,
}: {
  name: string
  title: string
  description?: string
}) {
  const [width, setWidth] = React.useState<string>("100%")
  const { mode } = useTheme()
  const src = `/view/${name}?theme=${mode}`

  return (
    <div sx={styles.root}>
      <div sx={styles.toolbar}>
        <div sx={styles.heading}>
          <h1 sx={styles.title}>{title}</h1>
          {description && <p sx={styles.description}>{description}</p>}
        </div>
        <ToggleGroup
          spacing={0}
          variant="outline"
          size="sm"
          value={[width]}
          onValueChange={(value) => {
            if (value[0]) setWidth(value[0])
          }}
          aria-label="Preview width"
        >
          {WIDTHS.map(({ value, icon, label }) => (
            <ToggleGroupItem key={value} value={value} title={label}>
              <Icon icon={icon} />
              <VisuallyHidden>{label}</VisuallyHidden>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button
          variant="outline"
          size="sm"
          render={<a href={src} target="_blank" rel="noreferrer" />}
          nativeButton={false}
        >
          <Icon icon={LinkSquare02Icon} data-icon="inline-start" />
          Open
        </Button>
      </div>
      <div sx={styles.stage}>
        <iframe
          key={mode}
          src={src}
          title={title}
          sx={[styles.frame, styles.width(width)]}
        />
      </div>
    </div>
  )
}
