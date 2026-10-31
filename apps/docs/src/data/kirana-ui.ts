/**
 * Kirana UI's frameworks and where each one stands. The registry (`kirana-ui`) holds markup for each
 * framework on its own bases; React's is out, the others are being ported. `/ui`, `/ecosystem` and
 * the homepage's components chapter read it.
 */
import { sentence } from "./facts.ts"

export type UiFramework = {
  name: string
  /** A key into the SVGL logos. */
  logo: "react" | "vue" | "svelte" | "solidjs" | "angular"
  /** The unstyled libraries its markup is built on. */
  bases: string
  ready: boolean
}

export const UI_FRAMEWORKS: readonly UiFramework[] = [
  { name: "React", logo: "react", bases: "Base UI, React Aria", ready: true },
  { name: "Vue", logo: "vue", bases: "Ark UI", ready: false },
  { name: "Svelte", logo: "svelte", bases: "Ark UI", ready: false },
  { name: "Solid", logo: "solidjs", bases: "Ark UI", ready: false },
  { name: "Angular", logo: "angular", bases: "Angular", ready: false },
]

const names = (ready: boolean) =>
  UI_FRAMEWORKS.filter((framework) => framework.ready === ready).map(
    (framework) => framework.name
  )

/** Where the frameworks stand, as a sentence: "React today; Vue, … and Angular are being ported". */
export const UI_STATUS = `${sentence(names(true))} today; ${sentence(names(false))} are being ported`
