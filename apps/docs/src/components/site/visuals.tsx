/**
 * The site's illustration kit. A scene is a fixed-size canvas; tiles, pills and
 * cards are placed on it by percentage, and wires are drawn underneath in one
 * SVG layer. Any scene can be shown flat or tilted isometrically (`iso`).
 *
 * Tiles and pills carry a halo in the page colour, so a wire passing behind
 * them stops cleanly at their edge. The glow under a card mixes the site's
 * accent palette. Icons are Hugeicons or SVGL (svgl.app); nothing is hand-drawn
 * except the wires. Everything follows the page's accent and colour scheme.
 */
import { css, keyframes } from "@kirana-style/core"

import { PALETTE, SUN, accent, tint } from "@workspace/docs-ui/accent.ts"
import { BrandIcon } from "@workspace/docs-ui/brand-icon.tsx"
import type { SvglIcon } from "@workspace/docs-ui/brand-icon.tsx"
import type { Sx } from "@workspace/ui/lib/sx"
import { Icon } from "@workspace/ui/primitives/icon"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontFamily, fontWeight } from "@workspace/ui/tokens/typography"

/** What a drawing marks as wrong, right, a warning or a note: the theme's red and three scene hues. */
export const DANGER = theme.destructive
export const SUCCESS = PALETTE.forest
export const WARN = PALETTE.ochre
export const INFO = PALETTE.lake

const mix = (color: string, percent: number) =>
  `color-mix(in oklab, ${color} ${percent}%, transparent)`

// Motion. Each is quiet and loops; every one stops under reduced motion.
const REDUCED = "@media (prefers-reduced-motion: reduce)"

/** A bright segment travelling along a wire (paths use pathLength 100). */
const travel = keyframes({
  from: { strokeDashoffset: 110 },
  to: { strokeDashoffset: 0 },
})
/** A ring leaving an accent tile. */
const ping = keyframes({
  "0%": { scale: "1", opacity: 0.55 },
  "80%, 100%": { scale: "1.55", opacity: 0 },
})
/** A line of a terminal appearing, staying, and clearing for the next loop. */
const typeIn = keyframes({
  "0%": { opacity: 0, translate: "-4px 0" },
  "6%, 88%": { opacity: 1, translate: "0 0" },
  "96%, 100%": { opacity: 0, translate: "0 0" },
})
const blink = keyframes({
  "0%, 49%": { opacity: 1 },
  "50%, 100%": { opacity: 0 },
})
const flash = keyframes({
  "0%, 100%": { backgroundColor: "transparent" },
  "30%, 70%": {
    backgroundColor: `color-mix(in oklab, ${DANGER} 12%, transparent)`,
  },
})

/** The halo and the lift every floating piece shares. */
const LIFT = `0 0 0 2px ${theme.background}, 0 1px 2px rgb(0 0 0 / 0.06), 0 10px 24px -12px rgb(0 0 0 / 0.22)`

