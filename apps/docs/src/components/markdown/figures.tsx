/**
 * Figures for the guides, placed in markdown as `<!-- ::figure-… -->`. Each
 * draws what its page says, with the illustration kit: nothing here states a
 * fact the page does not. A second panel shows a second idea, and is left out
 * on narrow screens. Isometric scenes live on the docs home's shortcuts, where
 * they group sections rather than repeat a flat figure.
 */
import { css } from "@kirana-style/core"
import {
  ArrowExpandIcon,
  Atom01Icon,
  Calculator01Icon,
  CommandLineIcon,
  CpuIcon,
  FileCodeIcon,
  FileEditIcon,
  FileScriptIcon,
  FilterIcon,
  PackageIcon,
  PaintBoardIcon,
  PuzzleIcon,
  Sorting01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { SVGL } from "@/generated/svgl-icons.gen"

import { PALETTE, accent, accents } from "@workspace/docs-ui/accent.ts"
import type { AccentName } from "@workspace/docs-ui/accent.ts"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import { duration } from "@workspace/ui/tokens/motion"
import {
  fontFamily,
  fontSize,
  fontWeight,
  textLeading,
  textSize,
} from "@workspace/ui/tokens/typography"

import {
  At,
  Card,
  Pill,
  Row,
  Scene,
  Stage,
  T,
  Tag,
  Tile,
} from "@/components/site/visuals"

const styles = {
  root: css({
    display: "grid",
    gap: spacing[3],
    marginBlock: spacing[6],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(var(--panels, 1), minmax(0, 1fr))",
    },
  }),
  panel: css({
    height: "15rem",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.background,
  }),
  tall: css({ height: "18rem" }),
  stackScene: css({ translate: "0 28%" }),
  // A sheet: a translucent plate, its name along the near edge.
  sheet: css({
    position: "relative",
    width: "136px",
    height: "136px",
    borderRadius: "14px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
    opacity: 0.94,
    boxShadow:
      "0 1px 2px rgb(0 0 0 / 0.08), 0 12px 24px -16px rgb(0 0 0 / 0.35)",
  }),
  sheetLive: css({
    borderColor: accent.base,
    boxShadow: `0 0 0 1px ${accent.base}, 0 16px 30px -14px ${accent.base}`,
  }),
  sheetLabel: css({
    position: "absolute",
    insetInlineStart: "10px",
    insetBlockEnd: "8px",
    fontFamily: fontFamily.mono,
    fontSize: "0.625rem",
    whiteSpace: "nowrap",
  }),
  // At centres a piece; these pin its start or end edge to the point instead,
  // so wires of one length meet pills of different widths.
  fromStart: css({ translate: "50% 0" }),
  fromEnd: css({ translate: "-50% 0" }),
  second: css({ display: { base: "none", [breakpoint.md]: "block" } }),
  caption: css({
    gridColumn: "1 / -1",
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
}

function Figure({
  label,
  caption,
  tone,
  tall,
  panels,
}: {
  label: string
  caption: React.ReactNode
  /** A hue of its own; a figure otherwise takes its page's (the docs tab's). */
  tone?: AccentName
  tall?: boolean
  panels: readonly React.ReactNode[]
}) {
  return (
    <figure
      aria-label={label}
      sx={[tone ? accents[tone] : null, styles.root]}
      style={{ "--panels": panels.length } as React.CSSProperties}
    >
      {panels.map((panel, i) => (
        <div
          key={i}
          sx={[
            styles.panel,
            tall ? styles.tall : null,
            i > 0 ? styles.second : null,
          ]}
        >
          {panel}
        </div>
      ))}
      <figcaption sx={styles.caption}>{caption}</figcaption>
    </figure>
  )
}

/* ── Migrating from Tailwind ─────────────────────────────────────────── */

function Codemod() {
  return (
    <Stage>
      <Scene
        width={270}
        height={170}
        wires={["M 56 85 H 108"]}
        live={[
          "M 162 85 C 190 85, 190 45, 212 45",
          "M 162 85 C 190 85, 190 125, 212 125",
        ]}
      >
        <At x={12} y={50}>
          <Tile brand={SVGL.tailwindcss} size={44} caption="class strings" />
        </At>
        <At x={50} y={50}>
          <Tile
            icon={CommandLineIcon}
            size={54}
            variant="accent"
            caption="kirana migrate"
          />
        </At>
        <At x={85} y={26}>
          <Tile icon={FileCodeIcon} size={40} caption="css() objects" />
        </At>
        <At x={85} y={74}>
          <Tile icon={FileScriptIcon} size={40} caption="the report" />
        </At>
      </Scene>
    </Stage>
  )
}

export function CodemodFigure() {
  return (
    <Figure
      label="kirana migrate tailwind rewrites class strings into css() objects and writes a report"
      panels={[<Codemod key="flat" />]}
      caption="The codemod turns class strings into css() objects and lists what it would not decide in a report; nothing is written until you pass --write."
    />
  )
}

/* ── Migrating from StyleX ───────────────────────────────────────────── */

const STYLEX_PAIRS = [
  ["stylex.create", "css"],
  ["stylex.defineVars", "defineTokens"],
  ["stylex.createTheme", "defineTheme"],
  ["markers", "relation"],
] as const

export function StylexFigure() {
  const ys = [26, 71, 116, 161]
  return (
    <Figure
      label="How StyleX's API maps to Kirana's"
      tall
      panels={[
        <Stage key="flat">
          <Scene
            width={340}
            height={190}
            live={ys.map((y) => `M 140 ${y} H 214`)}
          >
            {STYLEX_PAIRS.map(([from, to], i) => (
              <div key={from}>
                <At x={22} y={(ys[i]! / 190) * 100}>
                  <Pill mono>{from}</Pill>
                </At>
                <At x={78} y={(ys[i]! / 190) * 100}>
                  <Pill mono active>
                    <Tag tone="accent" icon={Tick02Icon} />
                    {to}
                  </Pill>
                </At>
              </div>
            ))}
          </Scene>
        </Stage>,
      ]}
      caption="The codemod makes these rewrites mechanically; kirana check then finds the relations without anchors and the components that swallow sx."
    />
  )
}

/* ── Verifying a migration ───────────────────────────────────────────── */

function Conformance() {
  return (
    <Stage>
      <Scene
        width={290}
        height={180}
        wires={["M 54 50 C 80 50, 90 90, 118 90"]}
        live={["M 54 130 C 80 130, 90 90, 118 90"]}
      >
        <At x={11} y={28}>
          <Tile brand={SVGL.tailwindcss} size={40} caption="the original" />
        </At>
        <At x={11} y={72}>
          <Tile
            icon={CpuIcon}
            size={40}
            variant="accent"
            caption="the new build"
          />
        </At>
        <At x={69} y={50}>
          <Card title="getComputedStyle" width={160}>
            <Row>
              <T tone="muted">every element</T>
            </Row>
            <Row>
              <T tone="muted">several widths</T>
            </Row>
            <Row>
              <T tone="muted">both colour schemes</T>
            </Row>
            <Row lit>
              <Tag tone="success" icon={Tick02Icon} />
              <T tone="strong">0 differences</T>
            </Row>
          </Card>
        </At>
      </Scene>
    </Stage>
  )
}

export function ConformanceFigure() {
  return (
    <Figure
      label="Two builds compared by computed style"
      panels={[<Conformance key="flat" />]}
      caption="Serve both builds, open the same routes, read every element's computed style, and diff. The Tailwind migration of our shadcn/ui port ended at zero differences."
    />
  )
}

/* ── Stacked layers: cascade layers, and a design system's layers ─────── */

/** Stacked sheets in an isometric view, the first at the bottom. */
function Stack({
  layers,
}: {
  layers: readonly { label: string; live?: boolean }[]
}) {
  // Four sheets rise 114px; a taller stack spaces them closer and sinks by
  // the difference, so it stays centred where the four sit.
  const step = Math.min(38, 170 / (layers.length - 1))
  const sink = Math.max(0, ((layers.length - 1) * step - 114) / 2)
  return (
    <Stage>
      <Scene width={200} height={200} iso sx={styles.stackScene}>
        {layers.map((layer, i) => (
          <At key={layer.label} x={50} y={50} z={i * step - sink}>
            <div sx={[styles.sheet, layer.live ? styles.sheetLive : null]}>
              <span sx={styles.sheetLabel}>
                <T tone={layer.live ? "prompt" : "muted"}>
                  {String(i + 1).padStart(2, "0")}
                </T>{" "}
                <T tone="strong">{layer.label}</T>
              </span>
            </div>
          </At>
        ))}
      </Scene>
    </Stage>
  )
}

export function LayersFigure() {
  return (
    <Figure
      label="Kirana's cascade layers, in order"
      tall
      panels={[
        <Stack
          key="stack"
          layers={[
            { label: "reset" },
            { label: "base" },
            { label: "kirana.tokens" },
            { label: "kirana.themes" },
            { label: "kirana.contextual" },
            { label: "kirana.atoms", live: true },
          ]}
        />,
      ]}
      caption="The layer statement puts your reset and base styles below everything Kirana emits, and Kirana's own layers in a fixed order; a later layer wins."
    />
  )
}

export function DesignSystemFigure() {
  return (
    <Figure
      label="The six layers of a design system"
      tall
      panels={[
        <Stack
          key="stack"
          layers={[
            { label: "Scales" },
            { label: "Semantic tokens" },
            { label: "Conditions" },
            { label: "Recipes" },
            { label: "Primitives" },
            { label: "Components", live: true },
          ]}
        />,
      ]}
      caption="Each layer builds only on the ones below it; components sit on top and take sx last, so callers can override without forking."
    />
  )
}

/* ── Publishing a library ────────────────────────────────────────────── */

export function LibraryFigure() {
  return (
    <Figure
      label="A library ships uncompiled styles and the app compiles them with its own"
      panels={[
        <Stage key="flat">
          <Scene
            width={340}
            height={170}
            wires={[
              "M 64 45 C 100 45, 110 85, 140 85",
              "M 64 125 C 100 125, 110 85, 140 85",
            ]}
            live={["M 200 85 H 262"]}
          >
            <At x={12} y={26}>
              <Tile
                icon={PackageIcon}
                size={44}
                caption="acme-ui, uncompiled"
              />
            </At>
            <At x={12} y={74}>
              <Tile icon={FileCodeIcon} size={44} caption="your app" />
            </At>
            <At x={50} y={50}>
              <Tile
                icon={CpuIcon}
                size={54}
                variant="accent"
                caption="one compile"
              />
            </At>
            <At x={86} y={50}>
              <Tile icon={FileScriptIcon} size={44} caption="one stylesheet" />
            </At>
          </Scene>
        </Stage>,
      ]}
      caption="The library keeps its css() calls in its published JavaScript; the app lists it in libraries and compiles it with its own modules, so an override replaces its styles property by property."
    />
  )
}

/* ── Merging ─────────────────────────────────────────────────────────── */

export function MergeFigure() {
  return (
    <Figure
      label="A later style replaces the entries it names"
      tall
      panels={[
        <Stage key="flat">
          <Scene
            width={400}
            height={200}
            wires={["M 152 52 C 186 52, 190 100, 212 100"]}
            live={["M 152 150 C 186 150, 190 100, 212 100"]}
          >
            <At x={19} y={26}>
              <Card title="link" width={150}>
                <Row>
                  <T tone="muted">base</T>
                  <T>navy</T>
                </Row>
                <Row>
                  <T tone="muted">:hover</T>
                  <T>royalblue</T>
                </Row>
              </Card>
            </At>
            <At x={19} y={75}>
              <Card title="quiet" width={150}>
                <Row lit>
                  <T tone="muted">base</T>
                  <T tone="prompt">grey</T>
                </Row>
              </Card>
            </At>
            <At x={78} y={50}>
              <Card title="sx={[link, quiet]}" width={184} glow>
                <Row lit>
                  <T tone="muted">base</T>
                  <T tone="prompt">grey</T>
                </Row>
                <Row>
                  <T tone="muted">:hover</T>
                  <T>royalblue</T>
                </Row>
              </Card>
            </At>
          </Scene>
        </Stage>,
      ]}
      caption="quiet names only the base entry of color, so that is the entry it replaces; the hover entry from link is kept."
    />
  )
}

/* ── Relations ───────────────────────────────────────────────────────── */

export function RelationFigure() {
  return (
    <Figure
      label="A relation: the anchor on the element with the state, the read on another"
      panels={[
        <Stage key="flat">
          <Scene width={320} height={170} live={["M 160 58 V 112"]}>
            <At x={50} y={26}>
              <Pill mono active>
                <Tag tone="accent">anchor</Tag>
                {'<div data-disabled="true">'}
              </Pill>
            </At>
            <At x={50} y={74}>
              <Pill mono>
                <Tag tone="muted">reads</Tag>
                {"<label> opacity 0.5"}
              </Pill>
            </At>
          </Scene>
        </Stage>,
      ]}
      caption="field.anchor marks the element whose state is read; field.within(state) reads it from a descendant. The compiler checks that both ends exist."
    />
  )
}

/* ── How it works: the pipeline ──────────────────────────────────────── */

const STEPS = [
  { label: "1 · Prefilter", icon: FilterIcon },
  { label: "2 · Evaluate", icon: Calculator01Icon },
  { label: "3 · Normalise", icon: ArrowExpandIcon },
  { label: "4 · Atomise", icon: Atom01Icon },
  { label: "5 · Order", icon: Sorting01Icon },
  { label: "6 · Rewrite", icon: FileEditIcon },
] as const

function Pipeline() {
  // Two rows of three, read left to right and then back, like a snake.
  const xs = [44, 145, 246]
  const at = [
    [xs[0]!, 56],
    [xs[1]!, 56],
    [xs[2]!, 56],
    [xs[2]!, 148],
    [xs[1]!, 148],
    [xs[0]!, 148],
  ] as const
  return (
    <Stage>
      <Scene
        width={290}
        height={200}
        live={[
          `M ${xs[0]! + 24} 56 H ${xs[1]! - 24}`,
          `M ${xs[1]! + 24} 56 H ${xs[2]! - 24}`,
          `M ${xs[2]!} 80 V 124`,
          `M ${xs[2]! - 24} 148 H ${xs[1]! + 24}`,
          `M ${xs[1]! - 24} 148 H ${xs[0]! + 24}`,
        ]}
      >
        {STEPS.map((step, i) => (
          <At
            key={step.label}
            x={(at[i]![0] / 290) * 100}
            y={(at[i]![1] / 200) * 100}
          >
            <Tile
              icon={step.icon}
              size={44}
              variant={i === STEPS.length - 1 ? "accent" : "plain"}
              caption={step.label}
            />
          </At>
        ))}
      </Scene>
    </Stage>
  )
}

export function PipelineFigure() {
  return (
    <Figure
      label="The compiler's six steps, from source module to class strings"
      tall
      panels={[<Pipeline key="flat" />]}
      caption="Skip modules with nothing to style, evaluate what feeds a style, expand to longhands, make one atom per declaration, order them by the ladder, and rewrite css() and sx into class strings."
    />
  )
}

/* ── Precedence: the ladder ──────────────────────────────────────────── */

const LADDER = [
  "Origin",
  "Condition count",
  "Condition class",
  "Within a class",
  "Declaration breadth",
  "Tie-break",
] as const

export function PrecedenceFigure() {
  return (
    <Figure
      label="The precedence ladder, and a hover value beating a breakpoint value at step 3"
      tall
      panels={[
        <Stage key="ladder">
          <Scene width={230} height={220}>
            <At x={50} y={50}>
              <Card title="the ladder" width={210}>
                {LADDER.map((step, i) => (
                  <Row key={step} lit={i === 2}>
                    <T tone={i === 2 ? "prompt" : "muted"}>{i + 1}</T>
                    <T tone={i === 2 ? "strong" : undefined}>{step}</T>
                    {i === 5 ? <Tag tone="warn">reported</Tag> : null}
                  </Row>
                ))}
              </Card>
            </At>
          </Scene>
        </Stage>,
        <Stage key="example">
          <Scene
            width={280}
            height={200}
            wires={["M 124 150 C 150 150, 146 100, 168 100"]}
            live={["M 124 50 C 150 50, 146 100, 168 100"]}
          >
            <At x={43} y={25}>
              <div sx={styles.fromEnd}>
                <Pill mono active>
                  <Tag tone="accent">:hover</Tag>
                  blue
                </Pill>
              </div>
            </At>
            <At x={43} y={75}>
              <div sx={styles.fromEnd}>
                <Pill mono>
                  <Tag tone="muted">md</Tag>
                  red
                </Pill>
              </div>
            </At>
            <At x={60} y={50}>
              <div sx={styles.fromStart}>
                <Card title="color" width={104} glow>
                  <Row lit>
                    <Tag tone="success" icon={Tick02Icon} />
                    <T tone="strong">blue</T>
                  </Row>
                  <Row>
                    <T tone="muted">step 3</T>
                  </Row>
                </Card>
              </div>
            </At>
          </Scene>
        </Stage>,
      ]}
      caption="Steps are compared in order and the first difference decides. A pseudo-class outranks an at-rule at step 3, so a hover value wins over a breakpoint value at every width."
    />
  )
}

/* ── Conditions: one property, many entries ──────────────────────────── */

const ENTRIES = [
  ["base", "black"],
  [":hover", "blue"],
  ['[aria-current="page"]', "crimson"],
] as const

function Conditions() {
  const ys = [36, 90, 144]
  return (
    <Stage>
      <Scene
        width={300}
        height={180}
        live={ys.map((y) => `M 64 90 C 84 90, 82 ${y}, 102 ${y}`)}
      >
        <At x={13} y={50}>
          <Tile
            icon={PaintBoardIcon}
            size={48}
            variant="accent"
            caption="color"
          />
        </At>
        {ENTRIES.map(([key, value], i) => (
          <At key={key} x={35} y={(ys[i]! / 180) * 100}>
            <div sx={styles.fromStart}>
              <Pill mono>
                <Tag tone={i === 0 ? "muted" : "accent"}>{key}</Tag>
                {value}
              </Pill>
            </div>
          </At>
        ))}
      </Scene>
    </Stage>
  )
}

export function ConditionsFigure() {
  return (
    <Figure
      label="The color property holding a base value and two conditional values"
      panels={[<Conditions key="flat" />]}
      caption="The property is written once and its conditions go inside the value, so the whole story of color is in one place."
    />
  )
}

/* ── Values known at runtime ─────────────────────────────────────────── */

const RUNTIME = [
  { kind: "static", source: '"flex"', out: "one class" },
  {
    kind: "finite",
    source: 'tone ? "crimson" : "black"',
    out: "a ? class : class",
  },
  { kind: "open", source: "`${percent}%`", out: "var(--k…) + style" },
] as const

export function DynamicFigure() {
  const ys = [34, 90, 146]
  return (
    <Figure
      label="Static, finite and open values, and what each compiles to"
      tall
      panels={[
        <Stage key="flat">
          <Scene
            width={420}
            height={180}
            wires={ys.slice(0, 2).map((y) => `M 232 ${y} H 272`)}
            live={[`M 232 146 H 272`]}
          >
            {RUNTIME.map((row, i) => (
              <div key={row.kind}>
                <At x={54} y={(ys[i]! / 180) * 100}>
                  <div sx={styles.fromEnd}>
                    <Pill mono>
                      <Tag tone={i === 2 ? "accent" : "muted"}>{row.kind}</Tag>
                      {row.source}
                    </Pill>
                  </div>
                </At>
                <At x={66} y={(ys[i]! / 180) * 100}>
                  <div sx={styles.fromStart}>
                    <Pill mono active={i === 2}>
                      {row.out}
                    </Pill>
                  </div>
                </At>
              </div>
            ))}
          </Scene>
        </Stage>,
      ]}
      caption="A static value is a class. A choice between known values compiles each one and picks between class strings. An open value becomes one rule reading a custom property, set in the element's style attribute."
    />
  )
}

/* ── Themes and modes ────────────────────────────────────────────────── */

/** Two `primary` colours, the default's and the section theme's: two scene hues. */
const SWATCH = { base: PALETTE.lake, themed: PALETTE.dusk }

const scope = {
  frame: css({
    position: "relative",
    display: "grid",
    alignContent: "start",
    gap: "10px",
    padding: "12px",
    borderRadius: "12px",
    borderWidth: "1px",
    borderStyle: "dashed",
    borderColor: theme.border,
    backgroundColor: theme.card,
    fontFamily: fontFamily.mono,
    fontSize: "0.6875rem",
  }),
  inner: css({
    borderStyle: "solid",
    borderColor: accent.base,
    boxShadow: `0 12px 28px -16px ${accent.base}`,
  }),
  label: css({ color: theme.mutedForeground }),
  token: css({ display: "flex", alignItems: "center", gap: "6px" }),
  dot: css({ width: "10px", height: "10px", borderRadius: radius.full }),
}

function Scope({
  label,
  color,
  layer,
  inner,
  width,
  children,
}: {
  label: string
  color: string
  layer: string
  inner?: boolean
  width: number
  children?: React.ReactNode
}) {
  return (
    <div sx={[scope.frame, inner ? scope.inner : null]} style={{ width }}>
      <span sx={scope.label}>{label}</span>
      <span sx={scope.token}>
        <span sx={scope.dot} style={{ backgroundColor: color }} />
        <T tone="strong">primary</T>
        <Tag tone={inner ? "accent" : "muted"}>{layer}</Tag>
      </span>
      {children}
    </div>
  )
}

export function ThemesFigure() {
  return (
    <Figure
      label="A theme overriding a token inside one section; everything outside keeps the default"
      tall
      panels={[
        <Stage key="flat">
          <Scene width={330} height={200}>
            <At x={50} y={50}>
              <Scope
                label="<html sx={mode.system}>"
                color={SWATCH.base}
                layer="kirana.tokens"
                width={320}
              >
                <Scope
                  label="<section sx={brand}>"
                  color={SWATCH.themed}
                  layer="kirana.themes"
                  inner
                  width={230}
                />
              </Scope>
            </At>
          </Scene>
        </Stage>,
      ]}
      caption="The token's default sits on :root; defineTheme overrides it for one subtree, and the mode handle on the root picks the light or dark half of every pair."
    />
  )
}

/* ── Styling other people's components ───────────────────────────────── */

export function ExternalFigure() {
  return (
    <Figure
      label="sx on an installed component is not read; the compiled props are"
      panels={[
        <Stage key="flat">
          <Scene
            width={420}
            height={180}
            wires={["M 262 45 H 318"]}
            live={["M 262 135 H 318"]}
            dashed
          >
            <At x={61} y={25}>
              <div sx={styles.fromEnd}>
                <Pill mono>sx={"{styles.popup}"}</Pill>
              </div>
            </At>
            <At x={61} y={75}>
              <div sx={styles.fromEnd}>
                <Pill mono active>
                  {"{...styleProps(styles.popup, sx)}"}
                </Pill>
              </div>
            </At>
            <At x={82} y={25}>
              <Tile
                icon={PuzzleIcon}
                size={44}
                badge={{ tone: "danger", label: "✕" }}
                caption="Dialog.Popup: not read"
              />
            </At>
            <At x={82} y={75}>
              <Tile
                icon={PuzzleIcon}
                size={44}
                variant="accent"
                badge={{ tone: "success", label: "✓" }}
                caption="className, style"
              />
            </At>
          </Scene>
        </Stage>,
      ]}
      caption="A component from a package does not read sx, and the compiler warns. props() compiles the same handles into className and style, which any component that spreads its props applies."
    />
  )
}

/* ── Debugging: kirana trace ─────────────────────────────────────────── */

/** Output of the real command, for the card.tsx in the caption. */
const TRACE = [
  {
    value: "3rem",
    when: ":hover",
    step: "step 2 (1 condition > 0)",
    wins: true,
  },
  { value: "2rem", when: "base", step: "step 5 (set 1 longhand < 4)" },
  { value: "1rem", when: "base", step: "" },
] as const

export function TraceFigure() {
  return (
    <Figure
      label="kirana trace listing the candidates for padding-top and the step that decided"
      panels={[
        <Stage key="flat">
          <Scene width={380} height={170}>
            <At x={50} y={50}>
              <Card title="terminal" icon={CommandLineIcon} width={372}>
                <Row flat typed={0}>
                  <T tone="prompt">$</T>
                  <T tone="strong">kirana trace src/card.tsx:4 paddingTop</T>
                </Row>
                {TRACE.map((line, i) => (
                  <Row key={line.value} flat typed={i + 1} lit={"wins" in line}>
                    <T tone={"wins" in line ? "success" : "muted"}>
                      {"wins" in line ? "✓" : " "}
                    </T>
                    <T tone="strong">{line.value}</T>
                    <T tone="muted">{line.when}</T>
                    <T tone="info">{line.step}</T>
                  </Row>
                ))}
              </Card>
            </At>
          </Scene>
        </Stage>,
      ]}
      caption={
        <>
          For{" "}
          <code>
            {
              'sx={[css({ padding: "1rem" }), css({ paddingTop: { base: "2rem", ":hover": "3rem" } })]}'
            }
          </code>
          : every candidate, the winner marked, and the ladder step that put
          each one where it is.
        </>
      }
    />
  )
}

/* ── Lint ────────────────────────────────────────────────────────────── */

const LINT = [
  {
    file: "card:7",
    rule: "kirana/diagnostics",
    text: "width does not accept a bare number (5)",
  },
  {
    file: "toolbar:14",
    rule: "kirana/override-keeps-conditions",
    text: 'Separator sets alignSelf under [data-orientation="vertical"]',
  },
  {
    file: "badge:21",
    rule: "kirana/sx-last",
    text: "sx is followed by styles that override it",
  },
] as const

export function LintFigure() {
  return (
    <Figure
      label="Oxlint running the Kirana rules: three findings, each naming the rule and the place"
      panels={[
        <Stage key="flat">
          <Scene width={380} height={170}>
            <At x={50} y={50}>
              <Card title="terminal" icon={CommandLineIcon} width={372}>
                <Row flat typed={0}>
                  <T tone="prompt">$</T>
                  <T tone="strong">oxlint</T>
                </Row>
                {LINT.map((line, i) => (
                  <Row key={line.rule} flat typed={i + 1} danger={i === 1}>
                    <T tone="danger">✕</T>
                    <T tone="muted">{line.file}</T>
                    <T tone="info">{line.rule}</T>
                  </Row>
                ))}
                <Row flat typed={4} lit>
                  <T tone="success">✓</T>
                  <T tone="strong">same three under eslint .</T>
                </Row>
              </Card>
            </At>
          </Scene>
        </Stage>,
      ]}
      caption="The same rules under Oxlint (jsPlugins) and ESLint (flat config): the reports and the fixes are identical, and a test proves it on every change."
    />
  )
}

/* ── Output: a class name ────────────────────────────────────────────── */

const anatomy = {
  name: css({
    fontSize: "0.8125rem",
    fontWeight: 600,
    letterSpacing: "0.01em",
  }),
  segment: css({
    paddingInline: "1px",
    borderRadius: "3px",
  }),
}

/** Each part of a class name: its text, what it holds, the tone of its pill and colour. */
const SEGMENTS = [
  { text: "k", label: "prefix", value: "names.prefix", color: PALETTE.dusk },
  { text: "0", label: "property", value: "padding", color: PALETTE.lake },
  { text: "-Ab3", label: "target", value: "> svg", color: PALETTE.ochre },
  { text: "-x8Qe", label: "conditions", value: "md", color: PALETTE.forest },
  { text: "_kf2c", label: "value", value: "1.5rem", color: PALETTE.terracotta },
] as const

function Anatomy() {
  const ys = [12, 31, 50, 69, 88]
  const wires = ys.map(
    (y) => `M 262 105 C 300 105, 290 ${(y / 100) * 210}, 330 ${(y / 100) * 210}`
  )
  return (
    <Scene width={540} height={210} wires={wires.slice(1)} live={[wires[0]!]}>
      <At x={27} y={50}>
        <Card title="kirana.css" icon={FileScriptIcon} width={246} glow>
          <Row lit>
            <span sx={anatomy.name}>
              .
              {SEGMENTS.map((segment) => (
                <span
                  key={segment.label}
                  sx={anatomy.segment}
                  style={{
                    color: segment.color,
                    backgroundColor: `color-mix(in oklab, ${segment.color} 12%, transparent)`,
                  }}
                >
                  {segment.text}
                </span>
              ))}
            </span>
          </Row>
          <Row>
            <T tone="muted">{"{ padding: 1.5rem }"}</T>
          </Row>
          <Row>
            <T tone="muted">in @media (width {">="} 48rem)</T>
          </Row>
        </Card>
      </At>
      {SEGMENTS.map((segment, index) => (
        <At key={segment.label} x={61} y={ys[index]!}>
          <Pill mono sx={styles.fromStart}>
            <span
              sx={anatomy.segment}
              style={{
                color: segment.color,
                backgroundColor: `color-mix(in oklab, ${segment.color} 12%, transparent)`,
              }}
            >
              {segment.text}
            </span>
            <T tone="muted">{segment.label}</T>
            <T tone="strong">{segment.value}</T>
          </Pill>
        </At>
      ))}
    </Scene>
  )
}

export function ClassNameFigure() {
  return (
    <Figure
      label="A class name split into its parts: prefix, property code, target hash, condition hash and value hash"
      tall
      panels={[
        <Stage key="name">
          <Anatomy />
        </Stage>,
      ]}
      caption={
        <>
          The prefix is yours to set; the property code indexes the property
          table; the target and condition hashes appear only when the atom has
          them; the value hash follows the underscore. Same input, same name, on
          every machine.
        </>
      }
    />
  )
}

/* ── Mental model: the five ideas as thumbnails ──────────────────────── */

const thumbs = {
  // Five cells split by 1px gutters; on a phone each is a row, the drawing beside its name.
  grid: css({
    display: "grid",
    gap: "1px",
    marginBlock: spacing[6],
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.border,
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(5, minmax(0, 1fr))",
    },
  }),
  cell: css({
    display: "grid",
    gridTemplateColumns: {
      base: "9rem minmax(0, 1fr)",
      [breakpoint.md]: "1fr",
    },
    alignItems: "center",
    textDecorationLine: "none",
    color: theme.foreground,
    backgroundColor: { base: theme.background, ":hover": alpha.muted50 },
    transitionProperty: "background-color",
    transitionDuration: duration[150],
  }),
  art: css({ position: "relative", height: "7rem" }),
  stage: css({ paddingInline: spacing[1], paddingBlock: spacing[2] }),
  name: css({
    display: "grid",
    gap: spacing["0.5"],
    paddingInline: spacing[3],
    paddingBlock: spacing[3],
    fontSize: textSize.small,
    lineHeight: textLeading.small,
    fontWeight: fontWeight.semibold,
  }),
  number: css({
    fontFamily: fontFamily.mono,
    fontSize: textSize.micro,
    lineHeight: textLeading.micro,
    fontWeight: fontWeight.normal,
    color: theme.mutedForeground,
  }),
}

const IDEAS: { id: string; name: string; art: React.ReactNode }[] = [
  {
    id: "1-you-write-properties-not-classes",
    name: "Properties, not classes",
    art: (
      <Card title="card" width={112}>
        <Row>
          <T tone="muted">gap</T>
          <T>1rem</T>
        </Row>
        <Row>
          <T tone="muted">radius</T>
          <T>.75rem</T>
        </Row>
      </Card>
    ),
  },
  {
    id: "2-merging-replaces-entries-not-properties",
    name: "Entries, not properties",
    art: (
      <Card title="color" width={112}>
        <Row lit>
          <T tone="muted">base</T>
          <T tone="prompt">grey</T>
        </Row>
        <Row>
          <T tone="muted">:hover</T>
          <T>blue</T>
        </Row>
      </Card>
    ),
  },
  {
    id: "3-a-ladder-decides-what-wins-not-specificity",
    name: "A ladder, not specificity",
    art: (
      <Card title="wins" width={112}>
        <Row lit>
          <Tag tone="success" icon={Tick02Icon} />
          <T tone="strong">:hover</T>
        </Row>
        <Row>
          <T tone="muted">2</T>
          <T tone="muted">base</T>
        </Row>
      </Card>
    ),
  },
  {
    id: "4-style-what-you-render",
    name: "Style what you render",
    art: (
      <Scene width={120} height={64} wires={["M 46 32 H 74"]} dashed>
        <At x={25} y={50}>
          <Tile
            icon={FileCodeIcon}
            size={34}
            variant="accent"
            badge={{ tone: "success", label: "✓" }}
          />
        </At>
        <At x={75} y={50}>
          <Tile
            icon={PackageIcon}
            size={34}
            badge={{ tone: "danger", label: "✕" }}
          />
        </At>
      </Scene>
    ),
  },
  {
    id: "5-your-editor-shows-what-the-element-gets",
    name: "The editor shows it",
    art: (
      <Card title="plan.tsx" icon={FileEditIcon} width={116}>
        <Row flat>
          <T tone="strong">{"<h2>"}</T>
        </Row>
        <Row flat>
          <Tag tone="accent">text 1.25rem</Tag>
        </Row>
      </Card>
    ),
  },
]

/** The page's five ideas at a glance, each a small drawing that links to its section. */
export function MentalModelFigure() {
  return (
    <nav aria-label="The five ideas" sx={thumbs.grid}>
      {IDEAS.map((idea, i) => (
        <a key={idea.id} href={`#${idea.id}`} sx={thumbs.cell}>
          <span sx={thumbs.art}>
            <Stage sx={thumbs.stage}>{idea.art}</Stage>
          </span>
          <span sx={thumbs.name}>
            <span sx={thumbs.number}>{String(i + 1).padStart(2, "0")}</span>
            {idea.name}
          </span>
        </a>
      ))}
    </nav>
  )
}
