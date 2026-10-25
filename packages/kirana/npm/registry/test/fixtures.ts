/**
 * A project for `view` and `search`: `@acme` is a registry on disk with a full item and an index,
 * `@kirana` the local server, and any other registries a test adds.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import path from "node:path"

import { hashOf } from "../src/check.ts"
import { main } from "../src/index.ts"
import type { Options } from "../src/index.ts"
import type { Index, Item, RegistryFile } from "../src/types.ts"

const file = (
  where: string,
  type: RegistryFile["type"],
  content: string,
  target?: string
): RegistryFile => ({
  path: where,
  type,
  content,
  hash: hashOf(content),
  ...(target === undefined ? {} : { target }),
})

/** An item with every field `view` shows. */
export const BUTTON: Item = {
  name: "button",
  type: "component",
  version: "1.2.0",
  title: "Button",
  description: "Displays a button.",
  kirana: "^0.3.2",
  registryDependencies: ["@acme/spinner", "separator"],
  dependencies: { "@kirana-style/core": "^0.3.2" },
  axes: ["style", "radius"],
  styles: [file("button.styles.ts", "ui", "export {}")],
  frameworks: {
    react: {
      base: {
        files: [file("button.tsx", "ui", "base")],
        dependencies: { "@base-ui/react": "^1.0.0" },
      },
      aria: { files: [file("button.tsx", "ui", "aria")] },
    },
    vue: {
      ark: {
        files: [
          file("button/Button.vue", "ui", "vue"),
          file("button/index.ts", "ui", "index"),
        ],
      },
    },
  },
  files: [
    file("utils.ts", "lib", "utils"),
    file("globals.css", "file", "css", "app/globals.css"),
  ],
}

/** An item with only a description. */
export const NOTE: Item = {
  name: "note",
  type: "lib",
  version: "0.1.0",
  description: "A note.",
  files: [file("note.ts", "lib", "note")],
}

export const ACME_INDEX: Index = {
  name: "Acme",
  items: [
    {
      name: "button",
      type: "component",
      version: "1.2.0",
      title: "Button",
      description: "Displays a button.",
      frameworks: { react: ["base", "aria"], vue: ["ark"] },
    },
    { name: "note", type: "lib", version: "0.1.0", description: "A note." },
    {
      name: "login-01",
      type: "block",
      version: "0.10.0",
      title: "Login",
      description: "A simple login form.",
      frameworks: { react: ["base"] },
    },
  ],
}

/**
 * A project in `parent` whose `@acme` holds these documents on disk, with `@kirana` at `kirana` and
 * any other registries given.
 */
export function project(
  parent: string,
  kirana: string,
  registries: Record<string, unknown> = {},
  documents: Record<string, unknown> = {
    button: BUTTON,
    note: NOTE,
    index: ACME_INDEX,
  }
): string {
  const directory = mkdtempSync(path.join(parent, "project-"))
  mkdirSync(path.join(directory, "acme"))
  for (const [name, document] of Object.entries(documents))
    writeFileSync(
      path.join(directory, "acme", `${name}.json`),
      JSON.stringify(document)
    )
  writeFileSync(
    path.join(directory, "kirana.config.json"),
    JSON.stringify({
      ui: {
        registries: {
          "@kirana": kirana,
          "@acme": "acme/{name}.json",
          ...registries,
        },
      },
    })
  )
  return directory
}

/** `kirana-style ui <argv…>` in `cwd`: the exit code and everything written. */
export async function runIn(
  cwd: string,
  options: Options,
  ...argv: string[]
): Promise<{ code: number; text: string }> {
  let text = ""
  const code = await main(argv, cwd, (chunk) => void (text += chunk), options)
  return { code, text }
}