const styles = {
  // The ground: a faint grid and soft glows behind the scene.
  stage: css({
    position: "relative",
    width: "100%",
    height: "100%",
    isolation: "isolate",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    paddingInline: spacing[4],
    paddingBlock: spacing[6],
  }),
  grid: css({
    position: "absolute",
    inset: 0,
    zIndex: -1,
    pointerEvents: "none",
    backgroundImage: `linear-gradient(to right, ${alpha.foreground5} 1px, transparent 1px), linear-gradient(to bottom, ${alpha.foreground5} 1px, transparent 1px)`,
    backgroundSize: "28px 28px",
    maskImage:
      "radial-gradient(ellipse 55% 55% at 50% 50%, black 40%, transparent 100%)",
  }),
  glow: css({
    position: "absolute",
    insetBlockStart: "50%",
    insetInlineStart: "50%",
    width: "18rem",
    height: "18rem",
    translate: "-50% -50%",
    zIndex: -1,
    pointerEvents: "none",
    borderRadius: radius.full,
    backgroundImage: `radial-gradient(circle, ${tint(100)}, transparent 68%)`,
    opacity: 0.18,
    filter: "blur(48px)",
  }),
  glowDanger: css({
    insetInlineStart: "68%",
    width: "11rem",
    height: "11rem",
    backgroundImage: `radial-gradient(circle, ${DANGER}, transparent 65%)`,
    opacity: 0.16,
  }),

  scene: css({ position: "relative", flexShrink: 0 }),
  iso: css({
    transform: "rotateX(45deg) rotateZ(-45deg)",
    transformStyle: "preserve-3d",
  }),
  wires: css({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "none",
  }),
  wire: css({
    fill: "none",
    stroke: alpha.foreground10,
    strokeWidth: 1.25,
  }),
  wireLive: css({ stroke: tint(55) }),
  spark: css({
    fill: "none",
    stroke: accent.base,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeDasharray: "10 100",
    strokeDashoffset: 110,
    animationName: { base: travel, [REDUCED]: "none" },
    animationDuration: "2.6s",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
    opacity: { base: 1, [REDUCED]: 0 },
  }),
  pingRing: css({
    position: "absolute",
    inset: "-1px",
    zIndex: -1,
    borderRadius: "inherit",
    borderWidth: "2px",
    borderStyle: "solid",
    borderColor: accent.base,
    pointerEvents: "none",
    opacity: 0,
    animationName: { base: ping, [REDUCED]: "none" },
    animationDuration: "2.4s",
    animationTimingFunction: "cubic-bezier(0, 0, 0.2, 1)",
    animationIterationCount: "infinite",
  }),
  typed: css({
    animationName: { base: typeIn, [REDUCED]: "none" },
    animationDuration: "7s",
    animationTimingFunction: "ease-out",
    animationIterationCount: "infinite",
    animationFillMode: "both",
  }),
  caret: css({
    display: "inline-block",
    width: "6px",
    height: "0.9em",
    backgroundColor: accent.base,
    animationName: { base: blink, [REDUCED]: "none" },
    animationDuration: "1s",
    animationTimingFunction: "steps(1)",
    animationIterationCount: "infinite",
  }),
  rowFlash: css({
    animationName: { base: flash, [REDUCED]: "none" },
    animationDuration: "2.8s",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
  }),
  wireDashed: css({ strokeDasharray: "4 4" }),
  at: css({
    position: "absolute",
    translate: "-50% -50%",
    transformStyle: "preserve-3d",
  }),

  tile: css({
    position: "relative",
    display: "grid",
    placeItems: "center",
    borderRadius: "0.75rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
    color: theme.foreground,
    boxShadow: LIFT,
  }),
  tileAccent: css({
    borderColor: "transparent",
    backgroundImage: `linear-gradient(to bottom, ${mix(accent.base, 80)}, ${accent.base})`,
    color: accent.on,
  }),
  tileInk: css({
    borderColor: "transparent",
    backgroundColor: theme.foreground,
    color: theme.background,
  }),
  tileRound: css({ borderRadius: radius.full }),
  tileBadge: css({
    position: "absolute",
    insetBlockStart: "-7px",
    insetInlineEnd: "-7px",
    display: "grid",
    placeItems: "center",
    minWidth: "1.125rem",
    height: "1.125rem",
    paddingInline: "3px",
    borderRadius: radius.full,
    boxShadow: `0 0 0 2px ${theme.background}`,
    color: "white",
    fontSize: "0.5625rem",
    fontWeight: fontWeight.semibold,
  }),
  captionEnd: css({
    insetBlockStart: "50%",
    insetInlineStart: "calc(100% + 8px)",
    translate: "0 -50%",
  }),
  caption: css({
    position: "absolute",
    insetBlockStart: "calc(100% + 6px)",
    insetInlineStart: "50%",
    translate: "-50% 0",
    whiteSpace: "nowrap",
    fontFamily: fontFamily.mono,
    fontSize: "0.625rem",
    color: theme.mutedForeground,
  }),

  pill: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["1.5"],
    height: "1.75rem",
    borderRadius: radius.full,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
    paddingInlineStart: spacing["1.5"],
    paddingInlineEnd: spacing[3],
    whiteSpace: "nowrap",
    fontSize: "0.6875rem",
    color: theme.foreground,
    boxShadow: LIFT,
  }),
  pillMono: css({ fontFamily: fontFamily.mono }),
  pillActive: css({ borderColor: tint(55) }),
  tag: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
    borderRadius: radius.md,
    paddingInline: "5px",
    paddingBlock: "1px",
    fontFamily: fontFamily.mono,
    fontSize: "0.5625rem",
    fontWeight: fontWeight.medium,
    lineHeight: "1rem",
  }),
  tagIcon: css({
    display: "grid",
    placeItems: "center",
    width: "1rem",
    height: "1rem",
    borderRadius: radius.full,
  }),

  card: css({
    position: "relative",
    overflow: "hidden",
    borderRadius: "0.75rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
    boxShadow: `0 0 0 2px ${theme.background}, 0 1px 2px rgb(0 0 0 / 0.06), 0 18px 40px -18px rgb(0 0 0 / 0.3)`,
    textAlign: "start",
  }),
  cardDashed: css({ borderStyle: "dashed" }),
  cardDanger: css({ borderColor: mix(DANGER, 70) }),
  cardBar: css({
    display: "flex",
    alignItems: "center",
    gap: spacing["1.5"],
    paddingInline: spacing["2.5"],
    paddingBlock: spacing["1.5"],
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
    backgroundColor: alpha.muted50,
  }),
  dots: css({ display: "flex", gap: "4px" }),
  dot: css({ width: "6px", height: "6px", borderRadius: radius.full }),
  cardTitle: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontFamily: fontFamily.mono,
    fontSize: "0.625rem",
    color: theme.mutedForeground,
  }),
  cardExtra: css({
    marginInlineStart: "auto",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
  }),
  cardBody: css({
    display: "grid",
    fontFamily: fontFamily.mono,
    fontSize: "0.6875rem",
    lineHeight: "1.55",
  }),
  row: css({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: spacing["1.5"],
    paddingInline: spacing["2.5"],
    paddingBlock: "5px",
    whiteSpace: "nowrap",
    borderBlockStartWidth: { base: "1px", ":first-child": "0" },
    borderBlockStartStyle: "solid",
    borderBlockStartColor: alpha.border50,
  }),
  rowFlat: css({ borderBlockStartWidth: "0", paddingBlock: "1px" }),
  rowLit: css({ backgroundColor: tint(7) }),
  rowDanger: css({ backgroundColor: mix(DANGER, 9) }),

  // Light under a card: the sun into the page's hue, faded upwards into the page.
  underglow: css({
    position: "absolute",
    insetInline: "6px",
    insetBlockEnd: "-2px",
    height: "1.5rem",
    zIndex: -1,
    borderRadius: radius.full,
    backgroundImage: `linear-gradient(to right, ${SUN.sun}, ${accent.base})`,
    opacity: 0.6,
    filter: "blur(6px)",
  }),

  bar: css({
    height: "4px",
    borderRadius: radius.full,
    backgroundColor: alpha.foreground10,
  }),

  prompt: css({ color: accent.base }),
  danger: css({ color: DANGER }),
  success: css({ color: SUCCESS }),
  warn: css({ color: WARN }),
  info: css({ color: INFO }),
  muted: css({ color: theme.mutedForeground }),
  strong: css({ color: theme.foreground, fontWeight: fontWeight.medium }),
}

