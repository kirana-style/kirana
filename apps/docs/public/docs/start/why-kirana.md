# Why Kirana
Source: https://kirana.style/docs/start/why-kirana

# Why Kirana

"CSS-in-JS" means two different things, and most of the dislike is for the
first one. This page separates them, says what Kirana is, what it answers that
StyleX left open, and where it costs you something.

## The CSS-in-JS people left

The first generation (styled-components, Emotion and their relatives) kept
styles in JavaScript and turned them into CSS **in the browser, while
rendering**. Every component that rendered serialised its styles, hashed them
and inserted a `<style>` rule. That had costs that no amount of tuning removed:

- **Work on every render.** Styles were computed at runtime, so pages started
  slower and got slower as the number of components grew.
- **A library in every bundle.** The runtime that did that work shipped to every
  user.
- **Server rendering got harder.** Styles had to be collected during the render
  and serialised into the HTML.
- **The browser recalculated styles more often.** React's own documentation
  lists two problems with runtime `<style>` injection: it "forces the browser to
  recalculate the styles a lot more often", and it "can be very slow if it
  happens at the wrong time in the React lifecycle". It recommends
  [static extraction to CSS files, plus inline styles for dynamic values](https://react.dev/reference/react/useInsertionEffect),
  and says the first of those two problems "is not solvable" for runtime
  injection.

GitHub's Primer is the public example. Starting with Primer React v37 it moved
its components from styled-components to CSS Modules, finished that by December
2024, and reports **55 % less time to server-render a page and 25 % less time for
the components on a page to initialise**
([GitHub Engineering, 2026](https://github.blog/engineering/architecture-optimization/improving-site-performance-by-shipping-more-css/)).
Its stated reasons were exactly the list above: styles initialised on the client,
server rendering slowed by style collection, and style updates that "grew out of
control as component count grew".

That is a verdict on **runtime** CSS-in-JS. It is not a verdict on writing styles
next to components.

## What a compiler changes

A compiled system reads the same style objects **at build time** and writes a
plain stylesheet. Nothing about styling happens in the browser except applying
class names. Kirana is this kind, and it is exactly what the React team
recommends: static CSS files for static styles, and a custom property in
`style` for a value only known at runtime.

| The complaint                       | Runtime CSS-in-JS         | Kirana                                                                                                                                                                       |
| ----------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Styles are computed while rendering | Yes                       | No. Styles become CSS during the build                                                                                                                                       |
| A styling runtime in the bundle     | Yes, the whole library    | A module with only static styles imports nothing; merging and bridging need a helper under 1 kB gzipped                                                     |
| Server rendering collects styles    | Yes                       | No. The stylesheet is a file, linked like any other                                                                                                                          |
| `<style>` tags inserted at runtime  | Yes                       | Never. The runtime [never generates CSS](/docs/styling/dynamic)                                                                                                              |
| CSS grows with markup               | Often, one rule per usage | [Atomic](/docs/advanced/output): one rule per distinct declaration, shared by every element that uses it                                                                     |
| Class names you cannot read         | Hashed                    | Hashed too, but `kirana trace file:line property` prints every entry for a style and the one that wins, and [hovering it in the editor](/docs/tooling/editor) shows the same |
| Order bugs between style sheets     | Insertion order decided   | One [precedence ladder](/docs/styling/precedence), in [layers](/docs/config/layers)                                                                                          |

What you keep from CSS-in-JS is the part people liked: styles are values, next to
the component, typed, passed as props, and deleted with the component.

## You can see the CSS again

Runtime cost was one reason teams left CSS-in-JS. The other was reading. A
Tailwind class list _is_ the CSS, written on the element: `grid gap-4 p-4
md:p-6` tells you what the `<article>` gets without leaving the line. A style
object moves that into a constant somewhere else, and reading a component turns
into jumping to `styles.card` and back.

Kirana's [language server](/docs/tooling/editor) gives the class list back,
without putting it in your markup:

- **At the end of every element's line**, what it ends up with, in a class list's
  words and coloured by kind: `▦ grid · gap 1rem · p 1rem · md: p 1.5rem`. Values
  under a guard lead with it (`featured: shadow lg`).
- **On hover**, a card: the box model drawn as DevTools draws it, every
  declaration with `rem` in pixels and the token it reads, and the compiled rule.
  On one property, every entry in precedence order and the step that decided.
- **In VS Code**, a Style Inspector that follows the cursor and turns `:hover` or
  `md` on to show what applies then, and Style Fold, which reads a long object as
  its summary until you edit it, like Tailwind Fold, for objects.

It works in `.tsx`, `.vue`, `.svelte` and `.astro` files and Angular templates, in VS Code, Zed,
Neovim and Helix. It answers from the compiler session the build uses, so the
editor and the stylesheet never disagree.

So the trade is no longer readability for types. You keep what made object
styles worth it (a typo is a compile error, a token is a typed import, a style is
a value you pass and delete with its component), and the output is still atomic:
one rule per distinct declaration, shared by every element that uses it. On this
repository's three apps the Rust compiler built within 3 % of Tailwind's time and
2.9× faster than the StyleX port, with the smallest gzipped CSS of the three
(advisory: one machine, `packages/kirana/design-notes/benchmark-results.md`).

## What StyleX got right, and what Kirana adds

StyleX, which Meta open-sourced at the end of 2023, showed that compiled, atomic
CSS-in-JS works at scale. Kirana keeps its premise: atomic output, constants
that cost nothing until used, styles as values passed through one prop, and
`light-dark()` colours.

The same shadcn/ui app, ported from Tailwind to StyleX (0.19) for comparison,
shows these problems, each measured and written down with evidence. Kirana
answers them:

| In the StyleX port                                                                                                                              | In Kirana                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No descendant selectors: every `[&_svg]` became a custom property handed down and read by the child                                             | [`select.child` / `select.descendant`](/docs/styling/contextual), in a layer below the target's own styles, so the child's own size still wins                                                       |
| A marker on the wrong element compiled and never matched, 36 times                                                                              | [Relations](/docs/styling/relations) are declared; a read without an anchor, or an anchor that cannot match, is a compile error                                                                      |
| A shorthand lost to a longhand regardless of order (`padding: 0` did not beat `paddingTop`)                                                     | Styles [merge per longhand](/docs/styling/merging)                                                                                                                                                   |
| `default: null` removed a value where the author meant "nothing here"                                                                           | Omitting keeps; `base: null` removes, and only when you write it                                                                                                                                     |
| `@media` outranked `:hover` and attributes, the reverse of Tailwind                                                                             | One ladder, stated and [traceable](/docs/tooling/debugging): state beats breakpoint, as in Tailwind                                                                                                  |
| Custom-property assignments were emitted unlayered and beat conditions beside them                                                              | Nothing is emitted outside a layer                                                                                                                                                                   |
| Tokens had to live in `*.stylex.ts` files and be imported by name                                                                               | Tokens are ordinary exports, imported any way TypeScript allows                                                                                                                                      |
| `sx` passed to a component that ignores it, or spread past a wrapper, was silent                                                                | `sx-on-external-component` and `unused-sx`, including one module away                                                                                                                                |
| Six silent bug classes needed a hand-written checking script; the lint plugin lagged the compiler and was turned off after ~150 false positives | [45 diagnostics](/docs/tooling/diagnostics) come from the compiler itself; the [lint plugin](/docs/tooling/lint) reads the compiler's own validation instead of re-implementing it |
| The official compiler is Babel; the Rust one is a community port behind it                                                                      | The engine is Kirana's own, in Rust on [oxc](https://oxc.rs), with a WASI build that writes the same bytes where no native one runs                                                                  |
| No utility vocabulary: a Tailwind team rebuilt the scales by hand                                                                               | [`@kirana-style/preset-scales`](/docs/tokens/preset-scales) is Tailwind v4's scales, and [utility strings](/docs/styling/utilities) compile to the same atoms as the object form                     |
| A port from Tailwind was done by hand                                                                                                           | [`kirana migrate tailwind`](/docs/migration/from-tailwind), measured below                                                                                                                           |

Framework reach is the other half: `sx` works in React, Preact, Solid, Qwik, Vue, Svelte, Astro, Angular and Ember (Angular
templates take it as a directive, Ember's as a helper), and Kirana has adapters
for Vite, Rolldown, webpack, Rspack, Rsbuild, Parcel, Bun and esbuild, with Next.js on Turbopack or webpack. See
[frameworks](/docs/frameworks/overview).

StyleX has things Kirana does not: it is published, used in production at Meta
and elsewhere, and has a community. [Migrating from StyleX](/docs/migration/from-stylex)
is honest about that.

## Why not Tailwind and `cn()`?

Tailwind is excellent, and Kirana borrows its vocabulary on purpose. What Kirana
replaces is the merging. A component library built on Tailwind lets callers
override styles by appending classes, and resolves conflicts at runtime with
tailwind-merge (`cn()`), which parses class strings in the browser and keeps the
last class of each conflict group. Measured with tailwind-merge 3.6.0:

| Call                                  | Result                  | What happened                                                                                           |
| ------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `twMerge("px-2 py-1", "p-3")`         | `p-3`                   | Correct: the later padding replaces both axes                                                           |
| `twMerge("text-sm", "text-[0.8rem]")` | `text-[0.8rem]`         | `text-sm` is deleted whole, so its paired **line height** goes too, and the element now inherits one    |
| `twMerge("shadow-sm", "shadow-glow")` | `shadow-sm shadow-glow` | A custom value it was not told about is not a conflict; CSS source order decides which shadow shows     |
| `twMerge("text-sm", "text-brand")`    | `text-sm text-brand`    | It cannot know whether `text-brand` is a size or a colour without configuration (`extendTailwindMerge`) |

None of these is a bug in tailwind-merge; it works from class names, because
class names are all it has. Kirana merges **declarations**, at build time, per
longhand: `fontSize` and `lineHeight` are separate entries, a custom token is a
typed value, and there is nothing to configure or parse at runtime. And a typo
(`text-smm`) is a compile error, not a class that silently does nothing.

## "It doubles the code"

It is the most common first reaction, and it is true in one sense: a style object
takes more **lines** than a class string. It does not contain more **meaning**.

```tsx
// Tailwind: one line, read left to right
<button className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50" />

// Kirana: the same declarations, one per line
const button = css({
  display: "inline-flex",
  alignItems: "center",
  gap: space[2],
  borderRadius: radius.md,
  paddingInline: space[4],
  paddingBlock: space[2],
  fontSize: fontSize.sm,
  lineHeight: lineHeight.sm,
  fontWeight: fontWeight.medium,
  backgroundColor: { ":hover": theme.accent },
  opacity: { ":disabled": 0.5 },
})
```

Tailwind is **horizontal**; Kirana is **vertical**. The vertical form earns its
lines:

- **Diffs and reviews show one change per line.** Changing the padding changes
  one line, not a 120-character string where the reviewer hunts for `px-4`.
- **Conditions group by property.** Everything that can happen to the background
  colour is in one place; in a class string, its `bg-` utilities and their
  `hover:`, `dark:` and `data-[state=open]:` forms can sit anywhere in the line.
- **Nothing is implicit.** `text-sm` sets two properties; the object says so.
  The single most common drift in our port was a font size without its line
  height.
- **Every key and value is typed.** Autocompletion, go-to-definition on tokens,
  rename, and errors before the build.
- **Styles have names.** `styles.header` says what it is for; the markup stays
  readable because the styling is not inline in it.
- **Comments fit.** A line can say why a value is what it is.

And you do not have to choose one form for a whole project. With the scales
preset, `sx="px-4 py-2 text-sm"` is valid Kirana and compiles to the same atoms as
the object. Use strings where a short line reads best and objects where a
component has states. The compiler also does not care how long your source is:
the output is atomic either way, and a declaration used in a hundred components
is still one rule.

## Where Kirana costs you something

- **It is pre-release.** Not published to npm yet; see
  [what works today](/docs/project/status).
- **It is a compiler.** Styles must be statically known in shape: a computed key
  or a spread object is an error, and a value the compiler cannot enumerate goes
  through a custom property.
- **It is stricter than CSS.** Contextual rules rank below the target's own
  styles, and two conditions that tie are reported instead of left to source
  order. That is what makes the result predictable, and it is why a migration
  from Tailwind needs a few hand fixes (the [migration guide](/docs/migration/from-tailwind)
  lists every one we met).
- **The richest editor is VS Code.** Every LSP editor gets the card, the hints
  and the fixes; the Style Inspector, Style Fold and coloured hints are VS
  Code's. The extensions are not on the marketplaces until the first release.
