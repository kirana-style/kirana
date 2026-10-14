# The docs framework: design note

Kirana's documentation site runs on two packages that are meant to become a product of their own, in the
way `fumadocs-core` and `fumadocs-ui` split the work. This note records how they divide it, the contract
between them and an app, and the decisions that are not obvious from the code.

## The split

| Package                | Owns                                                                                                                                                                                                                                              | Knows about React? |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `@workspace/docs-core` | Content: frontmatter, the markdown parse and its build-time extensions, highlighting, the manifest (pages, nav, posts), the search index and scorer, `llms.txt`, `llms-full.txt` and a markdown twin per page, and `createPages` for lazy loading | No                 |
| `@workspace/docs-ui`   | Presentation: the docs frame (top bar with section tabs, sidebar, page, table of contents), search dialog, copy-page menu, markdown components, accents, brand icons                                                                              | Yes                |
| the app (`apps/docs`)  | The site: routes, the site header and footer, marketing pages, the content itself, and the configuration that binds the two                                                                                                                       | —                  |

docs-core runs at build time (`generate()`), writes plain files into the app, and has no runtime of its own
beyond `createPages` and `search`. docs-ui never reads the file system; everything it shows comes through
`DocsProvider`.

## The contract: `DocsConfig`

An app renders `<DocsProvider value={config}>` once, near the root. docs-ui reads nothing else.

| Field      | What the app supplies                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `Link`     | Its router's link, taking `href` and `sx`. docs-ui never imports a router.                          |
| `nav`      | The generated nav groups, each with a `slug` so tabs can claim sections.                            |
| `pages`    | The generated page list.                                                                            |
| `tabs`     | Section tabs: `id`, `label`, `href`, the section slugs each owns, an accent name, an optional icon. |
| `search`   | A function from query to hits — normally docs-core's scorer over the generated index.               |
| `navigate` | Client-side navigation to a docs href, hash included (search results use it).                       |
| `siteUrl`  | Where the markdown twins are served, for the copy-page menu.                                        |
| `siteName` | The product's name, used in the prompt the copy-page menu sends to an assistant.                    |
| `pageIcon` | Optional: a logo for a page (a framework's), shown in the sidebar and beside links in table cells.  |

Tabs map existing sections; they never change a URL. A page belongs to the tab whose `sections` list its
section.

## Markdown

- docs-core parses with `@tanstack/markdown` and highlights with `@tanstack/highlight` **at build time**; a
  code block reaches the browser as markup plus its source for the copy button. No highlighter ships.
- Components are HTML comments: `<!-- ::name attr="…" -->`, or a block with `::start:` / `::end:`. The
  app registers what each renders (`createMarkdownComponents({ … })`); `install` is built in and renders
  package-manager tabs, while the markdown twins expand it into plain `npm install` lines for language
  models.
- Any other comment on a line of its own is a note for tools (`<!-- prettier-ignore -->`) and is dropped
  before parsing. The formatter runs with `semi: false` and would otherwise put `;` before a JSX line that
  follows an import.

## Styling decisions

- **Kirana throughout.** Components take `sx`; Base UI parts and `motion` elements get
  `{...styleProps(…)}`, since installed components do not read `sx`.
- **Accents are one variable token.** `accent.base` is assigned on a subtree (`sx={accents.forest}`); the
  frame takes the active tab's accent, and every shade is mixed where it is used (`tint(percent)`), because
  a variable token's default is resolved on `:root` and cannot be pre-mixed per subtree. The palette is the
  site's seven scene hues (forest, tea, crater, lake, terracotta, ochre, dusk), each a `light-dark()` pair
  checked against WCAG AA by `apps/docs/scripts/check-contrast.ts`; `SUN` is the gold fill the site uses
  for light, never for text. Which tab and page wears each hue: `apps/docs/src/brand/scenes.ts`.
- **Brand logos** come from simple-icons (CC0) and are drawn in the product's colour, unless that colour
  would vanish in one scheme (luminance below 0.08 or above 0.75), in which case they take the text colour.
  One rule, both schemes.

## Motion

`motion` moves three things: the tab pill (shared layout), the sidebar's highlight (a spring to a measured
row) and the table-of-contents marker. Every one reads `useReducedMotion()` and uses a zero-length
transition when it is set. Nothing animates on its own.

## Accessibility

- The sidebar is a `nav` with `aria-current="page"` on the current row. Doc links match their route
  exactly, so `/docs` is not marked current on every page.
- Search opens with ⌘K / Ctrl+K and is a dialog (`@workspace/ui` Command).
- Checked by hand on 2026-09-29 across the site's routes: every Tab stop shows a focus ring; no CSS or Web
  Animation keeps running under reduced motion; no horizontal overflow at 390, 768 and 1280 px in either
  scheme. The section tabs move into the menu sheet below 1024 px, where five tabs and the actions do not
  fit on one bar; there the current tab is one row that unfolds the others in place, above a field that
  filters the pages by title.
- Below 1024 px search opens from its own button in the bar, not from inside the sheet, so the dialog
  never stacks on another modal.

## Before it can be published

- A package boundary with a build (both packages are consumed from source today).
- `DocsConfig` for i18n and versioned docs, which the site does not need yet.
- An RSS feed for posts; the blog does not claim one until it exists.
