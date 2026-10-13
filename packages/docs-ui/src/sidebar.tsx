/**
 * The docs sidebar for the active tab: its sections as uppercase groups, pages
 * as rows, sub-groups as collapsible branches, reference pages with a kind
 * badge.
 *
 * One highlight slides to the hovered row and settles on the current page when
 * the pointer leaves — measured from the DOM, moved with a spring, jumping
 * under reduced motion. The scroll position survives reloads for the session.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { css, props as styleProps } from "@kirana-style/core"
import {
  ArrowRight01Icon,
  Cancel01Icon,
  FilterIcon,
} from "@hugeicons/core-free-icons"
import { motion, useReducedMotion } from "motion/react"

import type { NavBranch, NavItem } from "@workspace/docs-core/types.ts"
import { isBranch } from "@workspace/docs-core/types.ts"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import type { Sx } from "@workspace/ui/lib/sx"
import { Icon } from "@workspace/ui/primitives/icon"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { accents, tint } from "./accent.ts"
import type { AccentName } from "./accent.ts"
import { tabFor, useDocs } from "./provider.tsx"
import { DocsSearch } from "./search.tsx"

/** The tint of each reference kind's badge. */
const KIND_ACCENTS: Record<string, AccentName> = {
  api: "violet",
  config: "amber",
  cli: "emerald",
  diagnostics: "pink",
}

const SCROLL_KEY = "docs-ui:sidebar-scroll"

