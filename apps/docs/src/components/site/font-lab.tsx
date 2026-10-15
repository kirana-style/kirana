/**
 * The font lab: a floating panel for trying other typefaces on the live site, without a rebuild.
 *
 * Every font role in `@workspace/ui/tokens/typography` reads a named custom property
 * (`--font-heading`, …) and falls back to its typeface. The lab sets those properties on the root
 * element and loads the chosen family from Google Fonts. It is a development tool: the root route
 * loads it only under `import.meta.env.DEV`, so production builds do not contain it at all. Picks
 * are remembered in this browser only.
 *
 * Once a set is chosen, "Copy choices" puts it on the clipboard, and the faces are installed from
 * `@fontsource-variable` and written into `typeface` for real: the lab never ships a choice.
 */
import { useEffect, useState, useSyncExternalStore } from "react"
import { css } from "@kirana-style/core"

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import { Icon } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { shadow } from "@workspace/ui/tokens/shadows"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontSize, fontWeight, typeface } from "@workspace/ui/tokens/typography"
import { zIndex } from "@workspace/ui/tokens/z-index"

type Kind = "sans" | "serif" | "mono"

/** A curated list of Google Fonts, by kind. */
const FAMILIES: Record<Kind, readonly string[]> = {
  sans: [
    "Inter",
    "Plus Jakarta Sans",
    "Geist",
    "Manrope",
    "Instrument Sans",
    "Bricolage Grotesque",
    "Space Grotesk",
    "DM Sans",
    "Outfit",
    "Figtree",
    "Onest",
    "Hanken Grotesk",
    "Schibsted Grotesk",
    "IBM Plex Sans",
    "Work Sans",
    "Sora",
  ],
  serif: [
    "Cormorant Garamond",
    "Instrument Serif",
    "Fraunces",
    "Playfair Display",
    "Newsreader",
    "EB Garamond",
    "Lora",
    "DM Serif Display",
    "Libre Baskerville",
    "Source Serif 4",
    "Crimson Pro",
  ],
  mono: [
    "JetBrains Mono",
    "Geist Mono",
    "IBM Plex Mono",
    "Fira Code",
    "Space Mono",
    "Roboto Mono",
    "Source Code Pro",
    "DM Mono",
    "Martian Mono",
    "Red Hat Mono",
  ],
}

const FALLBACK: Record<Kind, string> = {
  sans: "system-ui, sans-serif",
  serif: "Georgia, serif",
  mono: "ui-monospace, monospace",
}

type Role = "sans" | "heading" | "serif" | "mono" | "numeric"

/** Each role, what it sets and what the site uses today. */
const ROLES: readonly { role: Role; label: string; current: string }[] = [
  { role: "heading", label: "Headings", current: "Newsreader" },
  { role: "sans", label: "Body text", current: "Plus Jakarta Sans" },
  { role: "serif", label: "Serif accents, wordmark", current: "Newsreader" },
  { role: "mono", label: "Code", current: "JetBrains Mono" },
  { role: "numeric", label: "Numbers", current: "JetBrains Mono" },
]

type Choices = Partial<Record<Role, string>>

const STORE = "kirana:font-lab"

function read(): Choices {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}") as Choices
  } catch {
    return {}
  }
}

function write(choices: Choices) {
  try {
    localStorage.setItem(STORE, JSON.stringify(choices))
  } catch {}
}

const kindOf = (family: string): Kind =>
  (Object.keys(FAMILIES) as Kind[]).find((kind) =>
    FAMILIES[kind].includes(family)
  ) ?? "sans"

/**
 * Loads a family from Google Fonts. Families differ in axes (italic, weight range, static
 * weights), and a request naming one a family lacks fails, so the specs go from richest to
 * plainest and the first one Google answers is used.
 */
const loaded = new Set<string>()
async function load(family: string) {
  if (loaded.has(family)) return
  const name = family.replaceAll(" ", "+")
  const specs = [
    ":ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700",
    ":wght@300;400;500;600;700",
    ":ital,wght@0,400;0,700;1,400;1,700",
    ":wght@400;700",
    ":ital@0;1",
    "",
  ]
  for (const spec of specs) {
    const response = await fetch(
      `https://fonts.googleapis.com/css2?family=${name}${spec}&display=swap`
    )
    if (!response.ok) continue
    const style = document.createElement("style")
    style.dataset.fontLab = family
    style.textContent = await response.text()
    document.head.append(style)
    loaded.add(family)
    return
  }
}

/** A family as a font stack, with its kind's system fallback. */
const stack = (family: string) => `"${family}", ${FALLBACK[kindOf(family)]}`

function apply(choices: Choices) {
  const root = document.documentElement
  for (const { role } of ROLES) {
    const family = choices[role]
    if (family) {
      root.style.setProperty(`--font-${role}`, stack(family))
      void load(family)
    } else root.style.removeProperty(`--font-${role}`)
  }
}

/** Every family once, in list order: what ← and → step through. */
const ALL = (Object.keys(FAMILIES) as Kind[]).flatMap((kind) => FAMILIES[kind])

const KIND_LABEL: Record<Kind, string> = {
  sans: "Sans",
  serif: "Serif",
  mono: "Mono",
}

/** The list's groups, as the combobox takes them. */
const GROUPS = (Object.keys(FAMILIES) as Kind[]).map((kind) => ({
  value: kind,
  items: [...FAMILIES[kind]],
}))