const TONE_STYLES = {
  info: css({ color: INFO, backgroundColor: mix(INFO, 12) }),
  warn: css({ color: WARN, backgroundColor: mix(WARN, 14) }),
  danger: css({ color: DANGER, backgroundColor: mix(DANGER, 12) }),
  success: css({ color: SUCCESS, backgroundColor: mix(SUCCESS, 12) }),
  accent: css({ color: accent.base, backgroundColor: tint(12) }),
  muted: css({ color: theme.mutedForeground, backgroundColor: theme.muted }),
}
export type Tone = keyof typeof TONE_STYLES

const TEXT = {
  prompt: styles.prompt,
  danger: styles.danger,
  success: styles.success,
  warn: styles.warn,
  info: styles.info,
  muted: styles.muted,
  strong: styles.strong,
}

/** The ground a scene stands on: grid, glow, and a second glow for errors. */
export function Stage({
  danger,
  sx,
  children,
}: {
  danger?: boolean
  sx?: Sx
  children: React.ReactNode
}) {
  return (
    <div sx={[styles.stage, sx]} aria-hidden="true">
      <span sx={styles.grid} />
      <span sx={styles.glow} />
      {danger ? <span sx={[styles.glow, styles.glowDanger]} /> : null}
      {children}
    </div>
  )
}

