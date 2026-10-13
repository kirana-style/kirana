import { css } from "@kirana-style/core"
import { brand, space } from "@acme/scales"
import { gap } from "peer-kit"
import { width } from "plain"
import { missing } from "not-installed"
import * as again from "./reexports"

// An installed package that depends on @kirana-style/core folds like a workspace module.
export const folded = css({ padding: space[4], color: brand.ink, gap })

export function Box({ n }: { n: number }) {
  return (
    <div
      sx={css({
        // Any other installed package is a runtime value, as before.
        width,
        // Unresolved: reported once per import per module, then bridged.
        marginTop: missing,
        marginBottom: missing,
        marginLeft: again,
        height: `${n}px`,
      })}
    />
  )
}
