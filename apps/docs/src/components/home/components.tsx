/**
 * "Components": Kirana UI, for the reader whose first question about a new way of styling is what
 * happens to the components they build on. A door to `/ui`, in that page's hue.
 */
import { css } from "@kirana-style/core"

import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"

import { IllustratedCard } from "@/components/site/illustrated-card"
import { AddArt, UiFrameworks } from "@/components/site/kirana-ui"
import { SCENES } from "@/brand/scenes"
import { UI_PAGES } from "@/data/links"

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
      number="06"
      accent={SCENES["misty-hills"].hue}
      eyebrow="Components"
      title="The components are already here"
      lede="Moving to a new way of styling usually starts with porting the component library. Kirana UI is shadcn/ui's, already rebuilt on typed styles and compiled by Kirana, so the move starts with your own code."
    >
      <div sx={styles.layout}>
        <IllustratedCard
          wide
          art={<AddArt />}
          title="Kirana UI"
          href="/ui"
          text="The components and charts you know from shadcn/ui, with a style module you can read, installed into your project as code you own. A preset from the site sets the style, colours, fonts, radius and icons once."
          links={[
            { title: "What it is", href: "/ui" },
            { title: "Browse the components", href: UI_PAGES.components },
          ]}
        />
        <UiFrameworks />
      </div>
    </HomeSection>
  )
}
