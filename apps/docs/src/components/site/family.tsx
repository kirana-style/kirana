/**
 * Kirana's family on this site: Kirana UI (built with Kirana) and Kirana UI Primitives (a headless
 * library of its own beside it), each with its own line and where it lives. The homepage's
 * components chapter and `/ecosystem` show it.
 */
import { css } from "@kirana-style/core"
import { Layout01Icon } from "@hugeicons/core-free-icons"

import type { SvglIcon } from "@workspace/docs-ui/brand-icon.tsx"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"

import { SCENES } from "@/brand/scenes"
import { IllustratedCard } from "@/components/site/illustrated-card"
import { AddArt } from "@/components/site/kirana-ui"
import { At, Scene, Tile } from "@/components/site/visuals"
import { UI_FRAMEWORKS, UI_ON } from "@/data/kirana-ui"
import { UI_PAGES } from "@/data/links"
import { SVGL } from "@/generated/svgl-icons.gen"

const family = {
  grid: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(2, minmax(0, 1fr))",
    },
  }),
}

/** The primitives: one library of parts, an adapter per framework. */
export function PrimitivesArt() {
  const logos = UI_FRAMEWORKS.map(
    (framework) => (SVGL as Record<string, SvglIcon>)[framework.logo]!
  )
  const xs = logos.map((_, index) => 30 + index * 60)
  return (
    <Scene
      width={300}
      height={170}
      wires={xs.map((x) => `M ${x} 112 C ${x} 90, 150 96, 150 74`)}
    >
      <At x={50} y={30}>
        <Tile icon={Layout01Icon} size={46} variant="accent" caption="parts" />
      </At>
      {logos.map((logo, index) => (
        <At key={logo.title} x={(xs[index]! / 300) * 100} y={76}>
          <Tile brand={logo} size={34} />
        </At>
      ))}
    </Scene>
  )
}

/**
 * The family beside the compiler, each product with its own line and where it lives: Kirana UI,
 * which is built with Kirana, and Kirana UI Primitives, a headless library of its own beside it,
 * which Kirana UI uses as one of its bases.
 */
export function FamilyCards() {
  const ui = SCENES["misty-hills"].hue
  return (
    <div sx={family.grid}>
      <IllustratedCard
        tone={ui}
        art={<AddArt />}
        title="Kirana UI"
        note="the components"
        href="/ui"
        text={`shadcn/ui's design system, on your framework and your headless library: its components, blocks and charts ${UI_ON}, each with a style module Kirana compiles, installed as code you own.`}
        links={[
          { title: "What it is", href: "/ui" },
          { title: "Browse the components", href: UI_PAGES.components },
        ]}
      />
      <IllustratedCard
        tone={ui}
        art={<PrimitivesArt />}
        title="Kirana UI Primitives"
        note="headless"
        href={UI_PAGES.primitives}
        text="Headless parts that are the same on every framework, checked state by state. A library of their own, not built on Kirana: style them with Kirana, CSS Modules or Tailwind. Kirana UI uses them as one of its bases, and @kirana-style/states types their states."
        links={[{ title: "The primitives' docs", href: UI_PAGES.primitives }]}
      />
    </div>
  )
}
