# Kirana for VS Code

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/kirana-style.kirana?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=kirana-style.kirana)
[![Open VSX](https://img.shields.io/open-vsx/v/kirana-style/kirana?label=Open%20VSX)](https://open-vsx.org/extension/kirana-style/kirana)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/kirana-style/kirana/blob/main/LICENSE)

Editor support for [Kirana](https://kirana.style), the CSS-in-JS compiler with a Rust engine.
Every element shows the CSS it ends up with on its own line, a hover tells the whole story of a
style, and the compiler's diagnostics arrive as you type, in TypeScript, JavaScript, Vue, Svelte,
Astro and Angular templates.

![Kirana, and the editors its language server runs in: VS Code, Cursor, Windsurf, Antigravity, Zed, Neovim, Helix and any LSP editor](https://raw.githubusercontent.com/kirana-style/kirana/main/packages/kirana/editors/vscode/images/banner.webp)

Every editor picture below is the language server's real output for one file, rendered as VS Code shows it
with the GitHub Dark theme. The answers come from your project's own compiler (`kirana-style lsp`, from `@kirana-style/compiler`), so
the editor sees exactly what your build does. Upgrading Kirana upgrades the editor with it.

## Installation

| Editor                                      | Install                                                                                                                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **VS Code**                                 | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kirana-style.kirana), **Extensions** → search "Kirana", or `code --install-extension kirana-style.kirana` |
| **Cursor, Windsurf, Antigravity, VSCodium** | [Open VSX](https://open-vsx.org/extension/kirana-style/kirana): **Extensions** → search "Kirana"                                                                                    |
| **Zed**                                     | The Kirana extension: **zed: install dev extension** from [`packages/kirana/editors/zed`](https://github.com/kirana-style/kirana/tree/main/packages/kirana/editors/zed)             |
| **Neovim, Helix, any LSP editor**           | `kirana-style lsp` as a language server: [setup for each editor](https://kirana.style/docs/tooling/editor)                                                                          |

The extension needs `kirana-style` in your project (`npx kirana-style@latest init` adds it). It
finds `node_modules/.bin/kirana-style`, walking up to a monorepo's root, or `kirana` in a project
still on 0.1.0. In a remote workspace (WSL, SSH,
a dev container), install the extension on the remote side, where your project lives.

## Features

### Inline summary

After each element's `sx`, what the element ends up with, in a class list's words and coloured by
kind: layout, box, size, colour, type, border. Conditions lead their values (`md: p 1.5rem`), and
`+N` counts what does not fit. Hover the summary for the style card.

![Inline summary](https://raw.githubusercontent.com/kirana-style/kirana/main/packages/kirana/editors/vscode/images/inline-summary.webp)

### Style card

Hover an element's `sx`, a `css()` or a recipe: the handles it merges, the box model as DevTools
draws it, every property with pixel equivalents and the token it reads, the values under
breakpoints, states and guards, what is overridden, and the compiled CSS. Hover a single property
for which entry wins and why; hover a token for its value in light and dark.

![Style card](https://raw.githubusercontent.com/kirana-style/kirana/main/packages/kirana/editors/vscode/images/style-card.webp)

### Style Inspector

**Kirana: Open Style Inspector** opens a panel that follows the cursor. Switch `:hover`,
`:focus-visible`, breakpoints and `sx` guards on and off, and watch the box and the properties
change, with the whole height of the sidebar.

![Style Inspector](https://raw.githubusercontent.com/kirana-style/kirana/main/packages/kirana/editors/vscode/images/style-inspector.webp)

### Style Fold

Long one-line `css({…})` objects read as their summary until the cursor reaches their line
(`kirana.fold.enabled`, or **Kirana: Toggle Style Fold**). **Kirana: Fold Styles** folds the
multi-line ones, with the same summary as the folded text.

![Style Fold](https://raw.githubusercontent.com/kirana-style/kirana/main/packages/kirana/editors/vscode/images/style-fold.webp)

### Colours

A swatch beside every colour literal and colour token, with both sides of `light-dark()`. The
colour picker edits literals; a token keeps pointing at its definition.

![Colours](https://raw.githubusercontent.com/kirana-style/kirana/main/packages/kirana/editors/vscode/images/colours.webp)

### Diagnostics, fixes and refactorings

The compiler's diagnostics as you type, each with its code, and a quick fix where one exists.
Refactorings: **Extract to `css()`**, **Inline style handle**, **Vary at md**, **Add a :hover
value** and **Convert Tailwind classes to `css()`**.

![Diagnostics](https://raw.githubusercontent.com/kirana-style/kirana/main/packages/kirana/editors/vscode/images/diagnostics.webp)

### And more

- **Code lens** above `css()` and `recipe()`: declaration, condition and bridged-value counts, and
  **used by N elements**.
- **Completion** for condition keys (in precedence order), `select.*` targets, keyword values and
  utility strings.
- **Navigation**: outline, highlights, go to definition and find references for tokens, recipes,
  relations and keyframes.
- **Components and templates**: Vue, Svelte and Astro components, Angular `[sx]` bindings, and the
  Blade, ERB, Twig, HEEx and Edge templates that read Kirana's class map.
- **Status bar**: the stylesheet's rules and size.

![Every editor, every framework](https://raw.githubusercontent.com/kirana-style/kirana/main/packages/kirana/editors/vscode/images/editors.webp)

## Recommended VS Code settings

The summary is an inlay hint, so inlay hints must be on. Some editors default
`editor.inlayHints.enabled` to `offUnlessPressed`, which shows them only while Ctrl+Alt is held, and
VS Code cuts every inlay hint at 43 characters unless `editor.inlayHints.maximumLength` is `0`.
With `0`, Kirana's own limit applies (`kirana.inlayHints.maxLength`), which counts what it leaves
out as `+N`.

```json
{
  "editor.inlayHints.enabled": "on",
  "editor.inlayHints.maximumLength": 0
}
```

## Extension commands

### `Kirana: Open Style Inspector`

The Style Inspector panel, following the cursor.

### `Kirana: Show Compiled CSS`

The CSS the current file compiles to, read-only, beside the file.

### `Kirana: Explain Precedence of the Property Under the Cursor`

Which entry wins for the property under the cursor, and why the others lose.

### `Kirana: Convert Tailwind Classes to css()`

Rewrites the class list under the cursor as a `css()` object, with Kirana's migration engine.

### `Kirana: Toggle Style Fold` and `Kirana: Fold Styles`

Style Fold for one-line objects, and folding for the multi-line ones.

### `Kirana: Restart Language Server`

After changing `kirana.config.*`, or when answers look stale.

## Extension settings

### `kirana.server.path`

The `kirana-style` binary or script to run. Empty uses the project's own `node_modules/.bin/kirana-style`. A
relative path is resolved against the workspace folder; a `.js` or `.ts` path runs with `node`
(22.18 or later). **Default: empty**

### `kirana.inlayHints.enabled`

The summary after each element's `sx`. **Default: `true`**

### `kirana.inlayHints.maxLength`

The longest summary in characters; the rest is counted as `+N`. `0` shows every declaration.
**Default: `100`**

### `kirana.inlayHints.colors`

Colour the summary by group, as the card colours properties. **Default: `true`**

### `kirana.inlayHints.icon`

Kirana's icon before each summary. **Default: `true`**

### `kirana.inlayHints.opacity`

How strongly the summary reads against the code, from `0.1` to `1`. **Default: `0.85`**

### `kirana.codeLens.enabled`

The counts and **used by N elements** above `css()` and `recipe()`. **Default: `true`**

### `kirana.hover.diagrams`

Draw the box model as a picture in the card; off, a text drawing. **Default: `true`**

### `kirana.rootFontSize`

Pixels per `rem`, for the pixel equivalents. **Default: `16`**

### `kirana.inspector.followCursor`

The Style Inspector shows what the cursor is on. **Default: `true`**

### `kirana.fold.enabled`

Style Fold for long one-line `css({…})` objects. **Default: `false`**

### `kirana.fold.mode`

`fold` writes the summary in place of the object; `dim` lowers the object's opacity instead.
**Default: `fold`**

### `kirana.fold.opacity`

The opacity of a dimmed object. **Default: `0.4`**

### `kirana.fold.minLength`

Objects shorter than this many characters stay as written. **Default: `40`**

### `kirana.fold.icon`

Kirana's icon before a folded summary. **Default: `true`**

### `kirana.trace.server`

Log the messages between the editor and the language server in the **Kirana** output channel:
`off`, `messages` or `verbose`. **Default: `off`**

## Troubleshooting

- **The status bar shows Kirana with a warning sign.** No server was found: install
  `@kirana-style/compiler` in the project, or set `kirana.server.path`.
- **No summary after any `sx`.** Inlay hints are off or cut short: see the recommended settings
  above.
- **No summary after one `sx`.** The summary shows what the compiler knows when it builds:
  - a value returned by a function it cannot see into (`sx={mergeSx(a, b)}`, a hand-written
    variant helper) has nothing to summarise; the same values written as an array,
    `sx={[a, b]}`, do;
  - a recipe called with a variant known only at run time (`button({ variant })`) is not
    summarised yet;
  - `sx` passed to one of your components is summarised inside that component, on the element that
    receives it, not where the component is used.
- **Answers look stale after changing the configuration.** Run **Kirana: Restart Language Server**.
- **The card is taller than the hover.** VS Code fixes a hover's height at a quarter of the editor,
  and no extension can change it. Drag the hover's edge once and it keeps that size until the
  window reloads, or use the Style Inspector.
- **Something else.** Set `kirana.trace.server` to `verbose`, open the **Kirana** output channel,
  and [open an issue](https://github.com/kirana-style/kirana/issues) with what it shows.

## Links

- [Documentation](https://kirana.style/docs) · [Editor guide](https://kirana.style/docs/tooling/editor)
- [Changelog](https://github.com/kirana-style/kirana/blob/main/CHANGELOG.md)
- [Source](https://github.com/kirana-style/kirana/tree/main/packages/kirana/editors/vscode) ·
  [Issues](https://github.com/kirana-style/kirana/issues)

The icon and the summary's colours come from
[`packages/kirana/editors/brand`](https://github.com/kirana-style/kirana/tree/main/packages/kirana/editors/brand),
which the language server and every editor read.
