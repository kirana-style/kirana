/**
 * The Astro integration (KRN-INT-004): `@kirana-style/vite` for Astro's Vite, which compiles `.astro`
 * components as they are read (`design-notes/sfc-masking.md`), plus the one step Astro needs after
 * its build. Astro links each page's stylesheet — or inlines a small one — by the name and content it
 * recorded before the bundle was finished, so the Vite plugin fills the stylesheet in place, and once
 * Astro has written every page this integration renames the file by its real content and rewrites
 * every reference to it.
 */
import { readFile, readdir, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { renameAsset } from "@kirana-style/compiler/host"
import vite from "@kirana-style/vite"
import type { KiranaViteOptions } from "@kirana-style/vite"

export type KiranaAstroOptions = Omit<KiranaViteOptions, "renameStylesheet">

/** Files whose text can name the stylesheet: pages, server chunks, manifests, other stylesheets. */
const TEXT = /\.(?:html|m?js|json|css)$/

/** Every file under a directory. */
async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
}

/**
 * Renames each filled stylesheet in `outDir` by its content hash and replaces its old name in every
 * text file there. Returns the renames, old name to new.
 */
export async function renameStylesheets(
  outDir: string,
  filled: Iterable<string>
): Promise<Map<string, string>> {
  const all = await files(outDir)
  const renames = new Map<string, string>()
  for (const fileName of filled) {
    const base = path.posix.basename(fileName)
    for (const file of all.filter(
      (candidate) => path.basename(candidate) === base
    )) {
      const next = path.basename(
        renameAsset(base, await readFile(file, "utf8"))
      )
      if (next === base) continue
      await rename(file, path.join(path.dirname(file), next))
      renames.set(base, next)
    }
  }
  if (renames.size === 0) return renames
  for (const file of await files(outDir)) {
    if (!TEXT.test(file)) continue
    const text = await readFile(file, "utf8")
    let next = text
    for (const [from, to] of renames) next = next.replaceAll(from, to)
    if (next !== text) await writeFile(file, next)
  }
  return renames
}

type Hooks = {
  "astro:config:setup": (options: {
    updateConfig: (config: { vite: { plugins: unknown[] } }) => void
  }) => void
  "astro:config:done": (options: { config: { outDir: URL } }) => void
  "astro:build:done": () => Promise<void>
}

export default function kirana(options: KiranaAstroOptions = {}): {
  name: string
  hooks: Hooks
} {
  const plugins = vite({ ...options, renameStylesheet: false })
  const { filled } = plugins[0].api as { filled: Set<string> }
  let outDir = ""
  return {
    name: "@kirana-style/astro",
    hooks: {
      "astro:config:setup": ({ updateConfig }) =>
        updateConfig({ vite: { plugins } }),
      "astro:config:done": ({ config }) => {
        outDir = fileURLToPath(config.outDir)
      },
      "astro:build:done": async () => {
        await renameStylesheets(outDir, filled)
      },
    },
  }
}
