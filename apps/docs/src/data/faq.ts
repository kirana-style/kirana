/**
 * The questions people ask before they try Kirana, grouped by topic. `/why` ends on them; every
 * answer is stated, with its source, on the page it links to.
 */
import { RUNTIME_SIZE } from "@/data/benchmarks"
import { LISTS, sentence } from "@/data/facts"

export const FAQ: readonly {
  topic: string
  items: readonly { q: string; a: string; href: string; link: string }[]
}[] = [
  {
    topic: "Getting started",
    items: [
      {
        q: "Can I install it from npm?",
        a: "Not yet. Kirana is a v0.1.0 pre-release. The packages are packed and install-tested on every change, and until they are published you install them from tarballs.",
        href: "/docs/start/installation",
        link: "Installation",
      },
      {
        q: "Which frameworks and bundlers does it support?",
        a: `${sentence(LISTS.frameworks)}, and plain class strings; server templates in ${sentence(LISTS.serverFrameworks)}; ${sentence(LISTS.bundlers)}, and Turbopack through Next.js. kirana init sets any of them up from a diff.`,
        href: "/docs/integrations/ecosystem",
        link: "Ecosystem and status",
      },
      {
        q: "Can I move an existing Tailwind or StyleX project?",
        a: "kirana migrate tailwind rewrites class strings, cn and cva; kirana migrate stylex maps create, defineVars and markers. Both print a diff and a report, and write nothing until you pass --write.",
        href: "/docs/migration/from-tailwind",
        link: "Migrating from Tailwind",
      },
    ],
  },
  {
    topic: "How it works",
    items: [
      {
        q: "Without a class list, how do I see what an element gets?",
        a: "Your editor shows it. The language server writes each element's CSS at the end of its line, coloured by kind, and a hover shows the box model, every declaration and the compiled rule, read from the same compiler session the build uses.",
        href: "/docs/tooling/editor",
        link: "Editor support",
      },
      {
        q: "Does anything run in the browser?",
        a: `Not for static styles: they compile to a stylesheet and class names. A value known only at runtime goes through a helper under ${RUNTIME_SIZE}, and only in the modules that have one.`,
        href: "/docs/styling/dynamic",
        link: "Dynamic styles",
      },
      {
        q: "How is dark mode done without a dark variant?",
        a: "Each colour is one light-dark() pair, so the browser picks the side from color-scheme. There is no second stylesheet and no class to toggle.",
        href: "/docs/tokens/themes-and-modes",
        link: "Themes and modes",
      },
      {
        q: "How does it differ from StyleX?",
        a: "The authoring model is close to one-to-one. Merging is per entry: a later style replaces the entries it names and keeps the rest, where StyleX replaced the whole property. Relations are declared, so the compiler checks both ends.",
        href: "/docs/migration/from-stylex",
        link: "Migrating from StyleX",
      },
    ],
  },
  {
    topic: "The project",
    items: [
      {
        q: "What licence is it under?",
        a: "MIT, for the compiler and every package. Sponsorship pays for maintenance; it does not buy features away from anyone.",
        href: "/sponsors",
        link: "Sponsors",
      },
      {
        q: "Can my AI tools read these docs?",
        a: "Yes: llms.txt, llms-full.txt and a markdown twin of every page, with Copy page and Open in ChatGPT or Claude on each. Two agent skills, installed with npx skills add, teach an agent to write Kirana and to migrate to it.",
        href: "/docs/project/llms",
        link: "Docs for language models",
      },
    ],
  },
]
