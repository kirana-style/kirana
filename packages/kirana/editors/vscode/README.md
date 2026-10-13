# Kirana for VS Code

Editor support for [Kirana](https://kirana.style): the compiler's own answers, as you type, in
TypeScript, JavaScript, Vue, Svelte and Astro files.

- **The style card** on an element's `sx`, a `css()` or a recipe: the handles it merges, the box
  model drawn as DevTools draws it, the resolved properties with pixels, tokens and colour
  swatches, the values under breakpoints, states and guards, and the compiled CSS. Hover a
  property for which entry wins and why; hover a token for its value in light and dark.
- **Inline summary** at the end of each element's line: `▦ grid · gap 1rem · p 1rem · +4`, each part
  coloured by its group. Hover it for the card.
- **Style Inspector** (**Kirana: Open Style Inspector**): a panel that follows the cursor, with
  `:hover`, breakpoints and `sx` guards to switch on and off.
- **Style Fold** (`kirana.fold.enabled`, **Kirana: Toggle Style Fold**): long one-line `css({…})`
  objects read as their summary; **Kirana: Fold Styles** folds the multi-line ones.
- **Code lens** on `css()` and `recipe()`: counts, and **used by N elements**.
- **Colour swatches** beside colour literals and colour tokens; the picker edits literals only.
- **Completion** for condition keys (in precedence order), `select.*`, keyword values and utility strings.
- **Diagnostics** with quick fixes; **Extract to `css()`**, **Inline**, **Vary at md / on :hover**,
  **Convert Tailwind classes to `css()`**; outline, highlights, go to definition and references.
- **Status bar**: the stylesheet's rules and size.

The extension runs your project's own `kirana lsp` (`node_modules/.bin/kirana`, from
`@kirana-style/compiler`), so the editor uses the exact engine your build does. Set `kirana.server.path`
to use another binary.

## Seeing the inline summary

The summary is an inlay hint. Inlay hints must be on in the editor:

```json
{ "editor.inlayHints.enabled": "on", "editor.inlayHints.maximumLength": 0 }
```

Some editors default to `offUnlessPressed`, which shows hints only while Ctrl+Alt is held, and VS
Code cuts every hint at 43 characters unless `maximumLength` is `0`. This repository's
`.vscode/settings.json` sets both; `kirana.inlayHints.maxLength` (100) is Kirana's own limit.

## Settings

| Setting                         | Default | What it does                                                           |
| ------------------------------- | ------- | ---------------------------------------------------------------------- |
| `kirana.server.path`            | empty   | The binary to run; empty is the project's own.                         |
| `kirana.inlayHints.enabled`     | `true`  | The summary after each element's `sx`.                                 |
| `kirana.inlayHints.maxLength`   | `100`   | The longest summary; `0` for every declaration.                        |
| `kirana.inlayHints.colors`      | `true`  | Colour the summary by group, as the card does.                         |
| `kirana.inlayHints.icon`        | `true`  | Kirana's icon before each summary.                                     |
| `kirana.inlayHints.opacity`     | `0.85`  | How strongly the summary reads, from `0.1` to `1`.                     |
| `kirana.codeLens.enabled`       | `true`  | The counts and "used by" above `css()` and `recipe()`.                 |
| `kirana.hover.diagrams`         | `true`  | The box model as a picture; off, a text drawing.                       |
| `kirana.rootFontSize`           | `16`    | Pixels per `rem` for the pixel equivalents.                            |
| `kirana.inspector.followCursor` | `true`  | The Style Inspector shows what the cursor is on.                       |
| `kirana.fold.enabled`           | `false` | Style Fold.                                                            |
| `kirana.fold.mode`              | `fold`  | `fold` writes the summary in place; `dim` lowers the object's opacity. |
| `kirana.fold.opacity`           | `0.4`   | The opacity of a dimmed object.                                        |
| `kirana.fold.minLength`         | `40`    | Shorter objects stay as written.                                       |
| `kirana.fold.icon`              | `true`  | Kirana's icon before a folded summary.                                 |
| `kirana.trace.server`           | `off`   | Log the protocol messages.                                             |

VS Code fixes a hover's height at a quarter of the editor (at least 250 px), and an extension cannot
change it. Drag the hover's edge once and it keeps that size until the window reloads; the Style
Inspector has the sidebar's whole height.

## Brand and colours

The icon and the colours come from `packages/kirana/editors/brand/`, which the language server and
this extension both read: `brand.json` holds the icon, written from the logo by
`apps/docs/scripts/generate-brand.ts` (`icon.png` by `rasterize-brand.ts`); `palette.json` holds the
colour of each group of properties. Change the logo or the palette there, and the card, the hints,
the inspector and Style Fold follow, in every editor.
