# @workspace/docs-core

The content engine of the Kirana docs framework — the part that would be `fumadocs-core`. It turns a
folder of markdown into everything a docs site and a language model need, at build time, so no parser
or grammar ships to the browser.

Built on [`@tanstack/markdown`](https://tanstack.com) (parsing, the docs extension preset) and
`@tanstack/highlight` (code colouring). Framework-free: the React layout lives in `@workspace/docs-ui`.

## What it produces

From `content/docs/**.md` (plus `sections.json`) and `content/blog/*.md`:

| Output                                    | For                                                       |
| ----------------------------------------- | --------------------------------------------------------- |
| `src/generated/content.gen.ts`            | `PAGES`, `NAV`, `ORDER`, `SEARCH`, `POSTS` — the manifest |
| `src/generated/pages/**.json`             | one parsed document per page, loaded lazily               |
| `src/generated/highlight.css`             | code colours as `--th-*` light-dark pairs                 |
| `public/llms.txt`, `public/llms-full.txt` | the docs for language models                              |
| `public/docs/<slug>.md`                   | a markdown twin of every page                             |

It fails the build on unknown sections or groups, missing frontmatter, and `sx=` in prose (markdown is not
compiled by Kirana, so it would be silently unstyled).

## Use

```ts
// scripts/generate-content.ts
import { generate } from "@workspace/docs-core/generate.ts"

await generate({
  root: new URL("..", import.meta.url).pathname,
  typesImport: "@/lib/content",
  generatedBy: "scripts/generate-content.ts",
  regenerateCommand: "bun run generate:content",
  check: process.argv.includes("--check"),
  site: {
    url: "https://example.com",
    fullTitle: "Example docs",
    llms: ["# Example", ""],
  },
})
```

At runtime:

```ts
import { createPages } from "@workspace/docs-core/pages.ts"
import { search } from "@workspace/docs-core/search.ts"

export const { findPage, pageHref, loadDocument, neighbours } = createPages({
  pages: PAGES,
  documents: import.meta.glob("../generated/pages/**/*.json"),
  prefix: "../generated/pages/",
})
```

## Frontmatter

Docs pages: `title`, `description`, `section` (required); `parent` (a group of the section), `order`,
`status` (`planned` | `partial`), `kind` (`api` | `config` | `cli` | `diagnostics`, a badge in the
sidebar), `keywords`. Blog posts: `title`, `summary`, `date`, `author`, `tags`, and optionally `cover`
(an image URL) with `coverAlt`.

## Markdown

- `<!-- ::name attr="…" -->` is a comment component; the app registers what each renders. `install`
  (`packages`, `dev`) is built in, and the markdown twins expand it into `npm install` lines.
- Any other HTML comment on a line of its own is a note for tools and is dropped before parsing —
  `<!-- prettier-ignore -->` above a code block keeps the formatter from inserting ASI semicolons.

`bun run test` runs the unit tests with a coverage floor at today's level.