const styles = {
  // A column: the search or filter, the list taking what is left (and
  // scrolling), then the footer if the config gives one.
  root: css({
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    height: "100%",
  }),
  searchWrap: css({ padding: spacing[3], paddingBlockEnd: spacing[2] }),
  footer: css({
    padding: spacing[3],
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),

  // The filter field: a plain input that narrows the list below it.
  filter: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    height: spacing[9],
    paddingInline: spacing["2.5"],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: { base: theme.border, ":focus-within": tint(55) },
    boxShadow: { base: "none", ":focus-within": `0 0 0 3px ${tint(14)}` },
    backgroundColor: theme.background,
    color: theme.mutedForeground,
    transitionProperty: "border-color, box-shadow",
    transitionDuration: duration[150],
  }),
  filterInput: css({
    flex: 1,
    minWidth: 0,
    height: "100%",
    backgroundColor: "transparent",
    fontSize: fontSize.sm,
    color: theme.foreground,
    outlineStyle: "none",
    "::placeholder": { color: theme.mutedForeground },
  }),
  filterClear: css({
    display: "grid",
    placeItems: "center",
    width: spacing[6],
    height: spacing[6],
    borderRadius: radius.md,
    color: theme.mutedForeground,
    backgroundColor: { base: "transparent", ":hover": alpha.muted50 },
    cursor: "pointer",
  }),
  count: css({
    paddingInline: spacing["2.5"],
    paddingBlockStart: spacing[3],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),
  trail: css({
    display: "block",
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.normal,
    color: theme.mutedForeground,
  }),
  mark: css({
    borderRadius: "3px",
    backgroundColor: tint(18),
    color: "inherit",
  }),
  empty: css({
    display: "grid",
    gap: spacing[1],
    paddingInline: spacing["2.5"],
    paddingBlock: spacing[8],
    textAlign: "center",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
  }),
  emptyTitle: css({ fontWeight: fontWeight.medium, color: theme.foreground }),
  scroller: css({
    flex: 1,
    minHeight: 0,
    position: "relative",
    overflowY: "auto",
    overscrollBehavior: "contain",
    paddingInline: spacing[3],
    paddingBlockEnd: spacing[10],
    scrollbarWidth: "thin",
  }),
  list: css({ position: "relative" }),
  highlight: css({
    position: "absolute",
    insetInline: 0,
    borderRadius: radius.lg,
    backgroundColor: alpha.muted50,
    pointerEvents: "none",
  }),
  group: css({ display: "grid", paddingBlockStart: spacing[4] }),
  groupLabel: css({
    paddingInline: spacing["2.5"],
    paddingBlockEnd: spacing["1.5"],
    fontSize: "0.625rem",
    lineHeight: "1rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  row: css({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    minHeight: spacing[8],
    width: "100%",
    borderRadius: radius.lg,
    paddingInline: spacing["2.5"],
    // Only a two-line row (a filter result) is tall enough to feel this.
    paddingBlock: spacing["1.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    textAlign: "start",
    textDecorationLine: "none",
    color: {
      base: theme.mutedForeground,
      ":hover": theme.foreground,
      '[aria-current="page"]': theme.foreground,
    },
    transitionProperty: "color",
    transitionDuration: duration[150],
  }),
  rowLabel: css({ flex: 1, minWidth: 0 }),
  badge: css({
    flexShrink: 0,
    borderRadius: radius.sm,
    paddingInline: "0.3rem",
    paddingBlock: "1px",
    fontSize: "0.5625rem",
    lineHeight: "0.875rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: tint(100),
    backgroundColor: tint(14),
  }),
  chevron: css({
    transitionProperty: "rotate",
    transitionDuration: duration[200],
    rotate: { base: "0deg", ":is([data-panel-open] *)": "90deg" },
  }),
  branch: css({
    marginInlineStart: spacing[4],
    paddingInlineStart: spacing[2],
    borderInlineStartWidth: "1px",
    borderInlineStartStyle: "solid",
    borderInlineStartColor: theme.border,
  }),
}

function Row({
  item,
  current,
  label,
  trail,
}: {
  item: NavItem
  current: string
  /** The title as shown, when it is highlighted. */
  label?: React.ReactNode
  /** Where the page sits, shown under it in filter results. */
  trail?: string
}) {
  const { Link, pageIcon } = useDocs()
  const active = item.href === current
  const kind = item.kind ? (KIND_ACCENTS[item.kind] ?? "neutral") : undefined
  return (
    <Link
      href={item.href}
      data-row={item.href}
      aria-current={active ? "page" : undefined}
      sx={styles.row}
    >
      {pageIcon?.(item.href)}
      <span sx={styles.rowLabel}>
        {label ?? item.title}
        {trail ? <span sx={styles.trail}>{trail}</span> : null}
      </span>
      {kind ? (
        <span sx={[accents[kind], styles.badge]}>{item.kind}</span>
      ) : null}
    </Link>
  )
}

function Branch({
  branch,
  current,
  onToggle,
}: {
  branch: NavBranch
  current: string
  onToggle: () => void
}) {
  const containsCurrent = branch.items.some((item) => item.href === current)
  const [open, setOpen] = useState(containsCurrent)
  // Navigating into the branch opens it.
  const [held, setHeld] = useState(containsCurrent)
  if (held !== containsCurrent) {
    setHeld(containsCurrent)
    if (containsCurrent) setOpen(true)
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        onToggle()
      }}
    >
      <CollapsibleTrigger
        data-row={`branch:${branch.label}`}
        {...styleProps(styles.row)}
      >
        <span sx={styles.rowLabel}>{branch.label}</span>
        <Icon icon={ArrowRight01Icon} size="0.875rem" sx={styles.chevron} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div sx={styles.branch}>
          {branch.items.map((item) => (
            <Row key={item.href} item={item} current={current} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Every page in the nav, with the group and branch it sits in. */
function flatten(nav: ReturnType<typeof useDocs>["nav"]) {
  return nav.flatMap((group) =>
    group.items.flatMap((node) =>
      isBranch(node)
        ? node.items.map((item) => ({
            item,
            group: group.label,
            trail: `${group.label} › ${node.label}`,
          }))
        : [{ item: node, group: group.label, trail: group.label }]
    )
  )
}

/** The words of a query, lowercased, each at most once. */
function words(query: string) {
  return [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))]
}

/** A title with every occurrence of the query's words marked. */
function highlight(title: string, terms: readonly string[]) {
  if (terms.length === 0) return title
  const escaped = terms.map((term) =>
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  )
  const parts = title.split(new RegExp(`(${escaped.join("|")})`, "gi"))
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} sx={styles.mark}>
        {part}
      </mark>
    ) : (
      part
    )
  )
}

