# @workspace/docs-ui

The layout of the Kirana docs framework — the part that would be `fumadocs-ui`. React components styled
with Kirana and built on `@workspace/ui` (Base UI), fed by `@workspace/docs-core`.

Being built in phases (see the docs overhaul plan):

- `accent.ts` — the accent system: an `accent.base` variable token a wrapper assigns
  (`sx={accents.blue}`), `tint(percent)` for shades mixed at the point of use, and a palette of
  `light-dark()` pairs.
- Docs shell: a bar (logo, search, actions) over a row of section tabs, each tab underlined in its
  accent; a sidebar of labelled groups with a sliding highlight; a breadcrumb (tab › section) and the
  copy-page menu above the page; a pager that lifts on hover; a table of contents with a moving marker.
- `page-context.ts`: the page being rendered, so the markdown title can show its `description` as
  the lede; a blog post provides none.
- `chrome.ts`: the bar's and the tab row's heights (`DOCS_CHROME`), for anything sticky or scrolled to
  under them.
- Markdown: code blocks with install tabs; callouts with a hue per kind (note lake, tip forest,
  important dusk, warning ochre, caution red) tinting the whole surface, never one side; a numbered
  heading (`## 2. Add the plugin`) drawn as a step with its number in a marker. `MarkdownLink` and
  `MarkdownParagraph` let an embed write a sentence the way the page's prose does.
- `brand-icon.tsx` — `BrandIcon` draws a [simple-icons](https://simpleicons.org) logo (CC0) in its
  own colour, or in the text colour when that colour would vanish in one scheme. The install tabs use
  it for npm, pnpm, yarn and bun.
- `ThemeMenu`: the bar's theme control: an icon button showing the sun or the moon the page is in
  (it follows `schemeMarker`, so "system" shows the OS's), opening Light, Dark and System. `D` steps
  the mode.
- `ThemeToggle`: the site footer's theme control, one pill stepping through System, Light and Dark,
  with the mode's name and the `D` key in a round chip at its end. `useThemeHotkey` is the key on its
  own; one per page.
- `WidthToggle`: beside "Copy page" from `xl` up, a button the size of that one, filled in the page's
  hue while the page fills the column. Full width sets `data-wide` on the frame and lifts the
  article's width cap.
- `preferences.ts`: the page width and the collapsed sidebar, kept in `localStorage`
  (`docs-ui:wide`, `docs-ui:sidebar-collapsed`) and read with `useSyncExternalStore`, so the server
  renders the default and open tabs stay in step.
- `DocsLayout`: the bar and the tab row run the full width with no rule between the logo and the
  search; the sidebar's rule starts under them. Ctrl+B or the handle on the sidebar's edge folds it
  to a rail of the tabs' icons; the bar has no button for it. The logo, the first tab and the sidebar's labels share
  one left edge, and the sidebar's first label, the breadcrumb and "On this page" one top line.
- `DocsSearch` — `variant="field"` (the bar's, from `lg`) or `variant="icon"` (the bar's below `lg`, where
  the sidebar lives in the menu sheet and would otherwise open search on top of it). `hotkey` says which
  instance answers ⌘K; give it to one.
- `DocsSidebar search` — `true` leads with the search field, `"filter"` with a field that filters page
  titles across every tab (words in any order, matches marked, Enter opens the first; the menu sheet
  uses it), `false` with nothing.
- `DocsConfig.railFooter` / `sidebarFooter` — optional nodes under the table of contents and pinned
  under the sidebar's list (the Kirana site puts its sponsor slots there).
- `DocsConfig.pageIcon(href)` — an optional logo for a page. The sidebar shows it beside the page, and
  a link in a table cell shows it beside the link text.

Components take `sx`, never `className`; Base UI parts receive `{...props(a, sx)}`.
