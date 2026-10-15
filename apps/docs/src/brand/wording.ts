/**
 * Wording under review: headlines, descriptions and one line against each alternative. Every claim
 * points at the page that backs it, so none says more than the docs and the measurements do.
 * Numbers are advisory (one machine; `packages/kirana/design-notes/benchmark-results.md`).
 */

import { DIAGNOSTICS } from "@/generated/diagnostics.gen"
import { LISTS, sentence } from "@/data/facts"

export type Line = {
  text: string
  /** The voice it is written in. */
  tone: string
  /** What it sells, and where that is shown. */
  proof: string
  href: string
}

export const HEADLINES: Line[] = [
  {
    text: "A typo is a compile error, not a bug report.",
    tone: "Bold",
    proof: `Typed tokens and ${DIAGNOSTICS.length} diagnostics from the compiler itself.`,
    href: "/docs/tooling/diagnostics",
  },
  {
    text: "Styles that merge. Never collide.",
    tone: "Calm",
    proof:
      "Merging per longhand on one precedence ladder: no cn(), no merge library.",
    href: "/docs/styling/merging",
  },
  {
    text: "Tailwind's build speed. TypeScript's safety.",
    tone: "Competitive",
    proof:
      "Within 3 % of Tailwind's build time, 2.9× faster than the StyleX port, on this repository's three apps.",
    href: "/blog/what-we-measured",
  },
  {
    text: "CSS-in-JS, with a Rust engine of its own.",
    tone: "Technical",
    proof:
      "Kirana's compiler is written in Rust on oxc, not a port of a Babel plugin, with a WASI build that writes the same bytes.",
    href: "/docs/start/why-kirana",
  },
  {
    text: "Write objects. Read classes. Ship CSS.",
    tone: "Rhythmic",
    proof:
      "The editor writes each element's class list at the end of its line; the build writes one atomic stylesheet.",
    href: "/docs/tooling/editor",
  },
  {
    text: "Light through every line of your styles.",
    tone: "Brand",
    proof:
      "Kirana means a ray of light: the editor shows what each line ends up with, and kirana trace shows why.",
    href: "/docs/tooling/debugging",
  },
]

export const DESCRIPTIONS: Line[] = [
  {
    text: "Kirana compiles typed style objects into one small, atomic stylesheet with an engine written in Rust. A typo or a selector that can never match is a compile error; styles merge per property instead of colliding; and your editor shows every element's CSS at the end of its line.",
    tone: "The whole case",
    proof: "Types, merging, editor and the Rust engine, in one paragraph.",
    href: "/docs/start/why-kirana",
  },
  {
    text: "No class collisions, no cn(), no merge library. Styles merge per property on one precedence ladder you can trace, and a parent styles its children without overriding their own styles.",
    tone: "For Tailwind users",
    proof:
      "Merging per longhand; select.child and select.descendant sit in a layer below the child's own styles.",
    href: "/docs/styling/contextual",
  },
  {
    text: `Everything people liked about StyleX (atomic output, styles as values, one prop) on a compiler of its own in Rust, with ${DIAGNOSTICS.length} diagnostics, descendant selectors, and Tailwind's scales when you want them.`,
    tone: "For StyleX users",
    proof: "The StyleX port's problems, each answered, in Why Kirana.",
    href: "/docs/start/why-kirana",
  },
  {
    text: `One way to style ${sentence(LISTS.libraries)}, and ${sentence(LISTS.serverFrameworks)} templates, compiled by one engine into plain CSS.`,
    tone: "Reach",
    proof: `Adapters for ${sentence(LISTS.bundlers)}; helpers for server templates.`,
    href: "/docs/frameworks/overview",
  },
]

