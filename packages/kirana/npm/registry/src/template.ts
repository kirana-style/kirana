/**
 * `kirana-style ui init --template <name> [directory]` (KRN-DX-029, D-111): a new project, from one
 * of Kirana's examples (the ones its CI installs and builds, as the release being run has them), a
 * registry's template (`@acme/vite-react--turbo`, listed in the registry's `templates/index.json`),
 * or a template's archive by URL. An archive is read once, as `giget` reads one (no clone); a
 * template's then names its package manager where it asks, is installed, and says which folder
 * `init` goes on in.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { gunzipSync } from "node:zlib"

import { runOf } from "./add.ts"
import type { Options } from "./command.ts"
import {
  DEFAULT_TIMEOUT,
  expandHeaders,
  fetchBytes,
  fetchJson,
  locate,
  parseReference,
  registryOf,
  RegistryError,
} from "./read.ts"
import type { Io } from "./read.ts"
import {
  TEMPLATE_MANAGERS,
  TEMPLATE_REFERENCE_PATTERN,
  TEMPLATES_SCHEMA,
} from "./schema.ts"
import { loadSettings } from "./settings.ts"
import type { Templates } from "./types.ts"
import { validate } from "./validate.ts"
import { version as release } from "./version.ts"

/** Kirana's source at a release, as GitHub serves a tag. */
export const SOURCE =
  "https://codeload.github.com/kirana-style/kirana/tar.gz/refs/tags/v{version}"

const EXAMPLES = "packages/kirana/examples/"

/** Every file in a tar archive, by its path; pax headers give the long paths GitHub writes. */
export function untar(archive: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>()
  const text = (from: number, length: number) =>
    new TextDecoder()
      .decode(archive.subarray(from, from + length))
      .replace(/\0.*$/s, "")
  let longPath: string | undefined
  for (let at = 0; at + 512 <= archive.length;) {
    const name = text(at, 100)
    if (name === "") break
    const size = Number.parseInt(text(at + 124, 12).trim(), 8)
    const type = text(at + 156, 1)
    const prefix = text(at + 345, 155)
    const body = archive.subarray(at + 512, at + 512 + size)
    if (type === "x") {
      // "<length> path=<value>\n" records; only the path is read.
      longPath = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(
        new TextDecoder().decode(body)
      )?.[1]
    } else {
      if (type === "0" || type === "")
        files.set(longPath ?? (prefix ? `${prefix}/${name}` : name), body)
      longPath = undefined
    }
    at += 512 + Math.ceil(size / 512) * 512
  }
  return files
}

/** The example's files, from the release's source archive, by their path in the example. */
export async function fetchExample(
  example: string,
  version: string,
  io: Io = {}
): Promise<Map<string, Uint8Array>> {
  const url = SOURCE.replace("{version}", version)
  let response: Response
  try {
    response = await (io.fetch ?? fetch)(url, {
      signal: AbortSignal.timeout((io.timeout ?? DEFAULT_TIMEOUT) * 4),
    })
  } catch (error) {
    throw new RegistryError(
      `${url}: could not be fetched: ${(error as Error).message}`
    )
  }
  if (!response.ok)
    throw new RegistryError(`${url}: answered ${response.status}`)
  const archive = untar(
    gunzipSync(new Uint8Array(await response.arrayBuffer()))
  )
  const found = new Map<string, Uint8Array>()
  for (const [name, body] of archive) {
    // GitHub roots the archive in `<repository>-<tag>/`.
    const inside = name.slice(name.indexOf("/") + 1)
    if (inside.startsWith(`${EXAMPLES}${example}/`))
      found.set(inside.slice(`${EXAMPLES}${example}/`.length), body)
  }
  if (found.size === 0)
    throw new RegistryError(
      `${example} is not one of Kirana ${version}'s examples (${EXAMPLES} in its repository)`
    )
  return found
}

/** Writes the files into `directory`, which must be new or empty. */
function writeFiles(
  files: ReadonlyMap<string, Uint8Array>,
  directory: string
): void {
  if (existsSync(directory) && readdirSync(directory).length > 0)
    throw new RegistryError(`${directory} is not empty: name a new directory`)
  for (const [name, body] of files) {
    const file = path.join(directory, name)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, body)
  }
}

