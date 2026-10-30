/**
 * Kirana's products beside the compiler: the one you can use with it today and the ones that are
 * planned. The roadmap shows them (`components/site/product-table.tsx`); the `/ecosystem` chapter
 * that shows them too is commented out. A product without `href` is not there to use yet, and the
 * table marks it "Planned".
 */
import {
  Book02Icon,
  ComponentIcon,
  ComputerIcon,
  Layout01Icon,
  Mail01Icon,
  Pdf01Icon,
  SmartPhone01Icon,
} from "@hugeicons/core-free-icons"

import type { SceneId } from "../brand/scenes.ts"
import { UI_SITE } from "./links.ts"

export type Product = {
  name: string
  description: string
  /** What the product table says about it; `code` spans are set as code. */
  note: string
  /** Where it lives; absent while it is planned. */
  href?: string
  icon: typeof ComponentIcon
  /** The scene its glyph takes its hue from. */
  scene: SceneId
  /** What it styles: web pages, or something else (mail, print, an app). */
  target: "web" | "beyond"
}

/** The products as a markdown table, for the roadmap's twin (`<!-- ::products -->`). */
export function productsMarkdown(): string {
  return [
    "| Product | Status | What it is |",
    "| --- | --- | --- |",
    ...PRODUCTS.map(
      (item) =>
        `| ${item.href ? `[${item.name}](${item.href})` : item.name} | ${item.href ? "Available" : "Planned"} | ${item.note} |`
    ),
  ].join("\n")
}

export const PRODUCTS: readonly Product[] = [
  {
    name: "Kirana UI",
    description: "Components to copy in, any framework",
    note: "A registry of components styled with Kirana, installed with `kirana-style ui add`",
    href: UI_SITE,
    icon: ComponentIcon,
    scene: "city-dusk",
    target: "web",
  },
  {
    name: "Kirana Docs",
    description: "The docs framework this site runs on",
    note: "Markdown pages built ahead of time on TanStack Start, with a twin of each page for agents",
    icon: Book02Icon,
    scene: "old-hall",
    target: "web",
  },
  {
    name: "Kirana Headless",
    description: "Unstyled, accessible parts to build on",
    note: "The behaviour of menus, dialogs and fields, with no styles of its own",
    icon: Layout01Icon,
    scene: "misty-hills",
    target: "web",
  },
  {
    name: "Kirana Email",
    description: "The same styles, for email clients",
    note: "Styles inlined and checked against what email clients support",
    icon: Mail01Icon,
    scene: "lighthouse-coast",
    target: "beyond",
  },
  {
    name: "Kirana PDF",
    description: "Styles for print and PDF",
    note: "Pages, margins and breaks written as typed styles",
    icon: Pdf01Icon,
    scene: "still-water",
    target: "beyond",
  },
  {
    name: "Kirana Native",
    description: "Typed styles for React Native",
    note: "The same `css()` handles, compiled to style objects for mobile apps",
    icon: SmartPhone01Icon,
    scene: "forest-falls",
    target: "beyond",
  },
  {
    name: "Kirana Desktop",
    description: "Desktop apps on Electron and Electrobun",
    note: "Templates and checked examples for desktop shells",
    icon: ComputerIcon,
    scene: "crater-lake",
    target: "beyond",
  },
]