export function DocsSidebar({
  current,
  section,
  search = true,
  onNavigate,
  sx,
}: {
  /** The current page's href. */
  current: string
  /** The current page's section, which picks the tab. */
  section: string | undefined
  /**
   * What leads the sidebar: the full-text search field (`true`), a field that
   * filters the pages by title across every tab (`"filter"`), or nothing.
   */
  search?: boolean | "filter"
  /** Called when the sidebar navigates by keyboard (Enter in the filter). */
  onNavigate?: () => void
  sx?: Sx
}) {
  const { nav, tabs, navigate, sidebarFooter } = useDocs()
  const [query, setQuery] = useState("")
  const terms = words(query)
  const results =
    terms.length === 0
      ? []
      : flatten(nav).filter(({ item, trail }) => {
          const text = `${item.title} ${trail}`.toLowerCase()
          return terms.every((term) => text.includes(term))
        })
  const reduce = useReducedMotion()
  const tab = tabFor(tabs, section)
  const groups = (tab?.sections ?? [])
    .map((slug) => nav.find((group) => group.slug === slug))
    .filter((group) => group !== undefined)

  const scroller = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [box, setBox] = useState<{ top: number; height: number } | null>(null)

  const measure = useCallback(() => {
    const root = list.current
    const key = hover ?? current
    const row = root?.querySelector<HTMLElement>(
      `[data-row="${CSS.escape(key)}"]`
    )
    if (!root || !row || row.offsetParent === null) return setBox(null)
    const outer = root.getBoundingClientRect()
    const inner = row.getBoundingClientRect()
    setBox({ top: inner.top - outer.top, height: inner.height })
  }, [hover, current])

  useLayoutEffect(() => measure(), [measure])

  // Branches opening and closing move the rows below them.
  useEffect(() => {
    const root = list.current
    if (!root) return
    const observer = new ResizeObserver(() => measure())
    observer.observe(root)
    return () => observer.disconnect()
  }, [measure])

  useEffect(() => {
    const element = scroller.current
    if (!element) return
    try {
      element.scrollTop = Number(sessionStorage.getItem(SCROLL_KEY) ?? 0)
    } catch {}
    const save = () => {
      try {
        sessionStorage.setItem(SCROLL_KEY, String(element.scrollTop))
      } catch {}
    }
    element.addEventListener("scroll", save, { passive: true })
    return () => element.removeEventListener("scroll", save)
  }, [])

  return (
    <div sx={[styles.root, sx]}>
      {search === "filter" ? (
        <div sx={styles.searchWrap}>
          <label sx={styles.filter}>
            <Icon icon={FilterIcon} size="0.875rem" />
            <input
              type="text"
              inputMode="search"
              enterKeyHint="go"
              autoComplete="off"
              sx={styles.filterInput}
              placeholder="Filter pages…"
              aria-label="Filter pages"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && query) {
                  event.stopPropagation()
                  setQuery("")
                }
                if (event.key === "Enter" && results[0]) {
                  navigate(results[0].item.href)
                  setQuery("")
                  onNavigate?.()
                }
              }}
            />
            {query ? (
              <button
                type="button"
                sx={styles.filterClear}
                aria-label="Clear the filter"
                onClick={() => setQuery("")}
              >
                <Icon icon={Cancel01Icon} size="0.75rem" />
              </button>
            ) : null}
          </label>
        </div>
      ) : search ? (
        <div sx={styles.searchWrap}>
          <DocsSearch />
        </div>
      ) : null}
      <div ref={scroller} sx={styles.scroller}>
        <nav
          ref={list}
          aria-label="Documentation"
          sx={styles.list}
          onPointerOver={(event) => {
            const row = (event.target as HTMLElement).closest<HTMLElement>(
              "[data-row]"
            )
            if (row) setHover(row.dataset.row ?? null)
          }}
          onPointerLeave={() => setHover(null)}
        >
          <motion.div
            aria-hidden="true"
            initial={false}
            animate={
              box
                ? { top: box.top, height: box.height, opacity: 1 }
                : { opacity: 0 }
            }
            transition={
              reduce
                ? { duration: 0 }
                : { type: "spring", bounce: 0, duration: 0.25 }
            }
            {...styleProps(styles.highlight)}
          />
          {terms.length > 0 ? (
            results.length > 0 ? (
              <>
                <p sx={styles.count} aria-live="polite">
                  {results.length === 1 ? "1 page" : `${results.length} pages`}{" "}
                  in every section
                </p>
                {results.map(({ item, trail }) => (
                  <Row
                    key={item.href}
                    item={item}
                    current={current}
                    label={highlight(item.title, terms)}
                    trail={trail}
                  />
                ))}
              </>
            ) : (
              <p sx={styles.empty} aria-live="polite">
                <span sx={styles.emptyTitle}>No page titles match</span>
                Try fewer words, or the search in the bar for the text of every
                page.
              </p>
            )
          ) : (
            groups.map((group) => (
              <div key={group.slug} sx={styles.group}>
                <span sx={styles.groupLabel}>{group.label}</span>
                {group.items.map((node) =>
                  isBranch(node) ? (
                    <Branch
                      key={node.label}
                      branch={node}
                      current={current}
                      onToggle={measure}
                    />
                  ) : (
                    <Row key={node.href} item={node} current={current} />
                  )
                )}
              </div>
            ))
          )}
        </nav>
      </div>
      {sidebarFooter ? <div sx={styles.footer}>{sidebarFooter}</div> : null}
    </div>
  )
}