const readManifest = (body: Uint8Array) =>
  JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>

const manifestBytes = (manifest: Record<string, unknown>) =>
  new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`)

/**
 * Writes the example into `directory`, which must be new or empty: its `package.json` named after
 * the directory, every `@kirana-style/*` package and `kirana-style` at `version`, and the examples
 * runner's own key dropped.
 */
export function writeExample(
  files: ReadonlyMap<string, Uint8Array>,
  directory: string,
  version: string
): void {
  const written = new Map(files)
  const body = files.get("package.json")
  if (body !== undefined) {
    const manifest = readManifest(body)
    manifest.name = path.basename(directory)
    delete manifest["kirana-example"]
    for (const field of ["dependencies", "devDependencies"])
      for (const dependency of Object.keys(
        (manifest[field] ?? {}) as Record<string, string>
      ))
        if (
          dependency === "kirana-style" ||
          dependency.startsWith("@kirana-style/")
        )
          (manifest[field] as Record<string, string>)[dependency] = version
    written.set("package.json", manifestBytes(manifest))
  }
  writeFiles(written, directory)
}

/** What a template's root `package.json` writes for `packageManager` to be the one running `init`. */
export const PACKAGE_MANAGER = "{packageManager}"

/** The package manager running this, and its version, from the user agent npx, pnpm dlx, yarn dlx and bunx set. */
export function runningManager(
  env: Readonly<Record<string, string | undefined>>
): { name: (typeof TEMPLATE_MANAGERS)[number]; version: string } | undefined {
  const match = /^(npm|pnpm|yarn|bun)\/(\d\S*)/.exec(
    env.npm_config_user_agent ?? ""
  )
  return match
    ? {
        name: match[1] as (typeof TEMPLATE_MANAGERS)[number],
        version: match[2]!,
      }
    : undefined
}

/**
 * A template's files from its archive, a gzipped tar: everything under the archive's top folder, which
 * is left out as `giget` and `npm pack` leave it out. A path that would leave the project stops it.
 */
