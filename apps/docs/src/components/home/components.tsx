/**
 * "Components": Kirana's family, for the reader whose first question about a new way of styling is
 * what happens to the components they build on. Kirana UI and Kirana UI Primitives, each with its
 * own line, then the frameworks and headless libraries Kirana UI has markup for. A door to `/ui`,
 * in that page's hue.
 */
import { css } from "@kirana-style/core"

import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"

import { FamilyCards } from "@/components/site/family"
import { UiFrameworks } from "@/components/site/kirana-ui"
import { SCENES } from "@/brand/scenes"

import { HomeSection } from "./frame"

const styles = {
  layout: css({
    display: "grid",
    gap: { base: spacing[8], [breakpoint.md]: spacing[10] },
  }),
}

export function Components() {
  return (
    <HomeSection
      number="07"
      accent={SCENES["misty-hills"].hue}
      eyebrow="Components"
      title="The components are already here"
      lede="Kirana UI is shadcn/ui's design system on your framework and the headless library you already use, every style compiled by Kirana. Kirana UI Primitives are the family's own headless parts, a library of their own beside it."
    >
      <div sx={styles.layout}>
        <FamilyCards />
        <UiFrameworks />
      </div>
    </HomeSection>
  )
}
