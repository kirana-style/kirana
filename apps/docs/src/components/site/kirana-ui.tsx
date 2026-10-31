/**
 * Kirana UI on this site: the drawings `/ui` and the homepage's components chapter share, and the
 * frameworks it has markup for. The drawings are the illustration kit's; the terminal's lines are
 * as `kirana-style ui add` prints a new file, and the configuration has the keys `ui` takes.
 */
import { css } from "@kirana-style/core"
import {
  BarChartIcon,
  ChartAreaIcon,
  ChartLineData01Icon,
  ChartRadarIcon,
  ChartRoseIcon,
  CommandLineIcon,
  FileCodeIcon,
  PieChart01Icon,
} from "@hugeicons/core-free-icons"

import { BrandIcon } from "@workspace/docs-ui/brand-icon.tsx"
import type { SvglIcon } from "@workspace/docs-ui/brand-icon.tsx"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  textLeading,
  textSize,
  textTracking,
} from "@workspace/ui/tokens/typography"

import { At, Card, Caret, Row, Scene, T, Tile } from "@/components/site/visuals"
import { UI_FRAMEWORKS } from "@/data/kirana-ui"
import { SVGL } from "@/generated/svgl-icons.gen"

const styles = {
  frameworks: css({
    display: "grid",
    gap: "1px",
    backgroundColor: theme.border,
    borderBlockWidth: "1px",
    borderBlockStyle: "solid",
    borderBlockColor: theme.border,
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.md]: "repeat(5, minmax(0, 1fr))",
    },
  }),
  framework: css({
    display: "grid",
    gap: spacing[2],
    justifyItems: "start",
    alignContent: "start",
    padding: { base: spacing[4], [breakpoint.md]: spacing[5] },
    backgroundColor: theme.background,
  }),
  name: css({
    fontSize: fontSize.base,
    lineHeight: "1.4",
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
  }),
  bases: css({
    fontSize: fontSize.sm,
    lineHeight: "1.5",
    color: theme.mutedForeground,
  }),
  status: css({
    fontFamily: fontFamily.mono,
    fontSize: textSize.micro,
    lineHeight: textLeading.micro,
    letterSpacing: textTracking.micro,
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  ready: css({ color: theme.foreground }),
  // Not out yet: the logo faded and the name muted, as the menus mark what is coming.
  faded: css({ opacity: 0.55 }),
  muted: css({ color: theme.mutedForeground }),
}

/** A component installed: the command, and the files it writes into the project. */
export function AddArt() {
  return (
    <Card title="~/app" icon={CommandLineIcon} width={300} glow>
      <Row flat typed={0}>
        <T tone="prompt">$</T>
        <T tone="strong">kirana-style ui add button</T>
      </Row>
      <Row flat typed={1}>
        <T tone="success">{"  +"}</T>
        <T>src/components/ui/button.tsx</T>
      </Row>
      <Row flat typed={2}>
        <T tone="success">{"  +"}</T>
        <T>src/components/ui/button.styles.ts</T>
      </Row>
      <Row flat typed={3}>
        <T tone="prompt">$</T>
        <Caret />
      </Row>
    </Card>
  )
}

/** The registry's chart families, each a tile: the kinds of chart a project can install. */
const CHARTS = [
  { icon: ChartAreaIcon, caption: "Area" },
  { icon: BarChartIcon, caption: "Bar" },
  { icon: ChartLineData01Icon, caption: "Line" },
  { icon: PieChart01Icon, caption: "Pie" },
  { icon: ChartRadarIcon, caption: "Radar" },
  { icon: ChartRoseIcon, caption: "Radial" },
] as const

export function ChartArt() {
  return (
    <Scene width={300} height={170}>
      {CHARTS.map((chart, index) => (
        <At
          key={chart.caption}
          x={20 + (index % 3) * 30}
          y={index < 3 ? 26 : 66}
        >
          <Tile
            icon={chart.icon}
            size={40}
            caption={chart.caption}
            variant={index === 1 ? "accent" : "plain"}
          />
        </At>
      ))}
    </Scene>
  )
}

/** The design a project chose, as its configuration holds it. */
export function DesignArt() {
  return (
    <Card title="kirana.config.ts" icon={FileCodeIcon} width={290} glow>
      <Row flat>
        <T tone="info">ui: {"{"}</T>
      </Row>
      <Row flat>
        <T>{"\u00a0\u00a0iconLibrary:"}</T>
        <T tone="success">&quot;lucide&quot;,</T>
      </Row>
      <Row flat lit>
        <T>{"\u00a0\u00a0design:"}</T>
        <T tone="success">{'{ style: "vega" }'}</T>
      </Row>
      <Row flat>
        <T tone="info">{"}"}</T>
      </Row>
    </Card>
  )
}

/** Each framework Kirana UI has markup for, by its logo, and whether it is out. */
export function UiFrameworks() {
  return (
    <div sx={styles.frameworks}>
      {UI_FRAMEWORKS.map((framework) => (
        <div key={framework.name} sx={styles.framework}>
          <BrandIcon
            icon={(SVGL as Record<string, SvglIcon>)[framework.logo]!}
            size="1.75rem"
            sx={framework.ready ? null : styles.faded}
          />
          <span sx={[styles.name, framework.ready ? null : styles.muted]}>
            {framework.name}
          </span>
          <span sx={styles.bases}>{framework.bases}</span>
          <span sx={[styles.status, framework.ready ? styles.ready : null]}>
            {framework.ready ? "Available" : "In development"}
          </span>
        </div>
      ))}
    </div>
  )
}
