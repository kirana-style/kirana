/** This package's version, from its own manifest, in the workspace as in the published package. */
import { readFile } from "node:fs/promises"

export async function version(): Promise<string> {
  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  ) as { version: string }
  return manifest.version
}
