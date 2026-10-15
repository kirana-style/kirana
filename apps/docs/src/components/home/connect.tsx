/**
 * "Connect Kirana to anything": the surfaces around the compiler, each with a
 * small line drawing. Status comes from the ecosystem page — what is planned
 * says so, and is drawn dashed.
 */
import { css } from "@kirana-style/core"
import {
  ChatGptIcon,
  CommandLineIcon,
  FileCodeIcon,
  FileScriptIcon,
  RoboticIcon,
  SparklesIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { SVGL } from "@/generated/svgl-icons.gen"

import { accent, accents, tint } from "@workspace/docs-ui/accent.ts"
import type { AccentName } from "@workspace/docs-ui/accent.ts"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontSize, fontWeight } from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import {
  At,
  Card,
  Caret,
  Pill,
  Row,
  Scene,
  Stage,
  T,
  Tag,
  Tile,
} from "@/components/site/visuals"
import { LIFT, REST } from "@/components/site/lift"

import { HomeSection, frame } from "./frame"

const styles = {
  grid: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(2, minmax(0, 1fr))",
    },
  }),
  card: css({
    display: "grid",
    gridTemplateRows: "auto 1fr",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    boxShadow: { base: REST, ":hover": LIFT },
    backgroundColor: theme.card,
    textDecorationLine: "none",
    color: theme.foreground,
    transitionProperty: "box-shadow",
    transitionDuration: duration[200],
  }),
  art: css({
    height: "13rem",
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
    backgroundColor: theme.background,
  }),
  copy: css({ display: "grid", gap: spacing[2], padding: spacing[6] }),
  titleRow: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
  }),
  status: css({
    borderRadius: radius.full,
    paddingInline: spacing[2],
    fontSize: "0.625rem",
    lineHeight: "1.125rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: accent.base,
    backgroundColor: tint(12),
  }),
  planned: css({ color: theme.mutedForeground, backgroundColor: theme.muted }),
  text: css({ fontSize: fontSize.sm, lineHeight: "1.65" }),
}

export function CliArt() {
  return (
    <Stage>
      <Card title="~/app" icon={CommandLineIcon} width={290} glow>
        <Row flat typed={0}>
          <T tone="prompt">$</T>
          <T tone="strong">kirana check src</T>
        </Row>
        <Row flat typed={1}>
          <T tone="danger">error[KRN1401]</T>
          <T>relation-without-anchor</T>
        </Row>
        <Row flat typed={2}>
          <T tone="muted">{"  --> src/menu.tsx"}</T>
        </Row>
        <Row flat typed={3}>
          <T tone="prompt">help:</T>
          <T tone="muted">apply relation.anchor</T>
        </Row>
        <Row flat typed={4}>
          <T tone="muted">1 diagnostic(s), 1 error(s)</T>
        </Row>
        <Row flat typed={5}>
          <T tone="prompt">$</T>
          <Caret />
        </Row>
      </Card>
    </Stage>
  )
}

export function LlmArt() {
  // Two sources on the left — the docs as text, and the skills an agent installs — and three
  // readers on the right, every reader joined to both.
  const readers = [31, 85, 139]
  const wires = [51, 122].flatMap((from) =>
    readers.map((y) => `M 70 ${from} C 130 ${from}, 140 ${y}, 200 ${y}`)
  )
  return (
    <Stage>
      <Scene width={320} height={170} wires={wires.slice(1)} live={[wires[0]!]}>
        <At x={14} y={30}>
          <Tile
            icon={FileScriptIcon}
            variant="accent"
            size={44}
            caption="llms.txt"
          />
        </At>
        <At x={14} y={72}>
          <Tile icon={SparklesIcon} size={44} caption="skills" />
        </At>
        <At x={70} y={18}>
          <Tile icon={ChatGptIcon} caption="ChatGPT" captionAt="end" />
        </At>
        <At x={70} y={50}>
          <Tile brand={SVGL.claude} caption="Claude" captionAt="end" />
        </At>
        <At x={70} y={82}>
          <Tile icon={RoboticIcon} caption="your agent" captionAt="end" />
        </At>
      </Scene>
    </Stage>
  )
}

