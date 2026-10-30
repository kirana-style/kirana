/**
 * How each package manager installs and runs a package, from one table: the page draws an install
 * block as tabs (`InstallTabs` in docs-ui) and the markdown twin writes it out (`plainInstall`).
 * `packages` and `dev` are installed; `run` fetches a package for one command
 * (`npx kirana-style@latest init`); `exec` runs one the project has installed. Deno takes `npm:`
 * specifiers and runs with every permission (`-A`), since the commands read and write the project.
 */
export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun", "deno"] as const

export type PackageManager = (typeof PACKAGE_MANAGERS)[number]

type Commands = {
  add: string
  dev: string
  /** Prefixes the package and its arguments; `npm:` joins without a space. */
  run: string
  exec: string
  /** Whether each package is written as an `npm:` specifier. */
  specifiers?: boolean
}

const COMMANDS: Record<PackageManager, Commands> = {
  npm: { add: "npm install", dev: "npm install -D", run: "npx ", exec: "npx " },
  pnpm: {
    add: "pnpm add",
    dev: "pnpm add -D",
    run: "pnpm dlx ",
    exec: "pnpm exec ",
  },
  yarn: {
    add: "yarn add",
    dev: "yarn add -D",
    run: "yarn dlx ",
    exec: "yarn ",
  },
  // `--bun` runs the command under Bun even when its file asks for Node.
  bun: { add: "bun add", dev: "bun add -d", run: "bunx --bun ", exec: "bunx " },
  deno: {
    add: "deno add",
    dev: "deno add -D",
    run: "deno run -A npm:",
    exec: "deno run -A npm:",
    specifiers: true,
  },
}

/** What an install block asks for; the attributes of `<!-- ::install … -->`. */
export type InstallRequest = {
  packages?: string
  dev?: string
  run?: string
  exec?: string
}

/** The lines a block shows for one package manager. */
export function installLines(
  manager: PackageManager,
  request: InstallRequest
): string[] {
  const commands = COMMANDS[manager]
  const names = (list: string) =>
    list
      .split(/\s+/)
      .filter(Boolean)
      .map((name) => (commands.specifiers ? `npm:${name}` : name))
      .join(" ")
  return [
    request.packages ? `${commands.add} ${names(request.packages)}` : "",
    request.dev ? `${commands.dev} ${names(request.dev)}` : "",
    request.run ? `${commands.run}${request.run}` : "",
    request.exec ? `${commands.exec}${request.exec}` : "",
  ].filter(Boolean)
}
