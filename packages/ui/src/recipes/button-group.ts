/**
 * ButtonGroup, and the shared styles its children use to join up. The group
 * carries a relation and each child applies `groupedItem`, which reads its own
 * position to decide which corners to keep, rather than the group reaching into
 * its children.
 */

import { css } from "@kirana-style/core"

import { recipe } from "./recipe"
import { buttonGroupMarker } from "../theme/button-group-marker"
import { radius } from "../theme/semantic"
import { spacing } from "../tokens/spacing"

/**
 * The last real control in the group — "no `data-slot` sibling after me".
 *
 * Not `:last-child`: Base UI appends focus-guard `<span>`s inside the group while
 * a menu is open, so a dropdown trigger stops being the last child and its
 * rounded outer edge vanishes the moment you click it. Every control the group
 * styles carries `data-slot` and the guards do not, so this ignores them.
 */
const LAST_CONTROL = ":not(:has(~ [data-slot]))"

const styles = {
  base: css({
    display: "flex",
    width: "fit-content",
    alignItems: "stretch",
    // Nested groups stay separated.
    gap: {
      base: 0,
      ':has(> [data-slot="button-group"])': spacing[2],
    },
  }),
  horizontal: css({ flexDirection: "row" }),
  vertical: css({ flexDirection: "column" }),

  /**
   * Applied by each child of a group. Only the outer corners of the strip stay
   * round, and every child but the first drops its leading edge so neighbours
   * share one border line.
   *
   * Which corners count as "outer" depends on the axis: in a row the first child
   * owns both start corners, in a column it owns both top corners. A row is
   * anything not marked vertical: a default ButtonGroup writes no
   * `data-orientation` at all.
   */
  item: css({
    borderStartStartRadius: {
      [buttonGroupMarker.within(':not([data-orientation="vertical"])')]: {
        base: 0,
        ":first-child": radius.lg,
      },
      [buttonGroupMarker.within('[data-orientation="vertical"]')]: {
        base: 0,
        ":first-child": radius.lg,
      },
    },
    borderStartEndRadius: {
      [buttonGroupMarker.within(':not([data-orientation="vertical"])')]: {
        base: 0,
        [LAST_CONTROL]: radius.lg,
      },
      [buttonGroupMarker.within('[data-orientation="vertical"]')]: {
        base: 0,
        ":first-child": radius.lg,
      },
    },
    borderEndStartRadius: {
      [buttonGroupMarker.within(':not([data-orientation="vertical"])')]: {
        base: 0,
        ":first-child": radius.lg,
      },
      [buttonGroupMarker.within('[data-orientation="vertical"]')]: {
        base: 0,
        [LAST_CONTROL]: radius.lg,
      },
    },
    borderEndEndRadius: {
      [buttonGroupMarker.within(':not([data-orientation="vertical"])')]: {
        base: 0,
        [LAST_CONTROL]: radius.lg,
      },
      [buttonGroupMarker.within('[data-orientation="vertical"]')]: {
        base: 0,
        [LAST_CONTROL]: radius.lg,
      },
    },
    borderInlineStartWidth: {
      [buttonGroupMarker.within(':not([data-orientation="vertical"])')]: {
        base: 0,
        ":first-child": "1px",
      },
    },
    borderTopWidth: {
      [buttonGroupMarker.within('[data-orientation="vertical"]')]: {
        base: 0,
        ":first-child": "1px",
      },
    },

    // A focused child lifts above its neighbours so its ring is not clipped.
    // Only inside a group. `groupedItem` is applied to every Button and Input,
    // so an unconditional rule would lift every focused control in the app.
    position: {
      [buttonGroupMarker.within('[data-slot="button-group"]')]: {
        ":focus-visible": "relative",
      },
    },
    zIndex: {
      [buttonGroupMarker.within('[data-slot="button-group"]')]: {
        ":focus-visible": 10,
      },
    },
  }),

  /** For a child that should absorb the group's spare width, such as an input. */
  fill: css({
    // `flex-1` is `1 1 0%`: with a zero basis the input stops claiming its full
    // width up front, so a fit-content group sizes to its other children.
    flexGrow: {
      [buttonGroupMarker.within(':not([data-orientation="vertical"])')]: 1,
    },
    flexBasis: {
      [buttonGroupMarker.within(':not([data-orientation="vertical"])')]: "0%",
    },
  }),
}

export const buttonGroup = recipe({
  base: styles.base,
  variants: {
    orientation: { horizontal: styles.horizontal, vertical: styles.vertical },
  },
  defaults: { orientation: "horizontal" },
})

export const groupedItem = styles.item
export const groupedFill = styles.fill
