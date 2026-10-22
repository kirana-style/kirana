/**
 * The tooling pages' pickers: `<!-- ::editors -->`, `<!-- ::linters -->` and
 * `<!-- ::lint-rules -->`. Their markdown twins come from `src/data/tooling.ts`.
 */
import { css } from "@kirana-style/core"
import { CommandLineIcon } from "@hugeicons/core-free-icons"

import { accent, accents, tint } from "@workspace/docs-ui/accent.ts"
import type { SvglIcon } from "@workspace/docs-ui/brand-icon.tsx"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { EDITORS, LINTERS, LINT_RULES } from "@/data/tooling"
import type { ToolChoice } from "@/data/tooling"
import { SVGL } from "@/generated/svgl-icons.gen"
import { LIFT, REST } from "@workspace/ui/recipes/lift"

import { ChoiceGrid } from "./choice-grid"

const logo = (choice: ToolChoice) =>
  choice.logo ? (SVGL as Record<string, SvglIcon>)[choice.logo] : undefined

export function EditorGrid() {
  return (
    <ChoiceGrid
      slot="editor-grid"
      choices={EDITORS.map((choice) => ({
        ...choice,
        logo: logo(choice),
        icon: CommandLineIcon,
      }))}
    />
  )
}

export function LinterGrid() {
  return (
    <ChoiceGrid
      slot="linter-grid"
      columns={2}
      choices={LINTERS.map((choice) => ({ ...choice, logo: logo(choice) }))}
    />
  )
}

const styles = {
  rules: css({
    display: "grid",
    gap: spacing[2],
    marginBlockEnd: spacing[6],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  rule: css({
    display: "grid",
    alignContent: "start",
    gap: spacing[2],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    boxShadow: { base: REST, ":hover": LIFT },
    backgroundColor: theme.card,
    textDecorationLine: "none",
    color: theme.foreground,
    transitionProperty: "box-shadow, border-color, background-color",
    transitionDuration: duration[150],
  }),
  name: css({
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.semibold,
    color: accent.base,
  }),
  catches: css({ fontSize: fontSize.sm, lineHeight: lineHeight.sm }),
  badges: css({ display: "flex", flexWrap: "wrap", gap: spacing["1.5"] }),
  badge: css({
    paddingInline: spacing[2],
    borderRadius: radius.full,
    backgroundColor: tint(12),
    color: accent.base,
    fontSize: "0.6875rem",
    lineHeight: "1.25rem",
    fontWeight: fontWeight.medium,
  }),
  muted: css({ backgroundColor: theme.muted, color: theme.mutedForeground }),
}

export function LintRuleGrid() {
  return (
    <div sx={styles.rules} data-slot="lint-rule-grid">
      {LINT_RULES.map((rule) => (
        <DocsLink
          key={rule.name}
          href={`/docs/tooling/lint#${rule.name}`}
          sx={[
            accents[rule.config === "recommended" ? "crater" : "neutral"],
            styles.rule,
          ]}
        >
          <span sx={styles.name}>kirana/{rule.name}</span>
          <span sx={styles.catches}>{rule.catches}</span>
          <span sx={styles.badges}>
            <span sx={styles.badge}>
              {rule.config === "off" ? "opt-in" : rule.config}
            </span>
            {rule.fix ? (
              <span sx={[styles.badge, styles.muted]}>{rule.fix}</span>
            ) : null}
            {rule.biome ? (
              <span sx={[styles.badge, styles.muted]}>Biome</span>
            ) : null}
          </span>
        </DocsLink>
      ))}
    </div>
  )
}
