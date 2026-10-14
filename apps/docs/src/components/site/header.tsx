/**
 * The site header: logo, mega-menu, theme toggle and "Get started".
 *
 * The menu is packages/ui's NavigationMenu (Base UI), which already morphs its
 * popup between panels of different sizes and slides content in from the side
 * the pointer came from. On top of it sits one pill that glides to whichever
 * trigger the pointer is over — or the open one — measured from the DOM and
 * moved with a spring. Under reduced motion it jumps.
 */
import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { css, props as styleProps } from "@kirana-style/core"
import { Link } from "@tanstack/react-router"
import { Menu01Icon } from "@hugeicons/core-free-icons"
import { motion, useReducedMotion } from "motion/react"

import { ThemeToggle } from "@workspace/shell/theme-toggle"
import { accents, tint } from "@workspace/docs-ui/accent.ts"
import { Button } from "@workspace/ui/components/button"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@workspace/ui/components/navigation-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { Icon } from "@workspace/ui/primitives/icon"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration, easing } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"

import { MenuArt } from "./menu-art"
import { KiranaMark } from "@/brand/kirana-mark-svg"

import { Wordmark } from "./wordmark"
import { MENUS } from "./nav"
import type { Featured, Menu, NavLinkItem } from "./nav"
import { LIFT, REST } from "@/components/site/lift"
import { IconTile } from "./icon-tile"
import { Rail } from "./patterns"

