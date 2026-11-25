/**
 * Kirana UI's frameworks, each on the unstyled libraries it is built on. The registry (`kirana-ui`) holds markup for each
 * framework on its own bases, every one over the same style modules. `/ui`, `/ecosystem` and the
 * homepage's components chapter read it.
 */
import { sentence } from "./facts.ts"
import { UI_PAGES } from "./links.ts"

export type UiFramework = {
  name: string
  /** A key into the SVGL logos. */
  logo: "react" | "vue" | "svelte" | "solidjs" | "angular"
  /**
   * The unstyled libraries its markup is built on, in kirana-ui's order (`FRAMEWORK_BASES`), the
   * registry's default first.
   */
  bases: readonly string[]
}

export const UI_FRAMEWORKS: readonly UiFramework[] = [
  {
    name: "React",
    logo: "react",
    bases: ["Base UI", "React Aria", "ui-sdk", "Kirana UI Primitives"],
  },
  {
    name: "Vue",
    logo: "vue",
    bases: ["Ark UI", "Reka UI", "ui-sdk", "Kirana UI Primitives"],
  },
  {
    name: "Svelte",
    logo: "svelte",
    bases: ["Ark UI", "Bits UI", "ui-sdk", "Kirana UI Primitives"],
  },
  {
    name: "Solid",
    logo: "solidjs",
    bases: ["Ark UI", "Kirana UI Primitives", "ui-sdk"],
  },
  {
    name: "Angular",
    logo: "angular",
    bases: ["ng-primitives", "Kirana UI Primitives"],
  },
]

/** The frameworks as a clause: "on React, Vue, Svelte, Solid and Angular". */
export const UI_ON = `on ${sentence(UI_FRAMEWORKS.map((framework) => framework.name))}`

/**
 * What an agent does with Kirana UI, as its own AI page puts it (`UI_PAGES.agents`): two released,
 * the third being built, and said so. `/ui`'s agents chapter reads it.
 */
export const UI_AGENTS = [
  {
    kicker: "Build",
    title: "Your agent sets it up",
    text: "A prompt copied from the site runs one command, installs the agent skills and adds a first component. A wrong value does not ship: Kirana's compiler answers with a code, the line and the fix, as JSON the agent reads.",
    links: [
      { title: "Agents build with it", href: UI_PAGES.agentsBuild },
      { title: "Kirana's agent skills", href: "/docs/project/agent-skills" },
    ],
  },
  {
    kicker: "Drive",
    title: "It uses the page you built",
    text: "The agent bridge reads each control by its role and asks it to act. Your policy decides what the agent may do, a person answers where you ask for one, and a secret is never read back.",
    links: [{ title: "The agent bridge", href: UI_PAGES.agentBridge }],
  },
  {
    kicker: "Compose",
    title: "It answers with your components",
    text: "An agent answers with an interface made of the components your project already has, never with generated code. It is being built, on the registry that serves every component today.",
    links: [{ title: "Where it stands", href: UI_PAGES.generativeUi }],
  },
] as const