/** One line against each alternative: what Kirana does that it does not. */
export const AGAINST: { name: string; text: string }[] = [
  {
    name: "Tailwind CSS",
    text: "Typed tokens instead of strings, and no collisions between a component's classes and its parent's.",
  },
  {
    name: "StyleX",
    text: "An engine of its own in Rust, where StyleX's Rust compiler is a community port behind the official Babel one, and descendant selectors that are declared and checked.",
  },
  {
    name: "Runtime CSS-in-JS",
    text: "Nothing is generated in the browser: the CSS is a file, written at build time.",
  },
  {
    name: "Any preset system",
    text: "No opinions shipped by default: Tailwind's scales are a preset you add, and utility strings compile to the same atoms as objects.",
  },
]

/** How Kirana speaks. */
export const VOICE: { title: string; text: string }[] = [
  {
    title: "Measured",
    text: "Every claim has a number or a page behind it, and the number says how it was measured.",
  },
  {
    title: "Plain",
    text: "Short words, one idea a sentence. A compiler that explains itself, in a voice that does too.",
  },
  {
    title: "Warm",
    text: "A ray of light, not a weapon: name what others got right before what Kirana adds.",
  },
]

/**
 * Improved lines, built from the ones chosen above: "Write objects. Read classes. Ship CSS." with
 * "Light through every line" — what the editor gives that no other styling tool does — and the
 * whole case, with the Rust engine, the speed, starting small and the frameworks.
 */
export const IMPROVED_HEADLINES: Line[] = [
  {
    text: "Write objects. Read classes. Ship CSS.\nLight through every line of your styles.",
    tone: "05 + 06, as a pair",
    proof:
      "The rhythm as the headline, the name's meaning as the line under it.",
    href: "/docs/tooling/editor",
  },
  {
    text: "Write objects. Read classes on every line.",
    tone: "The editor, first",
    proof:
      "The language server writes each element's CSS at the end of its line, in a class list's words.",
    href: "/docs/tooling/editor",
  },
  {
    text: "Every line of your styles, in plain sight.",
    tone: "Light, said plainly",
    proof:
      "The inline summary on each line, the card on hover, and kirana trace for which entry wins and why.",
    href: "/docs/tooling/debugging",
  },
  {
    text: "Typed like objects. Read like classes. Shipped as CSS.",
    tone: "Three verbs",
    proof:
      "Types at the source, the class list in the editor, one atomic stylesheet in the build.",
    href: "/docs/start/how-it-works",
  },
]

export const IMPROVED_DESCRIPTIONS: Line[] = [
  {
    text: "CSS-in-JS with a Rust engine of its own. Kirana compiles typed style objects into one small, atomic stylesheet at native speed. Start with plain objects and no preset; add tokens, themes and ready-made scales when your design system grows. A typo or a selector that can never match is a compile error, styles merge per property instead of colliding, and your editor shows every element's CSS at the end of its line, across the frameworks, bundlers and editors you already use.",
    tone: "The whole case, complete",
    proof:
      "Engine, speed, starting small, safety, merging, the editor and the ecosystem.",
    href: "/docs/start/why-kirana",
  },
  {
    text: "CSS-in-JS with a Rust engine of its own. Start with plain style objects and grow into tokens and themes; Kirana compiles them into one atomic stylesheet at native speed, turns mistakes into compile errors, and shows every element's CSS on its line in your editor.",
    tone: "Hero length",
    proof: "The same case in two sentences, for under the headline.",
    href: "/docs/start/why-kirana",
  },
  {
    text: "Minimal to start, scalable when you grow: no preset and no rules to learn first. Plain objects work on day one; tokens, themes, recipes and ready-made scales are there when the system needs them.",
    tone: "Unopinionated",
    proof:
      "Tokens, themes and modes, recipes, and an optional preset of scales.",
    href: "/docs/tokens/overview",
  },
  {
    text: "One engine for the whole ecosystem: component frameworks and server templates, every major bundler, and any editor that speaks the Language Server Protocol.",
    tone: "Ecosystem",
    proof:
      "A guide per framework, each tested on every change; the language server in any LSP editor.",
    href: "/docs/frameworks/overview",
  },
]
