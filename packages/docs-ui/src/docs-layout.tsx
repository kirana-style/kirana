/**
 * The docs frame: a top bar (logo, DOCS badge, section tabs, the app's
 * actions), a sticky sidebar for the active tab, and the page.
 *
 * Each tab has an accent. The whole frame takes the active tab's accent, so the
 * tab pill, the table-of-contents marker and anything else that reads
 * `accent.base` change colour together when you move between tabs.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { css, props as styleProps } from "@kirana-style/core"
import {
  ArrowDown01Icon,
  ArrowExpand01Icon,
  ArrowShrink01Icon,
  Menu01Icon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "@hugeicons/core-free-icons"
import { motion, useReducedMotion } from "motion/react"

import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { Icon } from "@workspace/ui/primitives/icon"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { accent, accents, tint } from "./accent.ts"
import { tabFor, useDocs } from "./provider.tsx"
import type { DocsTab } from "./provider.tsx"
import { DocsSearch } from "./search.tsx"
import { DocsSidebar } from "./sidebar.tsx"

const SIDEBAR = "17rem"
/** The collapsed sidebar: a column of the tabs' icons. */
const RAIL = "3.25rem"

/*
 * Layout choices — the page width, the collapsed sidebar — live in localStorage,
 * read as external stores: the server renders the default, the client switches
 * after hydration, and a change in one tab reaches the others through the
 * storage event.
 */
function preference(key: string) {
  const event = key
  return {
    read() {
      try {
        return localStorage.getItem(key) === "1"
      } catch {
        return false
      }
    },
    write(value: boolean) {
      try {
        localStorage.setItem(key, value ? "1" : "0")
      } catch {}
      window.dispatchEvent(new Event(event))
    },
    subscribe(onChange: () => void) {
      window.addEventListener("storage", onChange)
      window.addEventListener(event, onChange)
      return () => {
        window.removeEventListener("storage", onChange)
        window.removeEventListener(event, onChange)
      }
    },
  }
}
const widePreference = preference("docs-ui:wide")
const collapsedPreference = preference("docs-ui:sidebar-collapsed")

const BAR = "3.5rem"