export function EditorArt() {
  return (
    <Stage>
      <Scene width={300} height={180} iso>
        <At x={56} y={42}>
          <Card title="menu.tsx" icon={FileCodeIcon} width={220}>
            <Row flat>
              <T tone="muted">{"<ul sx={menu} />"}</T>
            </Row>
            <Row flat lit>
              <T tone="info">grid · gap 4px · p 4px</T>
            </Row>
            <Row flat>
              <T tone="muted">rotate: {"{"}</T>
            </Row>
            <Row flat>
              <T>{"  [menu.within(open)]: "}</T>
              <T tone="info">"180deg"</T>
            </Row>
          </Card>
        </At>
        <At x={60} y={86}>
          <Pill mono>
            <Tag tone="success" icon={Tick02Icon} />
            kirana lsp
          </Pill>
        </At>
        <At x={9} y={24}>
          <Tile brand={SVGL.vscode} size={36} />
        </At>
        <At x={9} y={60}>
          <Tile brand={SVGL.zed} size={36} />
        </At>
      </Scene>
    </Stage>
  )
}

export function LintArt() {
  // Oxlint, ESLint and Biome run the same rules over the same files.
  const linters = [22, 82, 141]
  const wires = [37, 93, 149].flatMap((y) =>
    linters.map((from) => `M 56 ${from} C 106 ${from}, 120 ${y}, 150 ${y}`)
  )
  return (
    <Stage>
      <Scene width={320} height={186} wires={wires} dashed>
        <At x={11} y={12}>
          <Tile brand={SVGL.oxc} size={32} caption="Oxlint" />
        </At>
        <At x={11} y={44}>
          <Tile brand={SVGL.eslint} size={32} caption="ESLint" />
        </At>
        <At x={11} y={76}>
          <Tile brand={SVGL.biome} size={32} caption="Biome" />
        </At>
        <At x={66} y={20}>
          <Pill mono>
            <Tag tone="success" icon={Tick02Icon} />
            button.tsx
          </Pill>
        </At>
        <At x={66} y={50}>
          <Pill mono active>
            <Tag tone="danger">1</Tag>
            menu.tsx
          </Pill>
        </At>
        <At x={66} y={80}>
          <Pill mono>
            <Tag tone="success" icon={Tick02Icon} />
            card.tsx
          </Pill>
        </At>
      </Scene>
    </Stage>
  )
}

const ITEMS: {
  title: string
  status: "Works" | "Planned"
  accent: AccentName
  text: string
  href: string
  art: () => React.ReactNode
}[] = [
  {
    title: "The CLI",
    status: "Works",
    accent: "crater",
    text: "kirana build, check, export and trace: compile a tree, report every diagnostic (as GitHub annotations in CI), describe the design system, and ask which declaration wins a property and why.",
    href: "/docs/tooling/cli",
    art: CliArt,
  },
  {
    title: "Language models and agents",
    status: "Works",
    accent: "ochre",
    text: "Agent skills for writing Kirana and migrating to it, installed with npx skills add; llms.txt, llms-full.txt and a markdown twin of every page, with Copy page and Open in ChatGPT or Claude.",
    href: "/docs/project/llms",
    art: LlmArt,
  },
  {
    title: "Editors",
    status: "Works",
    accent: "crater",
    text: "kirana lsp with VS Code and Zed extensions: the CSS on hover, swatches, a summary after every sx, completion and diagnostics as you type.",
    href: "/docs/tooling/editor",
    art: EditorArt,
  },
  {
    title: "Lint",
    status: "Works",
    accent: "crater",
    text: "@kirana-style/eslint-plugin under Oxlint or ESLint with identical results, and @kirana-style/biome-plugin under Biome: the compiler's diagnostics and the overrides that silently lose.",
    href: "/docs/tooling/lint",
    art: LintArt,
  },
]

export function Connect() {
  return (
    <HomeSection
      eyebrow="Tooling"
      title="Connect Kirana to the rest of your tools"
      lede="The command line, language models, editors and lint — each one links to its documentation."
    >
      <div sx={styles.grid}>
        {ITEMS.map((item) => (
          <DocsLink
            key={item.title}
            href={item.href}
            sx={[accents[item.accent], styles.card]}
          >
            <div sx={styles.art}>
              <item.art />
            </div>
            <div sx={styles.copy}>
              <div sx={styles.titleRow}>
                <span sx={frame.cardTitle}>{item.title}</span>
                <span
                  sx={[
                    styles.status,
                    item.status === "Planned" ? styles.planned : null,
                  ]}
                >
                  {item.status}
                </span>
              </div>
              <p sx={[frame.cardText, styles.text]}>{item.text}</p>
            </div>
          </DocsLink>
        ))}
      </div>
    </HomeSection>
  )
}
