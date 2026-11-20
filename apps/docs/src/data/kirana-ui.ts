/**
 * Kirana UI's frameworks and where each one stands. The registry (`kirana-ui`) holds markup for each
 * framework on its own bases, every one over the same style modules. `/ui`, `/ecosystem` and the
 * homepage's components chapter read it.
 */
import { sentence } from "./facts.ts"

export type UiFramework = {
  name: string
  /** A key into the SVGL logos. */
  logo: "react" | "vue" | "svelte" | "solidjs" | "angular"
  /**
   * The unstyled libraries its markup is built on, in kirana-ui's order (`FRAMEWORK_BASES`), the
   * registry's default first.
   */
  bases: readonly string[]
  ready: boolean
}

export const UI_FRAMEWORKS: readonly UiFramework[] = [
  {
    name: "React",
    logo: "react",
    bases: ["Base UI", "React Aria", "ui-sdk", "Kirana UI Primitives"],
    ready: true,
  },
  {
    name: "Vue",
    logo: "vue",
    bases: ["Ark UI", "Reka UI", "ui-sdk", "Kirana UI Primitives"],
    ready: true,
  },
  {
    name: "Svelte",
    logo: "svelte",
    bases: ["Ark UI", "Bits UI", "ui-sdk", "Kirana UI Primitives"],
    ready: true,
  },
  {
    name: "Solid",
    logo: "solidjs",
    bases: ["Ark UI", "Kirana UI Primitives", "ui-sdk"],
    ready: true,
  },
  {
    name: "Angular",
    logo: "angular",
    bases: ["ng-primitives", "Kirana UI Primitives"],
    ready: true,
  },
]

const names = (ready: boolean) =>
  UI_FRAMEWORKS.filter((framework) => framework.ready === ready).map(
    (framework) => framework.name
  )

const pending = names(false)

/**
 * Where the frameworks stand, as a clause: "on React, Vue, … and Angular" once every one is out,
 * else "on React today; Vue, … are being ported".
 */
export const UI_STATUS =
  pending.length === 0
    ? `on ${sentence(names(true))}`
    : `on ${sentence(names(true))} today; ${sentence(pending)} are being ported`