const styles = {
  // Frosted: the page shows through, blurred, as it scrolls under. The blur is on
  // a `::before` layer, not the header: `backdrop-filter` on the header would make
  // it the containing block of the fixed menus inside it.
  header: css({
    position: "sticky",
    insetBlockStart: "0px",
    zIndex: 40,
    isolation: "isolate",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: theme.border,
    "::before": {
      content: "''",
      position: "absolute",
      inset: 0,
      zIndex: -1,
      backgroundColor: `color-mix(in oklab, ${theme.background} 72%, transparent)`,
      backdropFilter: "blur(14px) saturate(1.5)",
    },
  }),
  bar: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[6],
    height: spacing[16],
    paddingInline: { base: spacing[4], [breakpoint.md]: spacing[6] },
  }),
  brand: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    textDecorationLine: "none",
    color: theme.foreground,
  }),
  // The petal K, 21 px tall beside the wordmark.
  logo: css({ height: "21px", width: "auto" }),

  nav: css({
    position: "relative",
    display: { base: "none", [breakpoint.lg]: "flex" },
  }),
  pill: css({
    position: "absolute",
    insetBlock: "4px",
    borderRadius: radius.full,
    backgroundColor: alpha.muted50,
    pointerEvents: "none",
  }),
  // The pill is the hover state: the trigger keeps no background of its own.
  trigger: css({
    position: "relative",
    borderRadius: radius.full,
    paddingInline: spacing["3.5"],
    backgroundColor: { "*": null, base: "transparent" },
    color: {
      base: theme.mutedForeground,
      ":hover": theme.foreground,
      "[data-popup-open]": theme.foreground,
    },
  }),
  plainLink: css({
    position: "relative",
    display: "inline-flex",
    height: spacing[9],
    alignItems: "center",
    borderRadius: radius.full,
    paddingInline: spacing["3.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    textDecorationLine: "none",
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
  }),

  actions: css({
    marginInlineStart: "auto",
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
  }),
  getStarted: css({
    display: { base: "none", [breakpoint.sm]: "inline-flex" },
  }),
  mobileTrigger: css({
    display: { base: "inline-flex", [breakpoint.lg]: "none" },
  }),

  // Panels
  panel: css({
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "minmax(0, 1fr)",
    padding: spacing[2],
    gap: spacing[2],
  }),
  panelWide: css({ width: "60rem" }),
  panelMedium: css({ width: "48rem" }),
  panelNarrow: css({ width: "34rem" }),
  // A framed card: the illustration on top, the words underneath. Hover
  // lights the border in the card's accent and lifts the scene a little.
  featured: css({
    display: "grid",
    gridTemplateRows: "auto 1fr",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: { base: theme.border, ":focus-visible": tint(60) },
    // The kit's link pads its content and greys on hover and focus; this
    // card is flush and keeps its own ground, under the same conditions.
    padding: 0,
    backgroundColor: {
      base: theme.card,
      ":hover": theme.card,
      ":focus": theme.card,
      "[data-active]": theme.card,
    },
    textDecorationLine: "none",
    color: theme.foreground,
    outlineStyle: "none",
    transitionProperty: "border-color, box-shadow",
    transitionDuration: duration[200],
    boxShadow: {
      base: REST,
      ":hover": LIFT,
      ":focus-visible": `0 0 0 3px ${tint(25)}`,
    },
  }),
  art: css({
    position: "relative",
    isolation: "isolate",
    display: "grid",
    placeItems: "center",
    height: "9rem",
    overflow: "hidden",
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
    backgroundColor: theme.background,
  }),
  artGrid: css({
    position: "absolute",
    inset: 0,
    zIndex: -1,
    backgroundImage: `linear-gradient(to right, ${alpha.foreground5} 1px, transparent 1px), linear-gradient(to bottom, ${alpha.foreground5} 1px, transparent 1px)`,
    backgroundSize: "20px 20px",
    maskImage:
      "radial-gradient(ellipse 60% 60% at 50% 50%, black 30%, transparent 100%)",
  }),
  artGlow: css({
    position: "absolute",
    insetBlockStart: "50%",
    insetInlineStart: "50%",
    width: "12rem",
    height: "12rem",
    translate: "-50% -50%",
    zIndex: -1,
    borderRadius: radius.full,
    backgroundImage: `radial-gradient(circle, ${tint(100)}, transparent 68%)`,
    filter: "blur(36px)",
    opacity: { base: 0.14, ":is([data-featured]:hover *)": 0.26 },
    transitionProperty: "opacity",
    transitionDuration: duration[300],
    transitionTimingFunction: easing.inOut,
  }),
  artScene: css({
    translate: { base: "0 0", ":is([data-featured]:hover *)": "0 -3px" },
    transitionProperty: "translate",
    transitionDuration: duration[300],
    transitionTimingFunction: easing.inOut,
  }),
  featuredCopy: css({
    display: "grid",
    alignContent: "start",
    gap: spacing[1],
    padding: spacing[4],
  }),
  featuredTitle: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
  }),
  featuredText: css({
    fontSize: fontSize.xs,
    lineHeight: "1.55",
    color: theme.mutedForeground,
  }),
  column: css({ display: "grid", alignContent: "start", gap: spacing["0.5"] }),
  columnTitle: css({
    paddingInline: spacing[3],
    paddingBlock: spacing[2],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),
  row: css({
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    alignItems: "center",
    gap: spacing[3],
    borderRadius: radius.lg,
    padding: spacing[2],
    paddingInlineEnd: spacing[3],
    textDecorationLine: "none",
    color: theme.foreground,
    backgroundColor: { base: "transparent", ":hover": alpha.muted50 },
    transitionProperty: "background-color",
    transitionDuration: duration[150],
  }),
  rowText: css({ display: "grid", minWidth: 0 }),
  rowTitle: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
  }),
  rowDescription: css({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),

  // Mobile
  sheet: css({ overflowY: "auto" }),
  mobileGroups: css({
    display: "grid",
    gap: spacing[6],
    paddingInline: spacing[4],
    paddingBlockEnd: spacing[8],
  }),
  mobileGroup: css({ display: "grid", gap: spacing[1] }),
}

function Row({ link }: { link: NavLinkItem }) {
  return (
    <NavigationMenuLink render={<DocsLink href={link.href} />} sx={styles.row}>
      <IconTile icon={link.icon} tone="muted" />
      <span sx={styles.rowText}>
        <span sx={styles.rowTitle}>{link.title}</span>
        <span sx={styles.rowDescription}>{link.description}</span>
      </span>
    </NavigationMenuLink>
  )
}

function FeaturedCard({ item }: { item: Featured }) {
  return (
    <NavigationMenuLink
      render={<DocsLink href={item.href} />}
      sx={[accents[item.accent], styles.featured]}
      data-featured=""
    >
      <span sx={styles.art} aria-hidden="true">
        <span sx={styles.artGrid} />
        <span sx={styles.artGlow} />
        <span sx={styles.artScene}>
          <MenuArt kind={item.art} />
        </span>
      </span>
      <span sx={styles.featuredCopy}>
        <span sx={styles.featuredTitle}>{item.title}</span>
        <span sx={styles.featuredText}>{item.description}</span>
      </span>
    </NavigationMenuLink>
  )
}

