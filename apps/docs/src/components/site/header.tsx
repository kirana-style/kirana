/**
 * The site header: logo, the three menus, the repository with its stars, the sponsor heart and
 * "Quick start" (`cta.tsx`). The theme is chosen in the footer.
 *
 * The menu is packages/ui's NavigationMenu (Base UI), which already morphs its
 * popup between panels of different sizes and slides content in from the side
 * the pointer came from. On top of it sits one pill that glides to whichever
 * trigger the pointer is over — or the open one — measured from the DOM and
 * moved by a CSS transition. Under reduced motion it jumps.
 */
import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { css, props as styleProps } from "@kirana-style/core"
import { Link } from "@tanstack/react-router"
import { FavouriteIcon, Menu01Icon } from "@hugeicons/core-free-icons"

import { accents, tint } from "@workspace/docs-ui/accent.ts"
import { BrandIcon } from "@workspace/docs-ui/brand-icon.tsx"
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
import { breakpoint, pointer } from "@workspace/ui/tokens/breakpoints"
import { duration, easing, motion } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { GITHUB } from "@/data/links"
import { SVGL } from "@/generated/svgl-icons.gen"
import { compact, useRepoStats } from "@/lib/repo-stats"

import { KiranaMark } from "@/brand/kirana-mark-svg"
import { SCENES, sceneImage } from "@/brand/scenes"

import { QuickStart } from "./cta"
import { MenuArt } from "./menu-art"
import { Wordmark } from "./wordmark"
import { MENUS, SPONSOR } from "./nav"
import type { Featured, Menu, NavLinkItem } from "./nav"
import { LIFT, REST } from "@workspace/ui/recipes/lift"
import { IconTile } from "./icon-tile"
import { Rail } from "./patterns"

