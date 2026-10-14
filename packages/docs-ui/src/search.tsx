/**
 * ⌘K search over the generated index: one record per heading, so a hit lands on
 * the section that answers the query. Results are grouped by section; each row
 * leads with the page's logo, its reference kind, or a page or heading glyph.
 *
 * The input is a plain one inside cmdk's root, which is what handles the arrow
 * keys and Enter; filtering is ours (`search` from the docs config).
 */
import { useEffect, useRef, useState } from "react"
import { css } from "@kirana-style/core"
import {
  File02Icon,
  GridIcon,
  Search01Icon,
  TextAlignLeftIcon,
} from "@hugeicons/core-free-icons"

import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd"
import type { Sx } from "@workspace/ui/lib/sx"
import { Icon } from "@workspace/ui/primitives/icon"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { accents, tint } from "./accent.ts"
import type { AccentName } from "./accent.ts"
import { useDocs } from "./provider.tsx"

/** The same kind colours as the sidebar's badges. */
const KIND_ACCENTS: Record<string, AccentName> = {
  api: "neutral",
  config: "neutral",
  cli: "neutral",
  diagnostics: "neutral",
}
const KIND_LABELS: Record<string, string> = {
  api: "API",
  config: "CFG",
  cli: "CLI",
  diagnostics: "DIAG",
}

