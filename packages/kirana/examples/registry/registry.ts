/**
 * The registry the examples runner installs from with `--registry` (KRN-DX-028, KRN-DX-029,
 * KRN-DX-032): a design system with its wiring and one axis, `tone`, and a button that draws an icon,
 * flattened for each tone (D-110), in Kirana's format, written from the sources beside this file
 * with their hashes. Its values are ones no default produces, so the runner can tell, in the
 * browser, that `ui init`, `ui add` and `ui preset` put everything in place.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { hashOf } from "../../npm/registry/src/check.ts"

const file = (source: string, type: string, where: string) => {
  const content = readFileSync(path.join(import.meta.dirname, source), "utf8")
  return { path: where, type, content, hash: hashOf(content) }
}

/** Writes `kit.json`, `button.json` and `index.json` into `directory`. */
export function writeRegistry(directory: string): void {
  const kit = {
    name: "kit",
    type: "design-system",
    version: "1.0.0",
    files: [
      file("kit/config.ts", "lib", "kit/config.ts"),
      file("kit/document.ts", "lib", "kit/document.ts"),
      file("kit/reset.css", "ui", "reset.css"),
    ],
    design: {
      axes: { tone: { attribute: "data-tone", values: ["plain", "bold"] } },
      flatten: "tone",
      presets: { k: [{ axis: "tone", values: ["plain", "bold"], bits: 1 }] },
    },
    setup: {
      config: { module: "@/registry/lib/kit/config", export: "kitConfig" },
      stylesheets: ["@/registry/ui/reset.css"],
      document: { module: "@/registry/lib/kit/document", export: "htmlStyles" },
    },
  }
  const button = {
    name: "button",
    type: "component",
    version: "1.0.0",
    registryDependencies: ["kit"],
    styles: [file("button/button.styles.ts", "ui", "button.styles.ts")],
    flattened: {
      axis: "tone",
      builds: {
        plain: {
          base: [file("button/button.styles.ts", "ui", "button.styles.ts")],
        },
        bold: {
          base: [file("button/bold.styles.ts", "ui", "button.styles.ts")],
        },
      },
    },
    frameworks: {
      react: {
        base: { files: [file("button/button.tsx", "ui", "button.tsx")] },
      },
    },
  }
  const index = {
    name: "Kirana's fixture",
    items: [kit, button].map(({ name, type, version }) => ({
      name,
      type,
      version,
    })),
  }
  mkdirSync(directory, { recursive: true })
  for (const [name, document] of Object.entries({ kit, button, index }))
    writeFileSync(
      path.join(directory, `${name}.json`),
      `${JSON.stringify(document, null, 2)}\n`
    )
}
