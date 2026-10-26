/**
 * The frame every picture card on the site shares: the card is a bordered, rounded sheet, and its
 * picture sits inside it, inset and rounded on its own, with a hairline of its own. The picture's
 * corners are the card's less the inset, so the two curves stay concentric and the gap between them
 * is even all the way round.
 *
 * `IllustratedCard`, the tools grid on `/compiler` and the showcase are drawn with it. The text
 * under a picture keeps its own padding, on top of the card's inset.
 */
import { css } from "@kirana-style/core"

import { radius, theme } from "@workspace/ui/theme/semantic"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import { LIFT, REST } from "@workspace/ui/recipes/lift"

/** The gap between a card's edge and its picture. */
const INSET = spacing[2]

export const framed = {
  /** The sheet: the picture above, the words below. */
  card: css({
    display: "grid",
    gridTemplateRows: "auto 1fr",
    overflow: "hidden",
    padding: INSET,
    borderRadius: radius["3xl"],
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    boxShadow: { base: REST, ":hover": LIFT },
    backgroundColor: theme.card,
    transitionProperty: "box-shadow",
    transitionDuration: duration[200],
  }),
  /**
   * Just the inset and the corner, for a card that already has its border and ground from elsewhere
   * (the brand page's, which sit on `sectionStyles.bordered`).
   */
  inset: css({
    overflow: "hidden",
    padding: INSET,
    borderRadius: radius["3xl"],
  }),
  /** The picture: rounded concentrically with the card, on a hairline of its own. */
  picture: css({
    overflow: "hidden",
    borderRadius: `calc(${radius["3xl"]} - ${INSET})`,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.background,
  }),
}