const styles = {
  frame: css({ minHeight: "100dvh", backgroundColor: theme.background }),
  bar: css({
    position: "sticky",
    insetBlockStart: 0,
    zIndex: 30,
    display: "flex",
    alignItems: "center",
    height: BAR,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: theme.border,
    // Frosted, like the site's header: the page shows through, blurred. The blur is
    // on a `::before` layer so the bar does not become the containing block of the
    // fixed popups inside it.
    isolation: "isolate",
    "::before": {
      content: "''",
      position: "absolute",
      inset: 0,
      zIndex: -1,
      backgroundColor: `color-mix(in oklab, ${theme.background} 72%, transparent)`,
      backdropFilter: "blur(14px) saturate(1.5)",
    },
  }),
  brand: css({
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    gap: spacing[2],
    height: "100%",
    // Beside a collapsed sidebar the logo keeps its own width.
    width: {
      base: "auto",
      [breakpoint.lg]: { base: SIDEBAR, "[data-collapsed]": "auto" },
    },
    paddingInline: spacing[4],
    borderInlineEndWidth: {
      base: "0",
      [breakpoint.lg]: { base: "1px", "[data-collapsed]": "0" },
    },
    borderInlineEndStyle: "solid",
    borderInlineEndColor: theme.border,
  }),
  badge: css({
    borderRadius: radius.full,
    backgroundColor: alpha.muted50,
    paddingInline: spacing[2],
    paddingBlock: "1px",
    fontSize: "0.5625rem",
    lineHeight: "0.875rem",
    fontWeight: fontWeight.bold,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  // From lg up; below it the menu sheet lists the tabs, since at tablet width
  // five tabs and the actions do not fit on one bar.
  tabs: css({
    display: { base: "none", [breakpoint.lg]: "flex" },
    minWidth: 0,
    alignItems: "center",
    gap: spacing[1],
    paddingInline: spacing[4],
    overflowX: "auto",
    scrollbarWidth: "none",
  }),
  tab: css({
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["1.5"],
    height: spacing[7],
    borderRadius: radius.full,
    paddingInline: spacing["2.5"],
    whiteSpace: "nowrap",
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.semibold,
    textDecorationLine: "none",
    color: {
      base: theme.mutedForeground,
      ":hover": theme.foreground,
      "[data-active]": accent.base,
    },
    transitionProperty: "color",
    transitionDuration: duration[150],
  }),
  tabPill: css({
    position: "absolute",
    inset: 0,
    borderRadius: radius.full,
    backgroundColor: tint(12),
  }),
  tabContent: css({
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["1.5"],
  }),
  tabIcon: css({ opacity: { base: 0.6, ":is([data-active] *)": 1 } }),
  actions: css({
    marginInlineStart: "auto",
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    paddingInline: spacing[4],
  }),
  menuButton: css({
    display: { base: "inline-flex", [breakpoint.lg]: "none" },
  }),
  // Below lg the sidebar, and its search field, are in the sheet.
  mobileSearch: css({
    display: { base: "inline-grid", [breakpoint.lg]: "none" },
  }),
  // The page width only matters where there is width to give.
  widthButton: css({
    display: { base: "none", [breakpoint.xl]: "inline-flex" },
  }),

  collapseButton: css({
    display: { base: "none", [breakpoint.lg]: "inline-flex" },
    marginInlineStart: "auto",
    color: theme.mutedForeground,
  }),

  body: css({
    display: "grid",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: {
        base: `${SIDEBAR} minmax(0, 1fr)`,
        "[data-collapsed]": `${RAIL} minmax(0, 1fr)`,
      },
    },
  }),
  // The banner above the bar scrolls away; until it has, the sidebar is that
  // much shorter, so its footer stays on screen (`--docs-banner`, set below).
  sidebar: css({
    display: { base: "none", [breakpoint.lg]: "block" },
    position: "sticky",
    insetBlockStart: BAR,
    height: `calc(100dvh - ${BAR} - var(--docs-banner, 0px))`,
    borderInlineEndWidth: "1px",
    borderInlineEndStyle: "solid",
    borderInlineEndColor: theme.border,
  }),
  main: css({ minWidth: 0 }),
  // The edge handle (shadcn's SidebarRail): a strip straddling the border that
  // collapses or expands the sidebar, its line showing on hover.
  edge: css({
    position: "absolute",
    insetBlock: 0,
    insetInlineEnd: `calc(${spacing[2]} * -1)`,
    zIndex: 20,
    width: spacing[4],
    cursor: { base: "w-resize", "[data-collapsed]": "e-resize" },
    "::after": {
      content: "''",
      position: "absolute",
      insetBlock: 0,
      insetInlineStart: "50%",
      width: "2px",
      translate: "-50% 0",
      backgroundColor: { base: "transparent", ":hover": theme.border },
      transitionProperty: "background-color",
      transitionDuration: duration[150],
    },
  }),
  railNav: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: spacing[1],
    paddingBlock: spacing[3],
  }),
  railLink: css({
    display: "grid",
    placeItems: "center",
    width: spacing[9],
    height: spacing[9],
    borderRadius: radius.md,
    color: {
      base: theme.mutedForeground,
      ":hover": theme.foreground,
      "[data-active]": accent.base,
    },
    backgroundColor: {
      base: "transparent",
      ":hover": alpha.muted50,
      "[data-active]": tint(12),
    },
    transitionProperty: "color, background-color",
    transitionDuration: duration[150],
  }),
  // The sheet is a column: title, tabs, then the sidebar taking what is left,
  // so the sidebar's own scroller is bounded and scrolls.
  sheet: css({
    display: "flex",
    flexDirection: "column",
    padding: 0,
    overflow: "hidden",
  }),
  sheetSidebar: css({ flex: 1, minHeight: 0 }),
  sheetTitle: css({ paddingInline: spacing[4], paddingBlockStart: spacing[4] }),
  // One row: the current section, which opens the others in place, so the
  // sheet keeps its room for the pages.
  // The current section as one row; the others open as a menu over the page
  // list rather than pushing it down.
  switcher: css({
    position: "relative",
    zIndex: 10,
    marginInline: spacing[3],
    marginBlockStart: spacing[3],
  }),
  switchCurrentBox: css({
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
  }),
  switchMenu: css({
    position: "absolute",
    insetInline: 0,
    insetBlockStart: `calc(100% + ${spacing[1]})`,
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.popover,
    boxShadow: `0 12px 32px -12px ${alpha.foreground10}`,
  }),
  switchRow: css({
    display: "flex",
    alignItems: "center",
    gap: spacing["2.5"],
    width: "100%",
    minHeight: spacing[11],
    paddingInline: spacing["2.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    textAlign: "start",
    textDecorationLine: "none",
    color: theme.foreground,
    backgroundColor: { base: "transparent", ":hover": alpha.muted50 },
    cursor: "pointer",
  }),
  switchCurrent: css({
    backgroundColor: { base: tint(8), ":hover": tint(12) },
  }),
  switchOther: css({
    borderBlockStartWidth: { base: "1px", ":first-child": "0" },
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),
  switchIcon: css({
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    width: spacing[7],
    height: spacing[7],
    borderRadius: radius.md,
    backgroundColor: tint(14),
    color: accent.base,
  }),
  switchText: css({ display: "grid", flex: 1, minWidth: 0 }),
  switchHint: css({
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.normal,
    color: theme.mutedForeground,
  }),
  switchChevron: css({
    color: theme.mutedForeground,
    transitionProperty: "rotate",
    transitionDuration: duration[200],
    rotate: { base: "0deg", ':is([aria-expanded="true"] *)': "180deg" },
  }),
}

/**
 * The sheet's section control: the current tab as one row; pressed, the other
 * tabs unfold under it as rows of their own.
 */
function SectionSwitcher({
  active,
  onNavigate,
}: {
  active: DocsTab | undefined
  onNavigate: () => void
}) {
  const { tabs, Link } = useDocs()
  const [open, setOpen] = useState(false)
  const others = tabs.filter((tab) => tab.id !== active?.id)
  const box = useRef<HTMLElement>(null)
  // A menu closes on Escape and on a press anywhere else.
  useEffect(() => {
    if (!open) return
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !box.current?.contains(event.target as Node)
      )
        setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", close)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", close)
    }
  }, [open])
  const glyph = (tab: DocsTab) =>
    tab.icon ? (
      <span sx={styles.switchIcon}>
        <Icon icon={tab.icon as IconProps["icon"]} size="0.875rem" />
      </span>
    ) : null

  return (
    <nav ref={box} sx={styles.switcher} aria-label="Documentation sections">
      <div sx={styles.switchCurrentBox}>
        <button
          type="button"
          aria-expanded={open}
          sx={[styles.switchRow, styles.switchCurrent]}
          onClick={() => setOpen((current) => !current)}
        >
          {active ? glyph(active) : null}
          <span sx={styles.switchText}>
            {active?.label ?? "Sections"}
            <span sx={styles.switchHint}>
              {open ? "Choose a section" : "Switch section"}
            </span>
          </span>
          <Icon icon={ArrowDown01Icon} size="1rem" sx={styles.switchChevron} />
        </button>
      </div>
      {open ? (
        <div sx={styles.switchMenu}>
          {others.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              sx={[accents[tab.accent], styles.switchRow, styles.switchOther]}
              onClick={() => {
                setOpen(false)
                onNavigate()
              }}
            >
              {glyph(tab)}
              <span sx={styles.switchText}>{tab.label}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  )
}

export function DocsLayout({
  current,
  logo,
  actions,
  banner,
  children,
}: {
  /** The current page's href. */
  current: string
  logo: React.ReactNode
  actions?: React.ReactNode
  /** A strip above the bar, e.g. a pre-release notice; it scrolls away. */
  banner?: React.ReactNode
  children: React.ReactNode
}) {
  const { tabs, pages, Link } = useDocs()
  const reduce = useReducedMotion()
  const [menuOpen, setMenuOpen] = useState(false)
  const wide = useSyncExternalStore(
    widePreference.subscribe,
    widePreference.read,
    () => false
  )
  const toggleWide = () => widePreference.write(!wide)
  const collapsed = useSyncExternalStore(
    collapsedPreference.subscribe,
    collapsedPreference.read,
    () => false
  )
  const toggleCollapsed = () => collapsedPreference.write(!collapsed)
  const frame = useRef<HTMLDivElement>(null)
  const bannerBox = useRef<HTMLDivElement>(null)

  // How much of the banner is still on screen, for the sidebar's height.
  useEffect(() => {
    const strip = bannerBox.current
    if (!strip) return
    const update = () =>
      frame.current?.style.setProperty(
        "--docs-banner",
        `${Math.max(0, strip.offsetHeight - window.scrollY)}px`
      )
    update()
    const observer = new ResizeObserver(update)
    observer.observe(strip)
    window.addEventListener("scroll", update, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", update)
    }
  }, [])

  // Ctrl/Cmd+B collapses the sidebar, as in shadcn's Sidebar; not while typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (
        event.key.toLowerCase() !== "b" ||
        !(event.metaKey || event.ctrlKey) ||
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      )
        return
      event.preventDefault()
      collapsedPreference.write(!collapsedPreference.read())
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  const section = pages.find((page) => page.href === current)?.section
  const active = tabFor(tabs, section)

  return (
    <div
      ref={frame}
      sx={[styles.frame, accents[active?.accent ?? "neutral"]]}
      data-wide={wide ? "" : undefined}
    >
      {banner ? <div ref={bannerBox}>{banner}</div> : null}
      <header sx={styles.bar}>
        <div sx={styles.brand} data-collapsed={collapsed ? "" : undefined}>
          {logo}
          <span sx={styles.badge}>Docs</span>
          <Button
            variant="ghost"
            size="icon-sm"
            sx={styles.collapseButton}
            aria-pressed={collapsed}
            aria-label={
              collapsed ? "Expand the sidebar" : "Collapse the sidebar"
            }
            title={`${collapsed ? "Expand" : "Collapse"} the sidebar (Ctrl+B)`}
            onClick={toggleCollapsed}
          >
            <Icon icon={collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon} />
          </Button>
        </div>
        <nav sx={styles.tabs} aria-label="Documentation sections">
          {tabs.map((tab) => {
            const isActive = tab.id === active?.id
            return (
              <Link
                key={tab.id}
                href={tab.href}
                data-active={isActive ? "" : undefined}
                sx={[accents[tab.accent], styles.tab]}
              >
                {isActive ? (
                  <motion.span
                    layoutId="docs-ui-tab-pill"
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { type: "spring", bounce: 0, duration: 0.3 }
                    }
                    {...styleProps(styles.tabPill)}
                  />
                ) : null}
                <span sx={styles.tabContent}>
                  {tab.icon ? (
                    <Icon
                      icon={tab.icon as IconProps["icon"]}
                      size="0.875rem"
                      sx={styles.tabIcon}
                    />
                  ) : null}
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </nav>
        <div sx={styles.actions}>
          <Button
            variant="ghost"
            size="icon"
            sx={styles.widthButton}
            aria-pressed={wide}
            aria-label={wide ? "Narrow the page" : "Widen the page"}
            title={wide ? "Narrow the page" : "Widen the page"}
            onClick={toggleWide}
          >
            <Icon icon={wide ? ArrowShrink01Icon : ArrowExpand01Icon} />
          </Button>
          {actions}
          <DocsSearch variant="icon" hotkey={false} sx={styles.mobileSearch} />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open the documentation menu"
                  sx={styles.menuButton}
                />
              }
            >
              <Icon icon={Menu01Icon} />
            </SheetTrigger>
            <SheetContent
              side="left"
              // The sheet is portalled out of the frame, so it takes the
              // section's accent itself.
              sx={[accents[active?.accent ?? "neutral"], styles.sheet]}
            >
              <SheetTitle sx={styles.sheetTitle}>Documentation</SheetTitle>
              <SectionSwitcher
                active={active}
                onNavigate={() => setMenuOpen(false)}
              />
              <div
                sx={styles.sheetSidebar}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("a"))
                    setMenuOpen(false)
                }}
              >
                <DocsSidebar
                  current={current}
                  section={section}
                  search="filter"
                  onNavigate={() => setMenuOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <div sx={styles.body} data-collapsed={collapsed ? "" : undefined}>
        <aside sx={styles.sidebar}>
          {collapsed ? (
            <nav sx={styles.railNav} aria-label="Documentation sections">
              {tabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-label={tab.label}
                  title={tab.label}
                  data-active={tab.id === active?.id ? "" : undefined}
                  sx={[accents[tab.accent], styles.railLink]}
                >
                  {tab.icon ? (
                    <Icon
                      icon={tab.icon as IconProps["icon"]}
                      size="1.125rem"
                    />
                  ) : (
                    tab.label.slice(0, 1)
                  )}
                </Link>
              ))}
            </nav>
          ) : (
            <DocsSidebar current={current} section={section} />
          )}
          <button
            type="button"
            tabIndex={-1}
            sx={styles.edge}
            data-collapsed={collapsed ? "" : undefined}
            aria-label={
              collapsed ? "Expand the sidebar" : "Collapse the sidebar"
            }
            title={`${collapsed ? "Expand" : "Collapse"} the sidebar`}
            onClick={toggleCollapsed}
          />
        </aside>
        <main sx={styles.main}>{children}</main>
      </div>
    </div>
  )
}
