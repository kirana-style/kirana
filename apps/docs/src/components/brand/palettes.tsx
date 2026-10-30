/**
 * Colour sets (`PALETTES` or `SOLIDS`), side by side where the mark has to hold up: large on paper
 * and on ink, in a dark editor's inline hint, and at 16 px in a dark browser tab. Under each ground,
 * each part's contrast against it; a part under 3 : 1 (the WCAG minimum for graphics) is flagged.
 * Each set copies or downloads as the mark alone, with no ground (`markSvg`).
 */
import { css } from "@kirana-style/core"

import { Badge } from "@workspace/ui/components/badge"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
} from "@workspace/ui/tokens/typography"

import type { Palette, Part } from "@/brand/kirana-mark"
import { KiranaMark } from "@/brand/kirana-mark-svg"
import { isOneColour, markSvg } from "@/brand/logo"
import {
  CopyButton,
  DownloadButton,
  svgDataUrl,
} from "@/components/brand/asset-buttons"

const PARTS: Part[] = ["stem", "arm", "leg"]

/** The grounds each set is judged on; `under` is what the mark itself sits on (the hint, the tab). */
const GROUNDS = [
  { id: "paper", hex: "#fafafa", under: "#fafafa", ink: "#0a0a0a" },
  { id: "ink", hex: "#0a0a0a", under: "#0a0a0a", ink: "#fafafa" },
  { id: "editor", hex: "#1e2024", under: "#2a2c30", ink: "#d7dce4" },
  { id: "tab", hex: "#202124", under: "#35363a", ink: "#e8eaed" },
] as const

const styles = {
  rows: css({
    display: "grid",
    gap: "1px",
    backgroundColor: theme.border,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
  }),
  row: css({
    display: "grid",
    gap: "1px",
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.lg]: "16rem repeat(4, minmax(0, 1fr))",
    },
  }),
  info: css({
    display: "grid",
    gap: spacing[2],
    alignContent: "start",
    padding: spacing[5],
    backgroundColor: theme.background,
    gridColumn: { base: "1 / -1", [breakpoint.lg]: "auto" },
  }),
  name: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    fontWeight: fontWeight.semibold,
  }),
  chosen: css({ fontWeight: fontWeight.medium }),
  note: css({
    fontSize: fontSize.sm,
    lineHeight: "1.55",
    color: theme.mutedForeground,
  }),
  swatches: css({ display: "flex", gap: spacing[1.5] }),
  // The mark alone in this set, with no ground: for a photo editor.
  actions: css({
    display: "flex",
    flexWrap: "wrap",
    gap: spacing[2],
    marginBlockStart: spacing[1],
  }),
  swatch: css({ height: "0.75rem", flex: "1 1 0", borderRadius: "999px" }),
  ground: css({
    display: "grid",
    gridTemplateRows: "1fr auto",
    gap: spacing[3],
    justifyItems: "center",
    alignItems: "center",
    minHeight: "11rem",
    padding: spacing[4],
  }),
  large: css({ height: "5rem" }),
  hint: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "0.45em",
    paddingInline: "0.5em",
    paddingBlock: "0.15em",
    borderRadius: "0.25rem",
    backgroundColor: "rgb(255 255 255 / 0.06)",
    fontFamily: fontFamily.mono,
    fontSize: "0.8125rem",
    color: "#e6d37f",
    whiteSpace: "nowrap",
  }),
  hintMark: css({ height: "0.95em" }),
  tab: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[2],
    paddingInline: spacing[3],
    paddingBlock: spacing[2],
    borderRadius: "0.5rem",
    backgroundColor: "#35363a",
    fontSize: fontSize.sm,
    whiteSpace: "nowrap",
  }),
  scores: css({
    display: "flex",
    gap: spacing[2],
    fontFamily: fontFamily.numeric,
    fontSize: "0.6875rem",
    opacity: 0.8,
  }),
  low: css({
    color: "#f43f5e",
    fontWeight: fontWeight.bold,
  }),
  lowOnDark: css({ color: "#fb7185", fontWeight: fontWeight.bold }),
}

/** Relative luminance of a hex colour (WCAG 2). */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** Contrast of a part against a ground: the mean of its stops' contrasts. */
function contrast(stops: [number, string][], ground: string) {
  const l2 = luminance(ground)
  const each = stops.map(([, colour]) => {
    const l1 = luminance(colour)
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  })
  return each.reduce((sum, value) => sum + value, 0) / each.length
}

function Scores({ palette, ground }: { palette: Palette; ground: string }) {
  const dark = luminance(ground) < 0.2
  return (
    <span sx={styles.scores}>
      {PARTS.map((part) => {
        const value = contrast(palette.stops[part], ground)
        return (
          <span
            key={part}
            sx={value < 3 ? (dark ? styles.lowOnDark : styles.low) : null}
            title={`${part}: ${value.toFixed(2)} : 1`}
          >
            {part[0]!.toUpperCase()} {value.toFixed(1)}
          </span>
        )
      })}
    </span>
  )
}

/** True when every stop of every part is one colour: the parts would fuse without a gap. */
const single = isOneColour

export function Palettes({
  sets,
  chosen,
}: {
  sets: readonly Palette[]
  /** The set the mark uses, marked as chosen. */
  chosen?: string
}) {
  return (
    <div sx={styles.rows}>
      {sets.map((palette) => (
        <div key={palette.id} sx={styles.row}>
          <div sx={styles.info}>
            <span sx={styles.name}>
              {palette.name}
              {palette.id === chosen ? (
                <Badge variant="secondary" sx={styles.chosen}>
                  Chosen
                </Badge>
              ) : null}
            </span>
            <span sx={styles.swatches}>
              {PARTS.map((part) => (
                <span
                  key={part}
                  sx={styles.swatch}
                  style={{
                    backgroundImage: `linear-gradient(90deg, ${palette.stops[
                      part
                    ]
                      .map(([offset, colour]) => `${colour} ${offset * 100}%`)
                      .join(", ")})`,
                  }}
                />
              ))}
            </span>
            <span sx={styles.note}>{palette.note}</span>
            <span sx={styles.actions}>
              <CopyButton
                text={markSvg(palette)}
                label={`Copy the ${palette.name} mark as SVG`}
              />
              <DownloadButton
                href={svgDataUrl(markSvg(palette))}
                name={`kirana-mark-${palette.id}.svg`}
              />
            </span>
          </div>
          {GROUNDS.map((ground) => (
            <div
              key={ground.id}
              sx={styles.ground}
              style={{ backgroundColor: ground.hex, color: ground.ink }}
            >
              {ground.id === "editor" ? (
                <span sx={styles.hint}>
                  <KiranaMark
                    stops={palette.stops}
                    gap={single(palette) ? ground.under : undefined}
                    title={null}
                    sx={styles.hintMark}
                  />
                  text 1.25rem · 600
                </span>
              ) : ground.id === "tab" ? (
                <span sx={styles.tab}>
                  <KiranaMark
                    stops={palette.stops}
                    gap={single(palette) ? ground.under : undefined}
                    title={null}
                    height={16}
                  />
                  Kirana
                </span>
              ) : (
                <KiranaMark
                  stops={palette.stops}
                  gap={single(palette) ? ground.under : undefined}
                  title={null}
                  sx={styles.large}
                />
              )}
              <Scores palette={palette} ground={ground.under} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
