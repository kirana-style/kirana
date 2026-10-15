/**
 * The published releases, read from the repository's `CHANGELOG.md` as release-please writes it,
 * newest first. The file is imported as text, so the changelog page follows every release with
 * nothing generated to keep in step.
 */
import { parseChangelog } from "@workspace/docs-core/changelog.ts"

import source from "../../../../CHANGELOG.md?raw"

export const RELEASES = parseChangelog(source)
