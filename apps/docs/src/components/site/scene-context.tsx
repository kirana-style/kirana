/**
 * The scene a page stands in, for the pieces that draw it without being told: the hero, the
 * footer. `Page` provides it; a route that builds its own frame passes `scene` to each piece.
 */
import { createContext, useContext } from "react"

import type { SceneId } from "@/brand/scenes"

const SceneContext = createContext<SceneId>("highlands")

export const SceneProvider = SceneContext.Provider

/** The page's scene: the master scene, highlands, outside a `Page`. */
export function useScene(): SceneId {
  return useContext(SceneContext)
}
