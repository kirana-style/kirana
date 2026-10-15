/**
 * `<!-- ::docs-shortcuts -->`: the docs home's way in. One card per docs tab,
 * in the tab's accent: the first wide, the other four in a two-by-two grid.
 * Each card's isometric scene is a small picture of what the tab holds — the
 * compile, the frameworks, the migrations, the API, the project's road — and
 * rises a little while the card is hovered.
 */
import { css } from "@kirana-style/core"
import {
  CpuIcon,
  FileCodeIcon,
  FileEditIcon,
  FileScriptIcon,
  Flag01Icon,
  Tick02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { SVGL } from "@/generated/svgl-icons.gen"

import { accent, tint } from "@workspace/docs-ui/accent.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontFamily } from "@workspace/ui/tokens/typography"

import { TABS } from "@/components/docs-config"
import { IllustratedCard } from "@/components/site/illustrated-card"
import { At, Card, Row, Scene, T, Tag, Tile } from "@/components/site/visuals"
import { SHORTCUTS } from "@/data/shortcuts"
import type { Shortcut } from "@/data/shortcuts"

const styles = {
  grid: css({
    display: "grid",
    gap: spacing[3],
    marginBlock: spacing[8],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.sm]: "repeat(2, minmax(0, 1fr))",
    },
  }),
  // A plate on the isometric floor, for pieces to stand on.
  plate: css({
    borderRadius: "16px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: tint(35),
    backgroundColor: tint(7),
    boxShadow: `0 18px 30px -20px ${accent.base}`,
  }),
  sheet: css({
    position: "relative",
    width: "118px",
    height: "118px",
    borderRadius: "14px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
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
}

/* ── The scenes ─────────────────────────────────────────────────────── */

export function CompileScene() {
  return (
    <Scene
      width={230}
      height={120}
      iso
      live={["M 58 60 H 90", "M 140 60 H 172"]}
    >
      <At x={16} y={50}>
        <Tile icon={FileCodeIcon} size={42} caption="card.tsx" />
      </At>
      <At x={50} y={50}>
        <Tile icon={CpuIcon} size={50} variant="accent" caption="compile" />
      </At>
      <At x={84} y={50}>
        <Tile icon={FileScriptIcon} size={42} caption="kirana.css" />
      </At>
    </Scene>
  )
}

const FRAMEWORK_BRANDS = [
  SVGL.react,
  SVGL.vue,
  SVGL.svelte,
  SVGL.solidjs,
  SVGL.astro,
  SVGL.nextjs,
] as const

export function FrameworksScene() {
  return (
    <Scene width={180} height={150} iso>
      <At x={50} y={50}>
        <div sx={styles.plate} style={{ width: 164, height: 116 }} />
      </At>
      {FRAMEWORK_BRANDS.map((brand, i) => (
        <At
          key={brand.title}
          x={22 + (i % 3) * 28}
          y={34 + Math.floor(i / 3) * 32}
          z={10}
        >
          <Tile brand={brand} size={36} />
        </At>
      ))}
    </Scene>
  )
}

export function MigrateScene() {
  const sheets = [
    { label: "tailwind" },
    { label: "stylex" },
    { label: "kirana", live: true },
  ]
  return (
    <Scene width={170} height={170} iso sx={css({ translate: "0 8%" })}>
      {sheets.map((sheet, i) => (
        <At key={sheet.label} x={50} y={50} z={i * 30}>
          <div sx={[styles.sheet, sheet.live ? styles.sheetLive : null]}>
            <span sx={styles.sheetLabel}>
              <T tone={sheet.live ? "prompt" : "muted"}>{sheet.label}</T>
            </span>
          </div>
        </At>
      ))}
    </Scene>
  )
}

export function ReferenceScene() {
  return (
    <Scene width={200} height={150} iso>
      <At x={50} y={50}>
        <Card title="@kirana-style/core" width={176}>
          <Row>
            <Tag tone="accent">fn</Tag>
            <T tone="strong">css()</T>
          </Row>
          <Row>
            <Tag tone="accent">fn</Tag>
            <T tone="strong">props()</T>
          </Row>
          <Row>
            <Tag tone="accent">fn</Tag>
            <T tone="strong">defineTokens()</T>
          </Row>
        </Card>
      </At>
    </Scene>
  )
}

export function ProjectScene() {
  return (
    <Scene
      width={250}
      height={130}
      iso
      wires={["M 146 65 H 196"]}
      live={["M 58 65 H 102"]}
      dashed
    >
      <At x={16} y={50}>
        <Tile
          icon={Flag01Icon}
          size={42}
          badge={{
            tone: "success",
            label: <Icon icon={Tick02Icon} size="0.5rem" />,
          }}
          caption="status"
        />
      </At>
      <At x={50} y={50}>
        <Tile
          icon={FileEditIcon}
          size={48}
          variant="accent"
          caption="roadmap"
        />
      </At>
      <At x={84} y={50}>
        <Tile icon={UserGroupIcon} size={42} caption="contribute" />
      </At>
    </Scene>
  )
}

const SCENES: Record<Shortcut["tab"], () => React.ReactNode> = {
  docs: CompileScene,
  frameworks: FrameworksScene,
  guides: MigrateScene,
  reference: ReferenceScene,
  project: ProjectScene,
}

export function DocsShortcuts() {
  return (
    <nav sx={styles.grid} aria-label="Documentation sections">
      {SHORTCUTS.map((group, index) => {
        const tab = TABS.find((candidate) => candidate.id === group.tab)!
        const SceneFor = SCENES[group.tab]
        return (
          <IllustratedCard
            key={group.tab}
            tone={tab.accent}
            wide={index === 0}
            art={<SceneFor />}
            title={tab.label}
            href={tab.href}
            text={group.text}
            links={group.links}
          />
        )
      })}
    </nav>
  )
}