const styles = {
  toggle: css({
    position: "fixed",
    insetInlineEnd: spacing[4],
    insetBlockEnd: spacing[4],
    zIndex: zIndex.popover,
    fontFamily: typeface.newsreader,
    fontStyle: "italic",
    fontWeight: fontWeight.bold,
    fontSize: fontSize.lg,
  }),
  panel: css({
    position: "fixed",
    insetInlineEnd: spacing[4],
    insetBlockEnd: "4rem",
    // The popover layer, not above it: the lists open in a portal after the panel and must
    // stack on top of it.
    zIndex: zIndex.popover,
    display: "grid",
    gap: spacing[3],
    width: "min(22rem, calc(100vw - 2rem))",
    maxHeight: "calc(100vh - 6rem)",
    overflowY: "auto",
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.popover,
    color: theme.popoverForeground,
    boxShadow: shadow.lg,
    fontFamily: typeface.plusJakartaSans,
    fontSize: fontSize.sm,
  }),
  title: css({ fontWeight: fontWeight.semibold }),
  note: css({ color: theme.mutedForeground, fontSize: fontSize.xs }),
  field: css({ display: "grid", gap: spacing[1] }),
  label: css({ color: theme.mutedForeground, fontSize: fontSize.xs }),
  row: css({ display: "flex", alignItems: "center", gap: spacing[1] }),
  input: css({ flex: 1, minWidth: 0 }),
  content: css({ maxHeight: "20rem" }),
  itemName: css({ fontSize: fontSize.base }),
  actions: css({ display: "flex", gap: spacing[2] }),
}

/** One role: a searchable list that previews the highlighted family, and ← / → to step. */
function RoleField({
  label,
  family,
  onChoose,
  onPreview,
}: {
  label: string
  family: string
  onChoose: (family: string) => void
  /** A family to show for now, or `undefined` to go back to the chosen one. */
  onPreview: (family: string | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const step = (by: number) =>
    onChoose(ALL[(ALL.indexOf(family) + by + ALL.length) % ALL.length]!)

  return (
    <div sx={styles.field}>
      <span sx={styles.label}>{label}</span>
      <div sx={styles.row}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Previous font for ${label}`}
          onClick={() => step(-1)}
        >
          <Icon icon={ArrowLeft01Icon} />
        </Button>
        <Combobox
          items={GROUPS}
          value={family}
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (next) for (const name of ALL) void load(name)
            else onPreview(undefined)
          }}
          onValueChange={(next) => {
            if (next) onChoose(next as string)
          }}
          onItemHighlighted={(next) =>
            onPreview((next as string | undefined) ?? undefined)
          }
        >
          <ComboboxInput
            sx={styles.input}
            aria-label={label}
            style={{ fontFamily: stack(family) }}
            onKeyDown={(event) => {
              // While the list is closed, ← and → step through the families instead of moving the
              // caret; with it open they edit the search as usual.
              if (open) return
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault()
                step(event.key === "ArrowLeft" ? -1 : 1)
              }
            }}
          />
          <ComboboxContent sx={styles.content}>
            <ComboboxEmpty>No font by that name.</ComboboxEmpty>
            <ComboboxList>
              {(group: (typeof GROUPS)[number]) => (
                <ComboboxGroup key={group.value} items={group.items}>
                  <ComboboxLabel>{KIND_LABEL[group.value]}</ComboboxLabel>
                  <ComboboxCollection>
                    {(name: string) => (
                      <ComboboxItem key={name} value={name}>
                        <span
                          sx={styles.itemName}
                          style={{ fontFamily: stack(name) }}
                        >
                          {name}
                        </span>
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxGroup>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Next font for ${label}`}
          onClick={() => step(1)}
        >
          <Icon icon={ArrowRight01Icon} />
        </Button>
      </div>
    </div>
  )
}

// Rendered in the browser only, after hydration: the server's HTML never holds the panel.
const subscribe = () => () => {}
const isEnabled = () => true

export function FontLab() {
  // The server never renders the lab; the browser decides after hydration.
  const enabled = useSyncExternalStore(subscribe, isEnabled, () => false)
  const [open, setOpen] = useState(false)
  const [choices, setChoices] = useState<Choices>(read)

  // The saved picks, put back on the page once the lab is on.
  useEffect(() => {
    if (enabled) apply(read())
  }, [enabled])

  if (!enabled) return null

  const choose = (role: Role, family: string, current: string) => {
    const next = { ...choices, [role]: family === current ? undefined : family }
    setChoices(next)
    write(next)
    apply(next)
  }
  const preview = (role: Role, family: string | undefined) =>
    apply(family ? { ...choices, [role]: family } : choices)
  const summary = ROLES.map(
    ({ role, current }) => `${role}: ${choices[role] ?? current}`
  ).join("\n")

  return (
    <>
      {open ? (
        <div sx={styles.panel} role="dialog" aria-label="Font lab">
          <span sx={styles.title}>Font lab</span>
          <span sx={styles.note}>
            Hover or use ↑ ↓ in a list to preview; ← → on a closed field to
            step. Loaded from Google Fonts in this browser only.
          </span>
          {ROLES.map(({ role, label, current }) => (
            <RoleField
              key={role}
              label={label}
              family={choices[role] ?? current}
              onChoose={(family) => choose(role, family, current)}
              onPreview={(family) => preview(role, family)}
            />
          ))}
          <div sx={styles.actions}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void navigator.clipboard?.writeText(summary)}
            >
              Copy choices
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setChoices({})
                write({})
                apply({})
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      ) : null}
      <Button
        variant="outline"
        size="icon-lg"
        sx={styles.toggle}
        aria-label={open ? "Close the font lab" : "Open the font lab"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Aa
      </Button>
    </>
  )
}
