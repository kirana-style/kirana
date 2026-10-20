/**
 * The "not on npm yet" note on every install page, in one place: the `npm-status` embed draws it
 * and the markdown twin writes it. It shows while the packages are unpublished (`PUBLISHED` in
 * facts.ts) and is gone from every page, and every twin, once they are.
 */
import { PUBLISHED } from "./release.ts"

/** Where the tarball install is written down. */
export const TARBALLS = {
  text: "Installation",
  href: "/docs/start/installation#install-from-tarballs",
} as const

/**
 * The two notes: `packages` for an npm install, `helpers` for a server framework, whose template
 * helper also comes from a language registry.
 */
export const NPM_NOTES = {
  packages: {
    title: "Not on npm yet",
    before:
      "The packages are packed and install-tested on every change, but not published. Until they are, install them from tarballs as",
    after: "shows; the rest of this page is the same either way.",
  },
  helpers: {
    title: "Not on npm or the language registries yet",
    before:
      "The packages and the template helpers are packed and tested on every change, but not published. Until they are, install the npm packages from tarballs as",
    after:
      "shows, and the helper from a checkout of the repository by path; the rest of this page is the same either way.",
  },
} as const

export type NpmNote = keyof typeof NPM_NOTES

/** The note an embed asks for (`<!-- ::npm-status kind="helpers" -->`), or the npm one. */
export function npmNote(kind: string | undefined) {
  return NPM_NOTES[kind as NpmNote] ?? NPM_NOTES.packages
}

/** The note as the markdown twin writes it: a callout, or nothing once the packages are out. */
export function npmStatusMarkdown(kind?: string): string {
  if (PUBLISHED) return ""
  const note = npmNote(kind)
  return `> [!NOTE] ${note.title}\n> ${note.before} [${TARBALLS.text}](${TARBALLS.href}) ${note.after}`
}
