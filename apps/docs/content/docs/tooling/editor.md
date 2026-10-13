---
title: Editor support
description: The Kirana language server in VS Code, Cursor, Windsurf, Antigravity, Zed, Neovim and Helix — the compiled CSS on hover, which entry wins and why, swatches, an inline summary, completion and the compiler's diagnostics as you type.
section: tooling
order: 2
keywords:
  [
    editor,
    language server,
    lsp,
    vscode,
    cursor,
    windsurf,
    antigravity,
    zed,
    neovim,
    helix,
    hover,
    intellisense,
    autocomplete,
  ]
---

# Editor support

Object styles move the CSS out of the markup: you read `sx={styles.card}`, not a
class list. The Kirana language server brings it back where you are reading — and
answers questions a class list never could: **which value wins, and why**.

It is `kirana lsp`, a command of the compiler you already installed. It runs on the
same compiler session as your build, so what the editor tells you is what the build
does, never an approximation of it.

<!-- ::figure-editor -->

## Pick your editor

<!-- ::editors -->

Every editor runs your project's own `node_modules/.bin/kirana lsp`, from
`@kirana-style/compiler`. Upgrading Kirana upgrades the editor with it — there is no
extension version to keep in step.

### VS Code and its forks

VS Code, Cursor, Windsurf and Antigravity take the same extension. It finds the
server in your project, walking up to a monorepo's root, and starts it for
TypeScript, JavaScript, Vue, Svelte, Astro and HTML files (HTML for Angular
templates).

Until the first release is on the Marketplace and Open VSX, install the
`kirana.vsix` that CI builds: **Extensions: Install from VSIX…**. In a remote
workspace (WSL, SSH, a container), install it on the remote side, where your
project and Node.js live.

If your project has no `node_modules/.bin/kirana` — a checkout of Kirana itself,
say — point the extension at a binary or script:

```json
{ "kirana.server.path": "packages/kirana/npm/compiler/bin/kirana.ts" }
```

A relative path is resolved against the workspace folder; a `.js` or `.ts` path
runs with `node` (22.18 or later).

### Zed

The Kirana extension registers the server for TypeScript, TSX, JavaScript, and —
with Zed's Vue, Svelte and Astro extensions installed — their components, and
HTML for Angular templates.
Until it is published, add it with **zed: install dev extension** from
`packages/kirana/editors/zed`. To run another binary:

```json
{
  "lsp": {
    "kirana": { "binary": { "path": "/path/to/kirana", "arguments": ["lsp"] } }
  }
}
```

### Neovim

Neovim 0.11 and later:

```lua
vim.lsp.config("kirana", {
  cmd = { "node_modules/.bin/kirana", "lsp" },
  filetypes = {
    "typescript", "typescriptreact", "javascript", "javascriptreact",
    "vue", "svelte", "astro", "html",
  },
  root_markers = { "kirana.config.ts", "kirana.config.js", "kirana.config.json" },
})
vim.lsp.enable("kirana")
```

### Helix

In `languages.toml`:

```toml
[language-server.kirana]
command = "node_modules/.bin/kirana"
args = ["lsp"]

[[language]]
name = "tsx"
language-servers = ["typescript-language-server", "kirana"]

[[language]]
name = "vue" # and "svelte", "astro", "html"
language-servers = ["vuels", "kirana"]
```

### Any other editor

Run `kirana lsp` from the project root and connect over stdio. It runs beside the
TypeScript server and answers styling questions only — property names and token
keys are TypeScript's, through `@kirana-style/core`'s types.

## What you get

### The style card

Hover an element's `sx`, a `css()` call or a recipe and you get its card, laid out
the way you read a style:

- **What it is**: the expression (`styles.card`) and the handles it merges, each a
  link to where it is defined — `Merges 2 handles: base + wide if on`.
- **The box model**, drawn as DevTools draws it: margin, border, padding and
  content nested, each side's value on its side, the content's size and layout in
  the middle, the corners rounded by the border radius.
- **Resolved**: every property that applies, in source order within layout, box,
  size, colour, type, border, effects and motion, with `rem` in pixels, the token
  a value reads, and a swatch for each colour — split light and dark for a pair.
- **When**: the values that depend on a breakpoint (`md`), a state (`:hover`), a
  pseudo-element, or a guard in the `sx` (`if on` for `on && wide`).
- **Compiled CSS**: the rules the stylesheet carries, with their size.

Hover a **property** instead and you get its entries in precedence order, with the
ladder step that put each one where it is — the answer
[`kirana trace`](/docs/tooling/cli) gives on the command line. Hover a **token** for
its value in both colour modes, and whether a theme can reassign it.

VS Code draws the box model as a picture in your theme's colours, with the
properties beside it, each property name in its group's colour — layout blue, box
green, size cyan, colour orange, type yellow, border purple. Other editors show the
same card with a text drawing and the properties below it.