const styles = {
  trigger: css({
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: spacing[2],
    height: spacing[8],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: { base: theme.background, ":hover": alpha.muted50 },
    paddingInline: spacing["2.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
    cursor: "pointer",
    transitionProperty: "background-color",
    transitionDuration: duration[150],
  }),
  triggerText: css({ marginInlineEnd: "auto" }),
  // The bar's compact trigger, for screens where the sidebar is in a sheet.
  iconTrigger: css({
    display: "inline-grid",
    placeItems: "center",
    width: spacing[8],
    height: spacing[8],
    borderRadius: radius.lg,
    backgroundColor: { base: "transparent", ":hover": alpha.muted50 },
    color: theme.mutedForeground,
    cursor: "pointer",
  }),

  // Wide and high on the screen, like a palette rather than a modal form. The
  // kit's dialog caps the width at `sm`; this sets it under the same condition.
  dialog: css({
    top: { base: "8vh", [breakpoint.sm]: "12vh" },
    translate: "-50% 0",
    maxWidth: { base: "calc(100% - 2rem)", [breakpoint.sm]: "44rem" },
    gap: 0,
    borderRadius: "1rem",
    boxShadow: "0 24px 60px -24px rgb(0 0 0 / 0.45)",
  }),
  command: css({ display: "grid" }),
  head: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[3],
    paddingInline: spacing[4],
    height: spacing[14],
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
    color: theme.mutedForeground,
  }),
  input: css({
    flex: 1,
    minWidth: 0,
    height: "100%",
    backgroundColor: "transparent",
    fontSize: fontSize.base,
    color: theme.foreground,
    outlineStyle: "none",
    "::placeholder": { color: theme.mutedForeground },
  }),
  list: css({
    maxHeight: "min(60vh, 28rem)",
    padding: spacing[2],
  }),
  group: css({ padding: 0 }),
  groupLabel: css({
    fontSize: "0.6875rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  }),

  empty: css({
    display: "grid",
    justifyItems: "center",
    gap: spacing[2],
    paddingBlock: spacing[12],
    paddingInline: spacing[6],
    textAlign: "center",
  }),
  emptyIcon: css({
    display: "grid",
    placeItems: "center",
    width: spacing[12],
    height: spacing[12],
    marginBlockEnd: spacing[2],
    borderRadius: radius.full,
    backgroundColor: theme.muted,
    color: theme.mutedForeground,
  }),
  emptyTitle: css({
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
  }),
  emptyText: css({
    maxWidth: "24rem",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
  }),

  item: css({
    gap: spacing[3],
    paddingInline: spacing["2.5"],
    paddingBlock: spacing[2],
  }),
  lead: css({
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    width: spacing[9],
    height: spacing[9],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.background,
    color: theme.mutedForeground,
  }),
  kind: css({
    borderRadius: radius.sm,
    paddingInline: "4px",
    fontFamily: fontFamily.mono,
    fontSize: "0.5625rem",
    fontWeight: fontWeight.semibold,
    lineHeight: "0.875rem",
    color: tint(100),
    backgroundColor: tint(12),
  }),
  text: css({ display: "grid", gap: "0.125rem", minWidth: 0 }),
  title: css({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    color: theme.foreground,
  }),
  crumb: css({ color: theme.mutedForeground, fontWeight: fontWeight.normal }),
  snippet: css({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),

  foot: css({
    display: "flex",
    alignItems: "center",
    gap: { base: spacing[4], [breakpoint.sm]: spacing[5] },
    paddingInline: spacing[4],
    paddingBlock: spacing["2.5"],
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
    backgroundColor: alpha.muted50,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),
  footItem: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["1.5"],
    whiteSpace: "nowrap",
  }),
  hideSmall: css({ display: { base: "none", [breakpoint.sm]: "inline-flex" } }),
}

export function DocsSearch({
  variant = "field",
  hotkey = true,
  sx,
}: {
  /** A search field (the sidebar's), or an icon button (a bar's). */
  variant?: "field" | "icon"
  /** Whether this instance answers ⌘K; give it to one instance per page. */
  hotkey?: boolean
  sx?: Sx
}) {
  const { search, navigate, nav, pages, pageIcon } = useDocs()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!hotkey) return
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [hotkey])

  const labels = new Map(nav.map((group) => [group.slug, group.label]))
  const kinds = new Map(pages.map((page) => [page.href, page.kind]))
  const groups = new Map<string, ReturnType<typeof search>[number][]>()
  for (const hit of search(query)) {
    const label = labels.get(hit.record.section) ?? hit.record.section
    groups.set(label, [...(groups.get(label) ?? []), hit])
  }

  /** What leads a row: a logo, a kind badge, or a glyph for a page or heading. */
  const lead = (href: string, heading: boolean) => {
    const page = href.split("#")[0]!
    const logo = pageIcon?.(page)
    if (logo) return logo
    const kind = kinds.get(page)
    if (kind)
      return (
        <span sx={[accents[KIND_ACCENTS[kind] ?? "neutral"], styles.kind]}>
          {KIND_LABELS[kind] ?? kind}
        </span>
      )
    return (
      <Icon icon={heading ? TextAlignLeftIcon : File02Icon} size="0.9375rem" />
    )
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          sx={[styles.iconTrigger, sx]}
          aria-label="Search documentation"
          onClick={() => setOpen(true)}
        >
          <Icon icon={Search01Icon} size="1rem" />
        </button>
      ) : (
        <button
          type="button"
          sx={[styles.trigger, sx]}
          onClick={() => setOpen(true)}
        >
          <Icon icon={Search01Icon} size="0.875rem" />
          <span sx={styles.triggerText}>Search…</span>
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </button>
      )}
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery("")
        }}
        title="Search the documentation"
        description="Find a page or a section by what it says."
        sx={styles.dialog}
      >
        <Command shouldFilter={false} sx={styles.command}>
          <label sx={styles.head}>
            <Icon icon={Search01Icon} size="1.125rem" />
            <input
              ref={input}
              autoFocus
              sx={styles.input}
              placeholder="Search documentation…"
              aria-label="Search documentation"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Kbd>Esc</Kbd>
          </label>
          <CommandList sx={styles.list}>
            {!query ? (
              <div sx={styles.empty}>
                <span sx={styles.emptyIcon}>
                  <Icon icon={Search01Icon} size="1.25rem" />
                </span>
                <span sx={styles.emptyTitle}>Search the documentation</span>
                <span sx={styles.emptyText}>
                  Guides, framework setups, the API reference and every
                  diagnostic, by what they say.
                </span>
              </div>
            ) : groups.size === 0 ? (
              <div sx={styles.empty}>
                <span sx={styles.emptyIcon}>
                  <Icon icon={GridIcon} size="1.25rem" />
                </span>
                <span sx={styles.emptyTitle}>No results for “{query}”</span>
                <span sx={styles.emptyText}>
                  Try a property, a diagnostic name, or a framework.
                </span>
              </div>
            ) : (
              [...groups].map(([label, hits]) => (
                <CommandGroup
                  key={label}
                  heading={<span sx={styles.groupLabel}>{label}</span>}
                  sx={styles.group}
                >
                  {hits.map((hit) => (
                    <CommandItem
                      key={hit.record.id}
                      value={hit.record.id}
                      sx={styles.item}
                      onSelect={() => {
                        setOpen(false)
                        setQuery("")
                        navigate(hit.record.href)
                      }}
                    >
                      <span sx={styles.lead}>
                        {lead(hit.record.href, Boolean(hit.record.heading))}
                      </span>
                      <span sx={styles.text}>
                        <span sx={styles.title}>
                          {hit.record.page}
                          {hit.record.heading &&
                          hit.record.heading !== hit.record.page ? (
                            <span sx={styles.crumb}>
                              {" › "}
                              {hit.record.heading}
                            </span>
                          ) : null}
                        </span>
                        <span sx={styles.snippet}>{hit.snippet}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            )}
          </CommandList>
          <div sx={styles.foot}>
            <span sx={styles.footItem}>
              <KbdGroup>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
              </KbdGroup>
              to navigate
            </span>
            <span sx={styles.footItem}>
              <Kbd>↵</Kbd>
              to open
            </span>
            <span sx={[styles.footItem, styles.hideSmall]}>
              <Kbd>Esc</Kbd>
              to close
            </span>
          </div>
        </Command>
      </CommandDialog>
    </>
  )
}