function Panel({ menu }: { menu: Menu }) {
  const wide = menu.featured.length > 0 && menu.columns.length > 1
  const medium = menu.featured.length > 0 && !wide
  return (
    <div
      sx={[
        styles.panel,
        wide
          ? styles.panelWide
          : medium
            ? styles.panelMedium
            : styles.panelNarrow,
      ]}
    >
      {menu.featured.map((item) => (
        <FeaturedCard key={item.title} item={item} />
      ))}
      {menu.columns.map((column, index) => (
        <div key={column.title ?? index} sx={styles.column}>
          {column.title ? (
            <span sx={styles.columnTitle}>{column.title}</span>
          ) : null}
          {column.links.map((link) => (
            <Row key={link.href} link={link} />
          ))}
        </div>
      ))}
    </div>
  )
}

type PillBox = { left: number; width: number } | null

function DesktopNav() {
  const reduce = useReducedMotion()
  const wrap = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [box, setBox] = useState<PillBox>(null)

  const measure = useCallback((key: string | null) => {
    const root = wrap.current
    const target = key
      ? root?.querySelector<HTMLElement>(`[data-pill="${key}"]`)
      : null
    if (!root || !target) return setBox(null)
    const outer = root.getBoundingClientRect()
    const inner = target.getBoundingClientRect()
    setBox({ left: inner.left - outer.left, width: inner.width })
  }, [])

  useLayoutEffect(() => measure(hover ?? open), [hover, open, measure])

  return (
    <div
      ref={wrap}
      sx={styles.nav}
      onPointerOver={(event) => {
        const item = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-pill]"
        )
        if (item) setHover(item.dataset.pill ?? null)
      }}
      onPointerLeave={() => setHover(null)}
    >
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={
          box
            ? { left: box.left, width: box.width, opacity: 1 }
            : { opacity: 0 }
        }
        transition={
          reduce
            ? { duration: 0 }
            : { type: "spring", bounce: 0, duration: 0.28 }
        }
        {...styleProps(styles.pill)}
      />
      <NavigationMenu
        value={open}
        onValueChange={(value) => setOpen((value as string | null) ?? null)}
      >
        <NavigationMenuList>
          {MENUS.map((menu) => (
            <NavigationMenuItem key={menu.title} value={menu.title}>
              <NavigationMenuTrigger data-pill={menu.title} sx={styles.trigger}>
                {menu.title}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <Panel menu={menu} />
              </NavigationMenuContent>
            </NavigationMenuItem>
          ))}
          <NavigationMenuItem>
            <NavigationMenuLink
              render={<DocsLink href="/sponsors" />}
              data-pill="Sponsor"
              sx={styles.plainLink}
            >
              Sponsor
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  )
}

function MobileNav() {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Menu"
            sx={styles.mobileTrigger}
          />
        }
      >
        <Icon icon={Menu01Icon} />
      </SheetTrigger>
      <SheetContent side="right" sx={styles.sheet}>
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav sx={styles.mobileGroups} onClick={() => setOpen(false)}>
          {MENUS.map((menu) => (
            <div key={menu.title} sx={styles.mobileGroup}>
              <span sx={styles.columnTitle}>{menu.title}</span>
              {[...menu.featured, ...menu.columns.flatMap((c) => c.links)].map(
                (link) => (
                  <DocsLink
                    key={link.href + link.title}
                    href={link.href}
                    sx={styles.row}
                  >
                    <IconTile icon={link.icon} tone="muted" />
                    <span sx={styles.rowText}>
                      <span sx={styles.rowTitle}>{link.title}</span>
                      <span sx={styles.rowDescription}>{link.description}</span>
                    </span>
                  </DocsLink>
                )
              )}
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

export function SiteHeader() {
  return (
    <header sx={styles.header}>
      <Rail sx={styles.bar}>
        <Link to="/" aria-label="Kirana, home" {...styleProps(styles.brand)}>
          {/* The petal K in one colour (the gradients are not final), beside the name. */}
          <KiranaMark variant="solid" title={null} sx={styles.logo} />
          <Wordmark />
        </Link>
        <DesktopNav />
        <div sx={styles.actions}>
          <ThemeToggle />
          <Button
            size="sm"
            nativeButton={false}
            sx={styles.getStarted}
            render={
              <DocsLink href="/docs/start/quick-start">Get started</DocsLink>
            }
          />
          <MobileNav />
        </div>
      </Rail>
    </header>
  )
}
