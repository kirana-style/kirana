# Editor support
Source: https://kirana.style/docs/tooling/editor

# Editor support

<!-- ::editor-banner -->

Object styles move the CSS out of the markup: you read `sx={styles.card}`, not a
class list. The Kirana language server brings it back where you are reading, and
answers questions a class list never could: **which value wins, and why**.

It is `kirana-style lsp`, a command of the compiler you already installed. It runs on the
same compiler session as your build, so what the editor tells you is what the build
does, never an approximation of it.

## Light through every line of your styles

A Tailwind class list shows what an element gets; object styles hid it. The
language server puts it back on every line, coloured by kind, and answers the rest
on hover. Pick a feature to see what it shows: every picture is the server's real
output for one file.

<!-- ::editor-showcase -->

## Pick your editor

- [VS Code](/docs/tooling/editor#vs-code-and-its-forks): Extension
- [Cursor](/docs/tooling/editor#vs-code-and-its-forks): VS Code extension
- [Windsurf](/docs/tooling/editor#vs-code-and-its-forks): VS Code extension
- [Antigravity](/docs/tooling/editor#vs-code-and-its-forks): VS Code extension
- [Zed](/docs/tooling/editor#zed): Extension
- [Neovim](/docs/tooling/editor#neovim): vim.lsp.config
- [Helix](/docs/tooling/editor#helix): languages.toml
- [Any LSP editor](/docs/tooling/editor#any-other-editor): kirana-style lsp over stdio

Every editor runs your project's own `node_modules/.bin/kirana-style lsp`, from the
`kirana-style` package. Upgrading Kirana upgrades the editor with it; there is no
extension version to keep in step. A project still on 0.1.0 has `kirana` there
instead, and the extensions find that too.

### VS Code and its forks

VS Code, Cursor, Windsurf and Antigravity take the same extension. It finds the
server in your project, walking up to a monorepo's root, and starts it for
TypeScript, JavaScript, Vue, Svelte, Astro and HTML files (HTML for Angular
templates).

Install **Kirana** from the
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kirana-style.kirana)
in VS Code, or from [Open VSX](https://open-vsx.org/extension/kirana-style/kirana)
in Cursor, Windsurf, Antigravity and VSCodium: search "Kirana" in the
Extensions view. In a remote workspace (WSL, SSH, a container), install it on
the remote side, where your project and Node.js live.

If your project has no `node_modules/.bin/kirana-style` (a checkout of Kirana itself,
say), point the extension at a binary or script:

```json
{ "kirana.server.path": "packages/kirana/npm/cli/bin/kirana-style.ts" }
```

A relative path is resolved against the workspace folder; a `.js` or `.ts` path
runs with `node` (22.18 or later).

### Zed

The Kirana extension registers the server for TypeScript, TSX and JavaScript, for
Vue, Svelte and Astro components once Zed's extensions for them are installed, and
for HTML in Angular templates.
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
  cmd = { "node_modules/.bin/kirana-style", "lsp" },
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
command = "node_modules/.bin/kirana-style"
args = ["lsp"]

[[language]]
name = "tsx"
language-servers = ["typescript-language-server", "kirana"]

[[language]]
name = "vue" # and "svelte", "astro", "html"
language-servers = ["vuels", "kirana"]
```

### Any other editor

Run `kirana-style lsp` from the project root and connect over stdio. It runs beside the
TypeScript server and answers styling questions only: property names and token
keys are TypeScript's, through `@kirana-style/core`'s types.

## What you get

### The style card

Hover an element's `sx`, a `css()` call or a recipe and you get its card, laid out
the way you read a style:

- **What it is**: the expression (`styles.card`) and the handles it merges, each a
  link to where it is defined, as in `Merges 2 handles: base + wide if on`.
- **The box model**, drawn as DevTools draws it: margin, border, padding and
  content nested, each side's value on its side, the content's size and layout in
  the middle, the corners rounded by the border radius.
- **Resolved**: every property that applies, in source order within layout, box,
  size, colour, type, border, effects and motion, with `rem` in pixels, the token
  a value reads, and a swatch for each colour, split light and dark for a pair.
- **When**: the values that depend on a breakpoint (`md`), a state (`:hover`), a
  pseudo-element, or a guard in the `sx`, shown as `if on`.
- **Compiled CSS**: the rules the stylesheet carries, with their size.

Hover a **property** instead and you get its entries in precedence order, with the
ladder step that put each one where it is: the answer
[`kirana-style trace`](/docs/tooling/cli) gives on the command line. Hover a **token** for
its value in both colour modes, and whether a theme can reassign it.

VS Code draws the box model as a picture in your theme's colours, with the
properties beside it, each property name in its group's colour: layout blue, box
green, size cyan, colour orange, type yellow, border purple. Other editors show the
same card with a text drawing and the properties below it.

### Inline summary

At the end of every element's line, a muted hint says what it ends up with, in the
vocabulary of a class list: `▦ grid · gap 1rem · p 1rem · m 0.5rem 1rem · +4`.
Hover the hint for the card.

- The mark is the layout: `▦` for grid, `⇶` for flex.
- Margin and padding read as their shorthand.
- A value under a guard leads with it: `on: p 2rem`.
- A `{...props(a, b)}` spread is summarised too, from the handles it names.

In VS Code each part is coloured by its group, as the card colours properties:
layout blue, box green, size cyan, colour orange, type yellow, border purple. There
is no red, which reads as an error, and the colours are your theme's own. Kirana's
icon leads the hint; `kirana.inlayHints.icon` and `kirana.inlayHints.opacity` tune
it. Other editors show it in the hint colour.

Above each `css()` and `recipe()`, a code lens counts declarations, conditional
entries and bridged values, and **used by N elements** lists the elements whose
`sx` names it, in every file. Clicking the counts opens the compiled CSS beside the
file, read-only, in one reused tab.

### Style Inspector (VS Code)

**Kirana: Open Style Inspector** opens a panel in the Explorer that follows the
cursor. It draws the box model, the layout, the colours with a light and dark
switch, and every declaration with its source. Its chips turn conditions and
guards on and off (`:hover`, `md`, `on`), and the values that apply then are the
compiler's answer, not a guess: the server simulates the cascade for exactly that
set.

### Style Fold (VS Code)

With `kirana.fold.enabled` (or **Kirana: Toggle Style Fold**), a long one-line
`css({ … })` reads as its summary, after Kirana's icon, until the cursor is on its
line: Tailwind Fold, for object styles. In `dim` mode the text stays and its opacity
drops instead, and a minimum length keeps short objects as written; the settings
are [below](#settings). **Kirana: Fold Styles** folds every multi-line style object
with the editor's own folding.

### Colours

Colour literals and colour tokens get a swatch. A `light-dark(…, …)` pair gets one
per mode, and the picker edits that mode alone. The picker writes the format the
colour is written in, so an `oklch()` stays `oklch()`; click the colour at the top
of the picker to switch to hex or `rgb()`. It edits literals only, never a token
reference, so a theme stays the source of a token's colour. A token's swatch shows
its light value, and hover shows both.

### Completion

Where TypeScript cannot help:

- **Condition keys** inside a property's value (pseudo-classes, attributes,
  `@media`, `@container`, `@supports` and `base`), listed weakest to strongest, the
  order the [precedence ladder](/docs/styling/precedence) applies them.
- **`select.`** offers `descendant` and `child`.
- **Keyword values** for the property you are writing (`alignItems: "cen` →
  `center`), from the CSS specification's own grammar.
- **Utility strings** in `sx="…"`: your grammar's variants, roots and scale keys,
  each with its value.

### Diagnostics, fixes and refactorings

Every [compiler diagnostic](/docs/tooling/diagnostics) appears as you type, at the
property it is about. Two have one exact fix, offered as a quick fix:

| Diagnostic            | You wrote  | The fix        |
| --------------------- | ---------- | -------------- |
| `unitless-length`     | `width: 5` | `width: "5px"` |
| A misspelled property | `colr`     | `color`        |

Code actions also offer:

- **Extract to `css()`** on an inline `css({…})` in an element's `sx`: a named
  handle above the component.
- **Inline** a handle used once.
- **Vary at md** and **Vary on :hover** on a plain value: it becomes
  `{ base: …, "@media (width >= 48rem)": … }`, ready to change.
- **Show compiled CSS**, **Explain precedence** for the property under the cursor,
  and **Convert Tailwind classes to `css()`** on a `className` string, with the
  engine of [`kirana-style migrate tailwind`](/docs/migration/from-tailwind).

### Structure and navigation

The outline lists a file's styles, recipes, tokens and relations. With the cursor
on a key, every element in the file that receives it is highlighted, and on an
element, the keys it receives. Go to definition on a token opens its entry in
`defineTokens`; on a relation read (`card.within(…)`) it goes to where the anchor
is applied. Find references lists a token's or relation's uses, and workspace
symbols search every token and relation in the project.

### Vue, Svelte and Astro

Components get all of it. Script blocks compile as the build compiles them, and
each template binding gets its hint, card and colours, inside a loop too:

| Framework | Binding   | Loop      |
| --------- | --------- | --------- |
| Vue       | `:sx="…"` | `v-for`   |
| Svelte    | `sx={…}`  | `{#each}` |
| Astro     | `sx={…}`  | `.map()`  |

A diagnostic in a script lands on its line in the component.

### Server templates

In Blade, Twig, ERB, HEEx and Edge files, each name passed to `kirana(…)` gets
the same hover, colours and summary as an `sx`, from the class map's modules (the
`classes` setting of your configuration). A name no module exports is underlined
as `unknown-class-name`, before the helper would fail on it at runtime. The editors
send these files to the server as:

| Editor  | Languages                                             |
| ------- | ----------------------------------------------------- |
| VS Code | `blade`, `php`, `erb`, `twig`, `phoenix-heex`, `edge` |
| Zed     | PHP, Blade, HTML/ERB, Twig, HEEX                      |

### Angular

`[sx]="…"` bindings get the same hint, card and colours, in a component's inline
`template` and in the `.html` file its `templateUrl` names. A template reaches the
handles through a member of the same name, which the server reads as the module's
own handles:

```ts
protected readonly styles = styles
```

An HTML file that no component names as its template is left alone.

## Settings

| Setting (VS Code)               | Default | What it does                                                                 |
| ------------------------------- | ------- | ---------------------------------------------------------------------------- |
| `kirana.server.path`            | empty   | The binary to run; empty is the project's own. `.js`/`.ts` runs with `node`. |
| `kirana.inlayHints.enabled`     | `true`  | The summary after `sx`.                                                      |
| `kirana.inlayHints.maxLength`   | `100`   | The longest summary, in characters; `0` for every declaration.               |
| `kirana.inlayHints.colors`      | `true`  | Colour the summary by group; off, VS Code's one-colour hint.                 |
| `kirana.inlayHints.icon`        | `true`  | Kirana's icon before each summary.                                           |
| `kirana.inlayHints.opacity`     | `0.85`  | How strongly the summary reads, from `0.1` to `1`.                           |
| `kirana.codeLens.enabled`       | `true`  | The counts above `css()` and `recipe()`.                                     |
| `kirana.hover.diagrams`         | `true`  | Draw the box model as a picture; off, a text drawing.                        |
| `kirana.rootFontSize`           | `16`    | Pixels per `rem`, for the pixel equivalents.                                 |
| `kirana.inspector.followCursor` | `true`  | The Style Inspector shows what the cursor is on.                             |
| `kirana.fold.enabled`           | `false` | Style Fold for long one-line style objects.                                  |
| `kirana.fold.mode`              | `fold`  | `fold` writes the summary in place; `dim` lowers the object's opacity.       |
| `kirana.fold.opacity`           | `0.4`   | The opacity of a dimmed object.                                              |
| `kirana.fold.minLength`         | `40`    | Shorter objects stay as written.                                             |
| `kirana.fold.icon`              | `true`  | Kirana's icon before a folded summary.                                       |
| `kirana.trace.server`           | `off`   | Log the protocol messages to the **Kirana** output channel.                  |

Other editors pass the same switches as `initializationOptions`:

| Option                 | What it does                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"summary": false`     | Turns the inline summary off.                                                                                                                        |
| `"codeLens": false`    | Turns the counts above `css()` off.                                                                                                                  |
| `"rootFontSize": 16`   | Pixels per `rem`.                                                                                                                                    |
| `"images": true`       | For a client that renders `data:` images in hovers. It sends `"theme"` (`light` or `dark`) too, and updates it with the `kirana/theme` notification. |
| `"commandLinks": true` | For a client that runs trusted `command:` links.                                                                                                     |

## How fast

On our shadcn/ui port (`packages/ui` and three applications, indexed in 166 ms, with
61 component files open), a hover answers in **1.2 ms** at the 95th percentile,
diagnostics refresh **7.1 ms** after an edit, and the server holds **65 MB**. The
budgets are 50 ms, 200 ms and 300 MB.

## Limits

- **Components are read by a scanner.** The build parses Vue, Svelte and Astro with
  their own compilers (and Angular's templates are its own, merged at runtime); the server, which cannot load them, scans the same blocks and
  bindings, and a test over every example holds the scan to the frameworks' parsers. A
  template binding that reads only a Svelte `<script module>` handle gets no hint.
- **The summary shows what the compiler knows at build time.** A value returned
  by a function it cannot see into (`sx={mergeSx(a, b)}`, a hand-written variant
  helper) has nothing to summarise, where the same values as an array,
  `sx={[a, b]}`, do. A recipe called with a variant known only at run time
  (`button({ variant })`) is not summarised yet, and `sx` passed to one of your
  components is summarised inside it, on the element that receives it.
- **One project per server.** The root is your workspace folder or
  `kirana.config.*`'s directory; editing `kirana.config.*` restarts the server.
- **Uses are found by name.** Declarations, anchors and reads come from the
  compiler; uses in other files are matched by their written names, so a token
  imported under another alias is found under that alias.

## Troubleshooting

- **The status bar shows Kirana with a warning sign.** No binary was found:
  install `kirana-style` in the project, or set `kirana.server.path`.
- **Answers look stale after changing the configuration.** Run **Kirana: Restart
  Language Server**.
- **No hint after `sx={…}`.** Check that your editor shows inlay hints at all:
  `editor.inlayHints.enabled` must be `on` (some editors default to showing them
  only while you hold Ctrl+Alt). Set it in
  your workspace's `.vscode/settings.json`:

  ```json
  { "editor.inlayHints.enabled": "on", "editor.inlayHints.maximumLength": 0 }
  ```

- **The summary ends in `…`.** VS Code cuts every inlay hint at 43 characters. Set
  `editor.inlayHints.maximumLength` to `0` and Kirana's own limit applies
  (`kirana.inlayHints.maxLength`), counting what it leaves out at the end.
- **The card is taller than the hover.** VS Code fixes a hover's height at a quarter
  of the editor, at least 250 px; no extension can change that. Drag the hover's
  edge once and it keeps that size until the window reloads. Or open the Style
  Inspector, which has the whole height of the sidebar.
- **You want to see what is said.** Set `kirana.trace.server` to `verbose` and open
  the **Kirana** output channel.