/**
 * A fixed canvas. `wires` are SVG path strings in the canvas's own pixel
 * coordinates; `live` wires are drawn in the accent.
 */
export function Scene({
  width,
  height,
  iso,
  wires = [],
  live = [],
  dashed,
  sx,
  children,
}: {
  width: number
  height: number
  iso?: boolean
  wires?: readonly string[]
  live?: readonly string[]
  dashed?: boolean
  sx?: Sx
  children: React.ReactNode
}) {
  return (
    <div
      sx={[styles.scene, iso ? styles.iso : null, sx]}
      style={{ width, height }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        sx={styles.wires}
        aria-hidden="true"
      >
        {wires.map((d) => (
          <path
            key={d}
            d={d}
            sx={[styles.wire, dashed ? styles.wireDashed : null]}
          />
        ))}
        {live.map((d) => (
          <path key={d} d={d} sx={[styles.wire, styles.wireLive]} />
        ))}
        {live.map((d, i) => (
          <path
            key={`spark-${d}`}
            d={d}
            pathLength={100}
            sx={styles.spark}
            style={{ animationDelay: `${i * 0.45}s` }}
          />
        ))}
      </svg>
      {children}
    </div>
  )
}

/**
 * Places a piece with its centre at a percentage of the scene; `z` lifts it
 * towards the viewer in an isometric scene (stacked layers).
 */
export function At({
  x,
  y,
  z,
  children,
}: {
  x: number
  y: number
  z?: number
  children: React.ReactNode
}) {
  return (
    <div
      sx={styles.at}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        ...(z ? { transform: `translateZ(${z}px)` } : {}),
      }}
    >
      {children}
    </div>
  )
}

export function Tile({
  icon,
  brand,
  size = 44,
  variant = "plain",
  round,
  badge,
  caption,
  captionAt = "below",
  sx,
}: {
  icon?: IconProps["icon"]
  brand?: SvglIcon
  size?: number
  variant?: "plain" | "accent" | "ink"
  round?: boolean
  badge?: { tone: "danger" | "success" | "accent"; label: React.ReactNode }
  caption?: string
  /** Where the caption sits: under the tile, or beside it. */
  captionAt?: "below" | "end"
  sx?: Sx
}) {
  const glyph = `${Math.round(size * 0.44)}px`
  return (
    <div
      sx={[
        styles.tile,
        variant === "accent" ? styles.tileAccent : null,
        variant === "ink" ? styles.tileInk : null,
        round ? styles.tileRound : null,
        sx,
      ]}
      style={{ width: size, height: size }}
    >
      {variant === "accent" ? <span sx={styles.pingRing} /> : null}
      {brand ? (
        <BrandIcon icon={brand} size={glyph} />
      ) : icon ? (
        <Icon icon={icon} size={glyph} />
      ) : null}
      {badge ? (
        <span
          sx={[
            styles.tileBadge,
            badge.tone === "danger"
              ? css({ backgroundColor: DANGER })
              : badge.tone === "success"
                ? css({ backgroundColor: SUCCESS })
                : css({ backgroundColor: accent.base }),
          ]}
        >
          {badge.label}
        </span>
      ) : null}
      {caption ? (
        <span
          sx={[styles.caption, captionAt === "end" ? styles.captionEnd : null]}
        >
          {caption}
        </span>
      ) : null}
    </div>
  )
}

