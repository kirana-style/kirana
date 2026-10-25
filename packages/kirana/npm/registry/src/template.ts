/**
 * `kirana-style ui init --template <example> [directory]` (KRN-DX-029): a new project from one of
 * Kirana's examples, the ones its CI installs and builds, as the release being run has them. The
 * release's source tarball is read once, as `giget` reads one (no clone), and only the example's
 * files are written; its `package.json` takes the project's name and this release's versions.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { gunzipSync } from "node:zlib"

import { DEFAULT_TIMEOUT, RegistryError } from "./read.ts"
import type { Io } from "./read.ts"

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
  if (existsSync(directory) && readdirSync(directory).length > 0)
    throw new RegistryError(`${directory} is not empty: name a new directory`)
  for (const [name, body] of files) {
    const file = path.join(directory, name)
    mkdirSync(path.dirname(file), { recursive: true })
    if (name !== "package.json") {
      writeFileSync(file, body)
      continue
    }
    const manifest = JSON.parse(new TextDecoder().decode(body)) as Record<
      string,
      unknown
    >
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
    writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
  }
}
