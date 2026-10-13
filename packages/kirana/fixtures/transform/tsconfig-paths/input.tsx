// A tsconfig `paths` alias resolves like a relative import: the value folds into the class, with
// no unresolved-import warning.
import { space } from "@/tokens/space"
import { css } from "@kirana-style/core"

export const padded = css({ padding: space[4] })