/** The sponsor heart's rose: a `light-dark()` pair like the palette's, deep on paper, light on the night. */
const HEART = "light-dark(oklch(0.58 0.16 8), oklch(0.8 0.11 8))"

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
    // A finger-sized target on a touch screen.
    minHeight: { [pointer.coarse]: "2.75rem" },
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
  // It slides to the trigger under the pointer and fades out between them, keeping its place.
  pill: css({
    position: "absolute",
    insetBlock: "4px",
    borderRadius: radius.full,
    backgroundColor: alpha.muted50,
    pointerEvents: "none",
    transitionProperty: "left, width, opacity",
    transitionDuration: {
      base: duration["300"],
      [motion.reduce]: duration["0"],
    },
    transitionTimingFunction: easing.emphasized,
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

  actions: css({
    marginInlineStart: "auto",
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
  }),
  // The repository, with its star count once GitHub has answered.
  github: css({
    display: { base: "none", [breakpoint.md]: "inline-flex" },
    gap: spacing["1.5"],
    paddingInline: spacing["2.5"],
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
  }),
  stars: css({
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    fontVariantNumeric: "tabular-nums",
  }),
  // The heart drawn in a soft rose, on no ground of its own, deepening on hover.
  sponsor: css({
    display: { base: "none", [breakpoint.lg]: "inline-flex" },
    backgroundColor: { "*": null, base: "transparent" },
    color: {
      base: `color-mix(in oklab, ${HEART} 85%, transparent)`,
      ":hover": HEART,
    },
    transitionProperty: "color",
    transitionDuration: duration[200],
  }),
  mobileTrigger: css({
    display: { base: "inline-flex", [breakpoint.lg]: "none" },
    minWidth: { [pointer.coarse]: "2.75rem" },
    minHeight: { [pointer.coarse]: "2.75rem" },
  }),

  // Panels: a solid card in a frame of frosted glass, the editor showcase's pane in small. The
  // popup is the glass, the content's padding its width, and the panel the card inside it.
  glass: css({
    borderRadius: "1.25rem",
    backgroundColor:
      "light-dark(rgb(255 255 255 / 0.5), rgb(255 255 255 / 0.06))",
    backdropFilter: "blur(16px) saturate(1.4)",
    boxShadow:
      "0 0 0 1px light-dark(rgb(0 0 0 / 0.07), rgb(255 255 255 / 0.1)), inset 0 1px 0 light-dark(rgb(255 255 255 / 0.8), rgb(255 255 255 / 0.08)), 0 24px 60px -24px rgb(10 20 30 / 0.35)",
  }),
  frame: css({ padding: spacing["1.5"] }),
  panel: css({
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "minmax(0, 1fr)",
    padding: spacing[2],
    gap: spacing[2],
    borderRadius: "0.875rem",
    backgroundColor: theme.popover,
    boxShadow: `0 0 0 1px ${alpha.foreground10}`,
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
    borderRadius: radius["2xl"],
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: { base: theme.border, ":focus-visible": tint(60) },
    // The kit's link pads its content and greys on hover and focus; this
    // card sets its own padding, the picture's inset, and keeps its own
    // ground, under the same conditions.
    padding: spacing[2],
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
    // Inset in the card and rounded with it, as every picture card is (framed-card.tsx).
    borderRadius: `calc(${radius["2xl"]} - ${spacing[2]})`,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.background,
  }),
  // The destination's landscape, softened so the illustration on it reads.
  artPhoto: css({
    position: "absolute",
    inset: 0,
    zIndex: -1,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "saturate(0.9)",
    scale: { base: "1.02", ":is([data-featured]:hover *)": "1.06" },
    transitionProperty: "scale",
    transitionDuration: duration[300],
    transitionTimingFunction: easing.inOut,
  }),
  artVeil: css({
    position: "absolute",
    inset: 0,
    zIndex: -1,
    backgroundImage: `linear-gradient(to bottom, color-mix(in oklab, ${theme.background} 10%, transparent), color-mix(in oklab, ${theme.background} 38%, transparent))`,
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
    padding: spacing[3],
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
  // The sheet has the room the panels lack: the whole line, wrapped, instead of an ellipsis.
  rowDescriptionWrap: css({
    overflow: "visible",
    whiteSpace: "normal",
    textWrap: "pretty",
  }),
  mobileGroups: css({
    display: "grid",
    gap: spacing[6],
    paddingInline: spacing[4],
    paddingBlockEnd: spacing[8],
  }),
  mobileGroup: css({ display: "grid", gap: spacing[1] }),
}

/** A destination's glyph, in the hue of the scene it stands in. */
function Glyph({ link }: { link: NavLinkItem }) {
  return <IconTile icon={link.icon} sx={accents[SCENES[link.scene].hue]} />
}

function Row({ link }: { link: NavLinkItem }) {
  return (
    <NavigationMenuLink render={<DocsLink href={link.href} />} sx={styles.row}>
      <Glyph link={link} />
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
      sx={[accents[SCENES[item.scene].hue], styles.featured]}
      data-featured=""
    >
      <span sx={styles.art} aria-hidden="true">
        <img
          src={sceneImage(item.scene, 800)}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ objectPosition: SCENES[item.scene].position }}
          sx={styles.artPhoto}
        />
        <span sx={styles.artVeil} />
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
  // A featured card beside two columns, or three columns of links, which need the room to keep
  // each description on one line.
  const wide =
    (menu.featured.length > 0 && menu.columns.length > 1) ||
    menu.columns.length >= 3
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
  const wrap = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [box, setBox] = useState<PillBox>(null)
  const [shown, setShown] = useState(false)

  const measure = useCallback((key: string | null) => {
    const root = wrap.current
    const target = key
      ? root?.querySelector<HTMLElement>(`[data-pill="${key}"]`)
      : null
    if (!root || !target) return setShown(false)
    const outer = root.getBoundingClientRect()
    const inner = target.getBoundingClientRect()
    setBox({ left: inner.left - outer.left, width: inner.width })
    setShown(true)
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
      <span
        aria-hidden="true"
        sx={styles.pill}
        style={{ left: box?.left, width: box?.width, opacity: shown ? 1 : 0 }}
      />
      <NavigationMenu
        popupSx={styles.glass}
        value={open}
        onValueChange={(value) => setOpen((value as string | null) ?? null)}
      >
        <NavigationMenuList>
          {MENUS.map((menu) => (
            <NavigationMenuItem key={menu.title} value={menu.title}>
              <NavigationMenuTrigger data-pill={menu.title} sx={styles.trigger}>
                {menu.title}
              </NavigationMenuTrigger>
              <NavigationMenuContent sx={styles.frame}>
                <Panel menu={menu} />
              </NavigationMenuContent>
            </NavigationMenuItem>
          ))}
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
                    <Glyph link={link} />
                    <span sx={styles.rowText}>
                      <span sx={styles.rowTitle}>{link.title}</span>
                      <span
                        sx={[styles.rowDescription, styles.rowDescriptionWrap]}
                      >
                        {link.description}
                      </span>
                    </span>
                  </DocsLink>
                )
              )}
            </div>
          ))}
          <div sx={styles.mobileGroup}>
            <DocsLink href={SPONSOR.href} sx={styles.row}>
              <Glyph link={SPONSOR} />
              <span sx={styles.rowText}>
                <span sx={styles.rowTitle}>{SPONSOR.title}</span>
                <span sx={[styles.rowDescription, styles.rowDescriptionWrap]}>
                  {SPONSOR.description}
                </span>
              </span>
            </DocsLink>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}

function GitHubLink() {
  const { stars } = useRepoStats()
  return (
    <Button
      variant="ghost"
      size="sm"
      nativeButton={false}
      aria-label={
        stars === undefined
          ? "Kirana on GitHub"
          : `Kirana on GitHub, ${stars} stars`
      }
      title="Kirana on GitHub"
      sx={styles.github}
      render={<a href={GITHUB} target="_blank" rel="noreferrer" />}
    >
      <BrandIcon icon={SVGL.github} size="1rem" />
      {stars ? <span sx={styles.stars}>{compact(stars)}</span> : null}
    </Button>
  )
}

export function SiteHeader() {
  return (
    <header sx={styles.header}>
      <Rail sx={styles.bar}>
        <Link
          to="/"
          aria-label="kirana style, home"
          {...styleProps(styles.brand)}
        >
          {/* The petal K in one colour (the gradients are not final), beside the name. */}
          <KiranaMark variant="solid" title={null} sx={styles.logo} />
          <Wordmark />
        </Link>
        <DesktopNav />
        <div sx={styles.actions}>
          <GitHubLink />
          <Button
            variant="ghost"
            size="icon"
            nativeButton={false}
            aria-label="Sponsor Kirana"
            title="Sponsor Kirana"
            sx={styles.sponsor}
            render={<DocsLink href={SPONSOR.href} />}
          >
            <Icon icon={FavouriteIcon} />
          </Button>
          <QuickStart size="sm" hideOnPhone />
          <MobileNav />
        </div>
      </Rail>
    </header>
  )
}