### Inline summary

At the end of every element's line, a muted hint says what it ends up with, in the
vocabulary of a class list: `▦ grid · gap 1rem · p 1rem · m 0.5rem 1rem · +4`. The
mark is its layout (`▦` grid, `⇶` flex); margin and padding read as their
shorthand; values under a guard lead with it (`on: p 2rem`). Hover the hint for the
card. A `{...props(a, b)}` spread is summarized too, from the handles it names.

In VS Code each part is coloured by its group, as the card colours properties —
layout blue, box green, size cyan, colour orange, type yellow, border purple; no
red, which reads as an error — in your theme's own colours, and Kirana's icon leads
it. `kirana.inlayHints.icon` and `kirana.inlayHints.opacity` tune it; other editors
| `kirana.inlayHints.opacity` | `0.85` | How strongly the summary reads, from `0.1` to `1`. |
show it in the hint colour.

Above each `css()` and `recipe()`, a code lens counts declarations, conditional
entries and bridged values, and **used by N elements** lists the elements whose
`sx` names it, in every file. Clicking the counts opens the compiled CSS beside the
file, read-only, in one reused tab.

### Style Inspector (VS Code)

**Kirana: Open Style Inspector** opens a panel in the Explorer that follows the
cursor. It draws the box model, the layout, the colours with a light and dark
switch, and every declaration with its source. Its chips turn conditions and
guards on and off — `:hover`, `md`, `on` — and the values that apply then are the
compiler's answer, not a guess: the server simulates the cascade for exactly that
set.

### Style Fold (VS Code)

With `kirana.fold.enabled` (or **Kirana: Toggle Style Fold**), a long one-line
| `kirana.fold.mode` | `fold` | `fold` writes the summary in place; `dim` lowers the object's opacity. |
| `kirana.fold.opacity` | `0.4` | The opacity of a dimmed object. |
| `kirana.fold.minLength` | `40` | Shorter objects stay as written. |
| `kirana.fold.icon` | `true` | Kirana's icon before a folded summary. |
`css({ … })` reads as its summary, after Kirana's icon, until the cursor is on its
line — Tailwind Fold, for object styles. `kirana.fold.mode: "dim"` keeps the text
and lowers its opacity instead (`kirana.fold.opacity`), and `kirana.fold.minLength`
sets how long an object must be to fold. **Kirana: Fold Styles** folds every multi-line style
object with the editor's own folding.

### Colours

Colour literals and colour tokens get a swatch. A `light-dark(…, …)` pair gets one
per mode, and the picker edits that mode alone. The picker writes the format the
colour is written in — an `oklch()` stays `oklch()`; click the colour at the top of
the picker to switch to hex or `rgb()`. It edits literals only, never a token
reference, so a theme stays the source of a token's colour. A token's swatch shows
its light value, and hover shows both.

### Completion

Where TypeScript cannot help:

- **Condition keys** inside a property's value — pseudo-classes, attributes,
  `@media`, `@container`, `@supports`, `base` — listed weakest to strongest, the
  order the [precedence ladder](/docs/styling/precedence) applies them.
- **`select.`** offers `descendant` and `child`.
- **Keyword values** for the property you are writing (`alignItems: "cen` →
  `center`), from the CSS specification's own grammar.
- **Utility strings** in `sx="…"`: your grammar's variants, roots and scale keys,
  each with its value.

### Diagnostics, fixes and refactorings

Every [compiler diagnostic](/docs/tooling/diagnostics) appears as you type, at the
property it is about. Two have one exact fix, offered as a quick fix:
`unitless-length` (`width: 5` → `width: "5px"`) and a misspelled property (`colr`
→ `color`). Code actions also offer:

- **Extract to `css()`** on an inline `css({…})` in an element's `sx`: a named
  handle above the component.
- **Inline** a handle used once.
- **Vary at md** and **Vary on :hover** on a plain value: it becomes
  `{ base: …, "@media (width >= 48rem)": … }`, ready to change.
- **Show compiled CSS**, **Explain precedence** for the property under the cursor,
  and **Convert Tailwind classes to `css()`** on a `className` string — the engine
  of [`kirana migrate tailwind`](/docs/migration/from-tailwind).

### Structure and navigation

The outline lists a file's styles, recipes, tokens and relations. With the cursor
on a key, every element in the file that receives it is highlighted, and on an
element, the keys it receives. Go to definition on a token opens its entry in
`defineTokens`; on a relation read (`card.within(…)`) it goes to where the anchor
is applied. Find references lists a token's or relation's uses, and workspace
symbols search every token and relation in the project.

### Vue, Svelte and Astro

Components get all of it: script blocks compile as the build compiles them, and
each template binding — Vue's `:sx="…"`, Svelte's and Astro's `sx={…}` — gets its
hint, card and colours, inside `v-for`, `{#each}` and `.map()` too. A diagnostic in
a script lands on its line in the component.

