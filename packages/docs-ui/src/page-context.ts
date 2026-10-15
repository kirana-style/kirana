/**
 * The docs page being rendered, for the markdown parts that read it: the title shows the page's
 * `description` under it as the lede. Outside a docs page (a blog post) there is none.
 */
import { createContext } from "react"

import type { PageMeta } from "@workspace/docs-core/types.ts"

export const PageContext = createContext<PageMeta | undefined>(undefined)
