# @workspace/docs-ui

The layout of the Kirana docs framework — the part that would be `fumadocs-ui`. React components styled
with Kirana and built on `@workspace/ui` (Base UI), fed by `@workspace/docs-core`.

Being built in phases (see the docs overhaul plan):

- `accent.ts` — the accent system: an `accent.base` variable token a wrapper assigns
  (`sx={accents.blue}`), `tint(percent)` for shades mixed at the point of use, and a palette of
  `light-dark()` pairs.
- Docs shell with section tabs and per-tab accents, sidebar with a sliding highlight, table of contents
  with a moving marker, copy-page menu, code blocks with install tabs, markdown components.
- `brand-icon.tsx` — `BrandIcon` draws a [simple-icons](https://simpleicons.org) logo (CC0) in its
  own colour, or in the text colour when that colour would vanish in one scheme. The install tabs use
  it for npm, pnpm, yarn and bun.
- `DocsLayout` — a page-width toggle in the bar (from `xl`) sets `data-wide` on the frame and lifts the
  article's width cap; the choice is kept in `localStorage` (`docs-ui:wide`) and read with
  `useSyncExternalStore`, so the server renders the narrow page and open tabs stay in step.
- `DocsSearch` — `variant="field"` (the sidebar's) or `variant="icon"` (the bar's, below `lg`, where the
  sidebar lives in the menu sheet and would otherwise open search on top of it). `hotkey` says which
  instance answers ⌘K; give it to one.
- `DocsSidebar search` — `true` leads with the search field, `"filter"` with a field that filters page
  titles across every tab (words in any order, matches marked, Enter opens the first; the menu sheet
  uses it), `false` with nothing.
- `DocsConfig.railFooter` / `sidebarFooter` — optional nodes under the table of contents and pinned
  under the sidebar's list (the Kirana site puts its sponsor slots there).
- `DocsConfig.pageIcon(href)` — an optional logo for a page. The sidebar shows it beside the page, and
  a link in a table cell shows it beside the link text.

Components take `sx`, never `className`; Base UI parts receive `{...props(a, sx)}`.