### Server templates

In Blade, Twig, ERB, HEEx and Edge files, each name passed to `kirana(…)` gets
the same hover, colours and summary as an `sx`, from the class map's modules
(`classes` in `kirana.config`). A name no module exports is underlined as
`unknown-class-name`, before the helper would fail on it at runtime. VS Code
sends these files to the server under the `blade`, `php`, `erb`, `twig`,
`phoenix-heex` and `edge` languages; Zed under PHP, Blade, HTML/ERB, Twig and
HEEX.

### Angular

`[sx]="…"` bindings get the same hint, card and colours, in a component's inline
`template` and in the `.html` file its `templateUrl` names. A template reaches
the handles through a member of the same name (`protected readonly styles =
styles`), and the server reads that member as the module's own `styles`. An
HTML file that no component names as its template is left alone.

## Settings

| Setting (VS Code)               | Default | What it does                                                                 |
| ------------------------------- | ------- | ---------------------------------------------------------------------------- |
| `kirana.server.path`            | empty   | The binary to run; empty is the project's own. `.js`/`.ts` runs with `node`. |
| `kirana.inlayHints.enabled`     | `true`  | The summary after `sx`.                                                      |
| `kirana.inlayHints.maxLength`   | `100`   | The longest summary, in characters; `0` for every declaration.               |
| `kirana.inlayHints.colors`      | `true`  | Colour the summary by group; off, VS Code's one-colour hint.                 |
| `kirana.inlayHints.icon`        | `true`  | Kirana's icon before each summary.                                           |
| `kirana.codeLens.enabled`       | `true`  | The counts above `css()` and `recipe()`.                                     |
| `kirana.hover.diagrams`         | `true`  | Draw the box model as a picture; off, a text drawing.                        |
| `kirana.rootFontSize`           | `16`    | Pixels per `rem`, for the pixel equivalents.                                 |
| `kirana.inspector.followCursor` | `true`  | The Style Inspector shows what the cursor is on.                             |
| `kirana.fold.enabled`           | `false` | Style Fold for long one-line style objects.                                  |
| `kirana.trace.server`           | `off`   | Log the protocol messages to the **Kirana** output channel.                  |

Other editors pass the same switches as `initializationOptions`:
`{ "summary": false, "codeLens": false, "rootFontSize": 16 }`. A client that renders
`data:` images in hovers sends `"images": true` and its `"theme"` (`light` or
`dark`, updated with the `kirana/theme` notification); one that runs trusted
`command:` links sends `"commandLinks": true`.

## How fast

On our shadcn/ui port — `packages/ui` and three applications indexed in 166 ms, 61
component files open — a hover answers in **1.2 ms** at the 95th percentile,
diagnostics refresh **7.1 ms** after an edit, and the server holds **65 MB**. The
budgets are 50 ms, 200 ms and 300 MB.

## Limits

- **Components are read by a scanner.** The build parses Vue, Svelte and Astro with
  their own compilers (and Angular's templates are its own, merged at runtime); the server, which cannot load them, scans the same blocks and
  bindings — held to the frameworks' parsers by a test over every example. A
  template binding that reads only a Svelte `<script module>` handle gets no hint.
- **One project per server.** The root is your workspace folder or
  `kirana.config.*`'s directory; editing `kirana.config.*` restarts the server.
- **Uses are found by name.** Declarations, anchors and reads come from the
  compiler; uses in other files are matched by their written names, so a token
  imported under another alias is found under that alias.

## Troubleshooting

- **The status bar shows Kirana with a warning sign.** No binary was found:
  install `@kirana-style/compiler` in the project, or set `kirana.server.path`.
- **Answers look stale after changing the configuration.** Run **Kirana: Restart
  Language Server**.
- **No hint after `sx={…}`.** Check that your editor shows inlay hints at all:
  `editor.inlayHints.enabled` must be `on` (some editors default to
  `offUnlessPressed`, which shows them only while you hold Ctrl+Alt). Set it in
  your workspace's `.vscode/settings.json`:

  ```json
  { "editor.inlayHints.enabled": "on", "editor.inlayHints.maximumLength": 0 }
  ```

- **The summary ends in `…`.** VS Code cuts every inlay hint at 43 characters
  (`editor.inlayHints.maximumLength`); set it to `0` and Kirana's own limit applies,
  `kirana.inlayHints.maxLength`, which counts what it leaves out as `+N`.
- **The card is taller than the hover.** VS Code fixes a hover's height at a quarter
  of the editor, at least 250 px; no extension can change that. Drag the hover's
  edge once and it keeps that size until the window reloads — or open the Style
  Inspector, which has the whole height of the sidebar.
- **You want to see what is said.** Set `kirana.trace.server` to `verbose` and open
  the **Kirana** output channel.