export function unpack(
  archive: Uint8Array,
  source: string
): Map<string, Uint8Array> {
  let tar: Uint8Array
  try {
    tar = gunzipSync(archive)
  } catch {
    throw new RegistryError(`${source}: is not a gzipped tar archive`)
  }
  const files = new Map<string, Uint8Array>()
  for (const [name, body] of untar(tar)) {
    const slash = name.indexOf("/")
    if (slash < 0) continue
    const inside = name.slice(slash + 1)
    if (/(^|\/)\.\.(\/|$)|^\//.test(inside))
      throw new RegistryError(
        `${source}: holds ${inside}, a path outside the project`
      )
    files.set(inside, body)
  }
  if (files.size === 0)
    throw new RegistryError(`${source}: holds no file under a top folder`)
  return files
}

/** Where a registry's template is: its archive, for this package manager, from `templates/index.json`. */
async function locateTemplate(
  reference: string,
  start: string,
  registries: Readonly<Record<string, string>>,
  manager: (typeof TEMPLATE_MANAGERS)[number],
  env: Readonly<Record<string, string | undefined>>,
  options: Options
): Promise<{ url: URL; headers: Record<string, string> }> {
  const settings = await loadSettings(start, options.load)
  const known = new Map(settings.registries)
  for (const [namespace, template] of Object.entries(registries))
    known.set(namespace, { namespace, template, headers: {} })
  const { namespace, name } = parseReference(reference)
  const registry = registryOf(namespace, { ...settings, registries: known })
  // Beside the registry's index: the document its template names `templates/index`.
  const index = locate(registry.template, "templates/index", settings.root)
  const headers = expandHeaders(registry, env)
  const document = await fetchJson(index, headers, options)
  const problems = validate(document, TEMPLATES_SCHEMA)
  if (problems.length > 0)
    throw new RegistryError(
      problems
        .map(
          (problem) =>
            `${index.href}: ${problem.pointer || "/"} ${problem.message}`
        )
        .join("\n")
    )
  const { templates } = document as Templates
  const entry = templates.find((candidate) => candidate.name === name)
  if (!entry)
    throw new RegistryError(
      `${reference} is not one of the ${templates.length} templates ${index.href} lists`
    )
  const file = entry.files?.[manager] ?? entry.file
  if (file === undefined)
    throw new RegistryError(
      `${reference} has no archive for ${manager}: ${index.href} has one for ${Object.keys(entry.files!).join(", ")}`
    )
  return { url: new URL(file, index), headers }
}

/**
 * Starts the project `init --template` sets up, and gives the folder `init` goes on in. A Kirana
 * example is written as `writeExample` writes it. A registry's template or an archive's URL is
 * unpacked into the new directory; its root `package.json` takes the directory's name, the package
 * manager running this where `packageManager` is `{packageManager}`, and loses `kirana-template`,
 * whose `project` names the folder `init` goes on in (the root by default, `apps/web` in a
 * workspace); then the template is installed with that package manager.
 */
export async function startTemplate(
  template: string,
  named: string | undefined,
  start: string,
  registries: Readonly<Record<string, string>>,
  write: (text: string) => void,
  options: Options = {}
): Promise<string> {
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(template)) {
    const current = await release()
    const directory = path.resolve(start, named ?? template)
    writeExample(
      await fetchExample(template, current, options),
      directory,
      current
    )
    write(`template: Kirana ${current}'s ${template} in ${directory}\n`)
    return directory
  }
  const env = options.env ?? process.env
  const running = runningManager(env)
  let url: URL
  let headers: Record<string, string> = {}
  let fallback: string
  if (template.startsWith("@")) {
    if (!TEMPLATE_REFERENCE_PATTERN.test(template))
      throw new RegistryError(
        `${template}: a registry's template is @namespace/name`
      )
    ;({ url, headers } = await locateTemplate(
      template,
      start,
      registries,
      running?.name ?? "npm",
      env,
      options
    ))
    fallback = parseReference(template).name
  } else {
    url = locate(template, "", start)
    fallback = path.posix.basename(url.pathname).replace(/\.(tgz|tar\.gz)$/, "")
  }
  const directory = path.resolve(start, named ?? fallback)
  const files = unpack(
    await fetchBytes(url, headers, {
      ...options,
      timeout: (options.timeout ?? DEFAULT_TIMEOUT) * 4,
    }),
    url.href
  )
  const body = files.get("package.json")
  if (body === undefined)
    throw new RegistryError(`${url.href}: has no package.json at its root`)
  let manifest: Record<string, unknown>
  try {
    manifest = readManifest(body)
  } catch (error) {
    throw new RegistryError(
      `${url.href}: its package.json is not JSON: ${(error as Error).message}`
    )
  }
  const project = (manifest["kirana-template"] as { project?: unknown })
    ?.project
  if (
    project !== undefined &&
    !files.has(path.posix.join(String(project), "package.json"))
  )
    throw new RegistryError(
      `${url.href}: kirana-template.project in its package.json is ${JSON.stringify(project)}, not a folder of it with a package.json`
    )
  delete manifest["kirana-template"]
  manifest.name = path.basename(directory)
  if (manifest.packageManager === PACKAGE_MANAGER) {
    if (!running)
      throw new RegistryError(
        `${url.href}: names the package manager running kirana-style (${PACKAGE_MANAGER}), which says nothing of itself: run it with npx, pnpm dlx, yarn dlx or bunx`
      )
    manifest.packageManager = `${running.name}@${running.version}`
  }
  files.set("package.json", manifestBytes(manifest))
  writeFiles(files, directory)
  write(
    `template: ${template === url.href ? "" : `${template} from `}${url.href} in ${directory}\n`
  )
  // The package manager the template names, else the one running this.
  const manager =
    TEMPLATE_MANAGERS.find((name) =>
      String(manifest.packageManager).startsWith(`${name}@`)
    ) ??
    running?.name ??
    "npm"
  const install = `${manager} install`
  write(`packages: ${install}\n`)
  if (runOf(options)(install, directory) !== 0)
    throw new RegistryError(
      `${install} failed: the template is in ${directory}, Kirana is not set up in it`
    )
  if (project === undefined) return directory
  write(`template: init goes on in ${project}\n`)
  return path.join(directory, String(project))
}