/** A small tinted label: a log level, a method, a status. */
export function Tag({
  tone = "muted",
  icon,
  children,
}: {
  tone?: Tone
  icon?: IconProps["icon"]
  children?: React.ReactNode
}) {
  if (icon && !children)
    return (
      <span sx={[styles.tagIcon, TONE_STYLES[tone]]}>
        <Icon icon={icon} size="0.625rem" />
      </span>
    )
  return (
    <span sx={[styles.tag, TONE_STYLES[tone]]}>
      {icon ? <Icon icon={icon} size="0.625rem" /> : null}
      {children}
    </span>
  )
}

export function Pill({
  mono,
  active,
  sx,
  children,
}: {
  mono?: boolean
  active?: boolean
  sx?: Sx
  children: React.ReactNode
}) {
  return (
    <span
      sx={[
        styles.pill,
        mono ? styles.pillMono : null,
        active ? styles.pillActive : null,
        sx,
      ]}
    >
      {children}
    </span>
  )
}

/** A card with a window bar; `glow` lights it from below. */
export function Card({
  title,
  icon,
  extra,
  width,
  dashed,
  danger,
  glow,
  sx,
  children,
}: {
  title?: string
  icon?: IconProps["icon"]
  extra?: React.ReactNode
  width?: number
  dashed?: boolean
  danger?: boolean
  glow?: boolean
  sx?: Sx
  children: React.ReactNode
}) {
  return (
    <div sx={css({ position: "relative", isolation: "isolate" })}>
      {glow ? <span sx={styles.underglow} /> : null}
      <div
        sx={[
          styles.card,
          dashed ? styles.cardDashed : null,
          danger ? styles.cardDanger : null,
          sx,
        ]}
        style={width ? { width } : undefined}
      >
        {title !== undefined ? (
          <div sx={styles.cardBar}>
            <span sx={styles.dots}>
              <span
                sx={[
                  styles.dot,
                  css({ backgroundColor: "oklch(0.72 0.17 20)" }),
                ]}
              />
              <span
                sx={[
                  styles.dot,
                  css({ backgroundColor: "oklch(0.82 0.15 80)" }),
                ]}
              />
              <span
                sx={[
                  styles.dot,
                  css({ backgroundColor: "oklch(0.76 0.15 160)" }),
                ]}
              />
            </span>
            <span sx={styles.cardTitle}>
              {icon ? <Icon icon={icon} size="0.625rem" /> : null}
              {title}
            </span>
            {extra ? <span sx={styles.cardExtra}>{extra}</span> : null}
          </div>
        ) : null}
        <div sx={styles.cardBody}>{children}</div>
      </div>
    </div>
  )
}

/** One row of a card. `flat` rows have no rule between them (terminal lines). */
export function Row({
  flat,
  lit,
  danger,
  typed,
  children,
}: {
  flat?: boolean
  lit?: boolean
  /** Danger rows pulse red. */
  danger?: boolean
  /** Types in as line number `typed` of a looping terminal. */
  typed?: number
  children: React.ReactNode
}) {
  return (
    <div
      sx={[
        styles.row,
        flat ? styles.rowFlat : null,
        lit ? styles.rowLit : null,
        danger ? [styles.rowDanger, styles.rowFlash] : null,
        typed !== undefined ? styles.typed : null,
      ]}
      style={
        typed !== undefined ? { animationDelay: `${typed * 0.55}s` } : undefined
      }
    >
      {children}
    </div>
  )
}

/** Text in one of the scene's tones. */
export function T({
  tone,
  children,
}: {
  tone?: keyof typeof TEXT
  children: React.ReactNode
}) {
  return <span sx={tone ? TEXT[tone] : null}>{children}</span>
}

/** A terminal's blinking cursor. */
export function Caret() {
  return <span sx={styles.caret} />
}

/** A placeholder line of text, for abstract UI. */
export function Bar({ width }: { width: string }) {
  return <span sx={styles.bar} style={{ width }} />
}
