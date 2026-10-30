/**
 * The release the site describes, read from the packages' `package.json`. The docs banner and the
 * install notes read only this, so it sits apart from `facts.ts` (which re-exports it).
 */
import { PACKAGES } from "../generated/packages.gen.ts"

/**
 * Whether the packages are on npm, read from their `package.json` (`publishConfig.access` is
 * "public"; `private` stays true in the workspace). Every pre-release install note reads this one
 * flag, so publishing removes them all at once.
 */
export const PUBLISHED = PACKAGES.every((entry) => entry.published)

/** The release every package is at: one version for everything. */
export const VERSION = PACKAGES[0]!.version
if (PACKAGES.some((entry) => entry.version !== VERSION))
  throw new Error("release.ts: the packages are not at one version")
