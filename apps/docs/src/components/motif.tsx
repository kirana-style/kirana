import { css } from "@kirana-style/core"

import type { Sx } from "@workspace/ui/lib/sx"
import { alpha } from "@workspace/ui/theme/semantic"

/**
 * The site's background texture: four petals around a point, repeated. It is a
 * mask over a theme colour, so it follows the colour scheme, and it fades out
 * towards the bottom so it never sits behind body text at full strength.
 */
const TILE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cg fill='none' stroke='%23000' stroke-width='1'%3E%3Cellipse cx='12' cy='12' rx='10.5' ry='5' transform='rotate(45 12 12)'/%3E%3Cellipse cx='36' cy='12' rx='10.5' ry='5' transform='rotate(-45 36 12)'/%3E%3Cellipse cx='12' cy='36' rx='10.5' ry='5' transform='rotate(-45 12 36)'/%3E%3Cellipse cx='36' cy='36' rx='10.5' ry='5' transform='rotate(45 36 36)'/%3E%3C/g%3E%3Ccircle cx='24' cy='24' r='1.5' fill='%23000'/%3E%3Ccircle cx='0' cy='0' r='1.5' fill='%23000'/%3E%3Ccircle cx='48' cy='0' r='1.5' fill='%23000'/%3E%3Ccircle cx='0' cy='48' r='1.5' fill='%23000'/%3E%3Ccircle cx='48' cy='48' r='1.5' fill='%23000'/%3E%3C/svg%3E")`

const styles = {
  root: css({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundColor: alpha.foreground10,
    maskImage: `${TILE}, linear-gradient(to bottom, black, transparent 85%)`,
    maskSize: "48px 48px, 100% 100%",
    maskRepeat: "repeat, no-repeat",
    maskComposite: "intersect",
  }),
}

/** Decoration only: place it first inside a `position: relative` container. */
export function Motif({ sx }: { sx?: Sx }) {
  return <div aria-hidden="true" data-slot="motif" sx={[styles.root, sx]} />
}
