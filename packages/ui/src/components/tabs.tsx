import * as React from "react"
import { css, props as styleProps } from "@kirana-style/core"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import type { Sx } from "../lib/sx"
import type { VariantProps } from "../recipes/recipe"
import { recipe } from "../recipes/recipe"
import { ctx } from "../theme/context"
import { tabsListMarker, tabsMarker } from "../theme/markers"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { shadow } from "../tokens/shadows"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"

const styles = {
  root: css({
    display: "flex",
    gap: spacing[2],
    flexDirection: {
      base: "row",
      '[data-orientation="horizontal"]': "column",
    },
  }),

  listBase: css({
    display: "inline-flex",
    width: "fit-content",
    alignItems: "center",
    justifyContent: "center",
    padding: "3px",
    color: theme.mutedForeground,
    borderRadius: { base: radius.lg, '[data-variant="line"]': 0 },
    height: {
      [tabsMarker.within('[data-orientation="horizontal"]')]: spacing[8],
      [tabsMarker.within('[data-orientation="vertical"]')]: "fit-content",
    },
    flexDirection: {
      [tabsMarker.within('[data-orientation="vertical"]')]: "column",
    },
  }),
  listDefault: css({ backgroundColor: theme.muted }),
  listLine: css({ gap: spacing[1], backgroundColor: "transparent" }),

  trigger: css({
    position: "relative",
    display: "inline-flex",
    height: "calc(100% - 1px)",
    flex: 1,
    alignItems: "center",
    justifyContent: {
      base: "center",
      [tabsMarker.within('[data-orientation="vertical"]')]: "flex-start",
    },
    gap: spacing["1.5"],
    borderRadius: radius.md,
    borderWidth: "1px",
    borderStyle: "solid",
    paddingInline: spacing["1.5"],
    paddingInlineEnd: {
      base: spacing["1.5"],
      ':has([data-icon="inline-end"])': spacing[1],
    },
    paddingInlineStart: {
      base: spacing["1.5"],
      ':has([data-icon="inline-start"])': spacing[1],
    },
    paddingBlock: spacing["0.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    whiteSpace: "nowrap",
    outlineStyle: "none",
    transitionProperty: "color, background-color, border-color, box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
    [ctx.iconSize]: "1rem",

    width: {
      [tabsMarker.within('[data-orientation="vertical"]')]: "100%",
    },

    color: {
      base: surface.inactiveForeground,
      ":hover": theme.foreground,
      "[data-active]": theme.foreground,
    },
    // The line variant clears the active pill. Nested inside `[data-active]`,
    // because the ladder ranks the attribute above the relation read beside it.
    backgroundColor: {
      "[data-active]": {
        base: surface.activeSurface,
        [tabsListMarker.within('[data-variant="line"]')]: "transparent",
      },
    },
    borderColor: {
      base: "transparent",
      ":focus-visible": theme.ring,
      "[data-active]": {
        base: surface.activeBorder,
        [tabsListMarker.within('[data-variant="line"]')]: "transparent",
      },
    },
    boxShadow: {
      ":focus-visible": `0 0 0 ${ring.width} ${alpha.ring50}`,
    },
    pointerEvents: {
      ":disabled": "none",
      '[aria-disabled="true"]': "none",
    },
    opacity: { ":disabled": 0.5, '[aria-disabled="true"]': 0.5 },

    // The underline for the `line` variant. Sits outside the trigger box so it
    // tracks the list edge rather than the pill.
    "::after": {
      content: "''",
      position: "absolute",
      backgroundColor: theme.foreground,
      opacity: 0,
      transitionProperty: "opacity",
      transitionDuration: duration[150],
    },
  }),
  triggerVerticalIndicator: css({
    "::after": {
      insetBlock: 0,
      insetInlineEnd: `calc(${spacing[1]} * -1)`,
      width: "2px",
    },
  }),
  triggerHorizontalIndicator: css({
    "::after": { insetInline: 0, bottom: "-5px", height: "2px" },
  }),
  triggerLineActive: css({ "::after": { opacity: 1 } }),
  triggerDefaultActive: css({
    boxShadow: {
      "[data-active]": shadow.sm,
      ":focus-visible": `0 0 0 ${ring.width} ${alpha.ring50}`,
    },
  }),

  content: css({
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    outlineStyle: "none",
  }),
}

const tabsList = recipe({
  base: styles.listBase,
  variants: {
    variant: { default: styles.listDefault, line: styles.listLine },
  },
  defaults: { variant: "default" },
})

function Tabs({
  sx,
  orientation = "horizontal",
  ...props
}: Omit<TabsPrimitive.Root.Props, "className"> & { sx?: Sx }) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      // Base UI needs it too, or arrow keys and each tab's state stay horizontal.
      orientation={orientation}
      {...props}
      {...styleProps(tabsMarker.anchor, styles.root, sx)}
    />
  )
}

/** The list's variant, which decides how its active trigger is drawn. */
const TabsListVariantContext = React.createContext<"default" | "line">(
  "default"
)

function TabsList({
  sx,
  variant,
  children,
  ...props
}: Omit<TabsPrimitive.List.Props, "className"> &
  VariantProps<typeof tabsList> & { sx?: Sx }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant ?? "default"}
      {...props}
      {...styleProps(tabsListMarker.anchor, ...tabsList({ variant }), sx)}
    >
      <TabsListVariantContext value={variant ?? "default"}>
        {children}
      </TabsListVariantContext>
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  sx,
  ...props
}: Omit<TabsPrimitive.Tab.Props, "className"> & { sx?: Sx }) {
  const variant = React.useContext(TabsListVariantContext)
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      {...props}
      // Base UI hands the tab's state to a className function, so the active
      // indicator and its edge follow the real state rather than an attribute
      // query inside a pseudo-element.
      className={(state) =>
        styleProps(
          styles.trigger,
          state.orientation === "vertical"
            ? styles.triggerVerticalIndicator
            : styles.triggerHorizontalIndicator,
          variant === "line"
            ? state.active && styles.triggerLineActive
            : styles.triggerDefaultActive,
          sx
        ).className ?? ""
      }
    />
  )
}

function TabsContent({
  sx,
  ...props
}: Omit<TabsPrimitive.Panel.Props, "className"> & { sx?: Sx }) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      {...props}
      {...styleProps(styles.content, sx)}
    />
  )
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  tabsList as tabsListVariants,
}
