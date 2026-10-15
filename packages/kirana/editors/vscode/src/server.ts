/**
 * Finding the language server (D-064): the project's own `node_modules/.bin/kirana-style`, so the
 * editor runs the engine release the build does, searched upwards for a monorepo's hoisted install;
 * or the `kirana.server.path` setting. In each directory an older install's `kirana`, the command's
 * name before it was `kirana-style`, is the fallback.
 */
import path from "node:path"

export type ServerCommand = { command: string; args: string[] }

/**
 * The languages the server answers for: scripts, Vue, Svelte and Astro components, Angular templates,
 * and server templates.
 */
export const LANGUAGES = [
  "typescript",
  "typescriptreact",
  "javascript",
  "javascriptreact",
  "vue",
  "svelte",
  "astro",
  // Angular templates (D-068): the server compiles an `.html` file only when a component beside it
  // names it in `templateUrl`, and leaves every other one alone.
  "html",
  // Server templates (D-069): Blade (`blade`, or `php` without a Blade extension), ERB, Twig, HEEx
  // and Edge. The server reads only a template file's `kirana(…)` calls.
  "blade",
  "php",
  "erb",
  "twig",
  "phoenix-heex",
  "edge",
]

export function locateServer(
  folder: string | undefined,
  configured: string,
  platform: NodeJS.Platform,
  exists: (file: string) => boolean
): ServerCommand | undefined {
  if (configured) {
    const file = folder ? path.resolve(folder, configured) : configured
    // A script runs with Node, as `node_modules/.bin/kirana-style` itself does.
    return /\.[cm]?[jt]s$/.test(file)
      ? { command: "node", args: [file, "lsp"] }
      : { command: file, args: ["lsp"] }
  }
  if (!folder) return undefined
  const names = ["kirana-style", "kirana"].map((name) =>
    platform === "win32" ? `${name}.cmd` : name
  )
  let directory = folder
  for (;;) {
    const bin = path.join(directory, "node_modules", ".bin")
    const name = names.find((candidate) => exists(path.join(bin, candidate)))
    if (name) return { command: path.join(bin, name), args: ["lsp"] }
    const parent = path.dirname(directory)
    if (parent === directory) return undefined
    directory = parent
  }
}

/** What the server lets a client turn off or tune (its `initializationOptions`). */
export function initializationOptions(
  get: <T>(key: string, fallback: T) => T,
  theme: "light" | "dark"
) {
  return {
    summary: get("inlayHints.enabled", true),
    codeLens: get("codeLens.enabled", true),
    // VS Code renders `data:` images, trusted `command:` links and its safe HTML in hovers.
    images: get("hover.diagrams", true),
    commandLinks: true,
    html: true,
    summaryLength: get("inlayHints.maxLength", 100),
    theme,
    rootFontSize: get("rootFontSize", 16),
  }
}
