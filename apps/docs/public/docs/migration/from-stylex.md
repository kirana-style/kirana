# Migrating from StyleX
Source: https://kirana.style/docs/migration/from-stylex

# Migrating from StyleX

If you write StyleX today, most of your styles are already Kirana styles: both
systems put typed style objects next to components and conditions inside values,
so the mapping below is close to mechanical. The differences that matter are in
merge semantics and in what the compiler checks.

## The mapping

Four names carry most of a StyleX codebase; the table after them has the rest.

<!-- ::figure-stylex -->

| StyleX                               | Kirana                                                    |
| ------------------------------------ | --------------------------------------------------------- |
| `stylex.create({ … })`               | `css({ … })` per style, or an object of handles           |
| `stylex.props(a, b)`                 | `props(a, b)`, or `sx={[a, b]}` on your own elements      |
| `stylex.defineVars({ … })`           | `defineTokens(namespace, { … }, { variable: true })`      |
| `stylex.defineConsts({ … })`         | `defineTokens(namespace, { … })`                          |
| `stylex.createTheme(vars, { … })`    | `defineTheme(tokens, { … })`                              |
| `stylex.keyframes({ … })`            | `keyframes({ … })`                                        |
| `stylex.firstThatWorks(a, b)`        | [`firstThatWorks(a, b)`](/docs/styling/fallbacks)         |
| `stylex.positionTry({ … })`          | [`positionTry({ … })`](/docs/styling/anchor-positioning)  |
| `stylex.viewTransitionClass({ … })`  | [`viewTransition({ … })`](/docs/styling/view-transitions) |
| `stylex.when.hover` and markers      | [`relation()`](/docs/styling/relations)                   |
| `default:` inside a value            | `base:`                                                   |
| `@media (…)` as a key inside a value | the same, or `[media("…")]`                               |

## The difference that bites

In StyleX, `default: null` inside a variant means **"this variant sets nothing
here"**. In Kirana, `base: null` **removes** a base value an earlier style set.

```tsx
// StyleX: "no default value for this variant"
{ color: { default: null, ":hover": "blue" } }

// Kirana: "delete any base colour that was set before me"
{ color: { base: null, ":hover": "blue" } }
```

A codemod cannot tell which you meant, so it does not try. Port these by hand:
if the intent was "nothing here", **omit the key**.

## What Kirana has that StyleX does not

The mapping above is close to one-to-one because both systems share a premise.
These are the things that have no StyleX counterpart, and between them they are
most of the reason Kirana exists.

**A stated precedence ladder, and a tool that reads it back.** StyleX offers two
modes (later-wins and property-specificity), and neither reproduced what the
Tailwind components needed. Kirana has one ladder, and `kirana-style trace file:line
property` prints every candidate declaration, the winner, and the step that
decided it.

**Ambiguity is reported.** When two values could both apply and nothing orders
them, the compiler says so (`ambiguous-precedence`) instead of silently picking.
`conditions.exclusive` is how you tell it that a library never sets two
attributes together.

**A diagnostics catalogue.** 50 codes with stable names, severities and help
text, and a configuration key to re-level the non-errors. StyleX reports
compilation failures; it does not have a catalogue you can suppress, raise, or
look up.

**Relations are declared and checked.** `relation("field")` gives you an anchor
and four reads, and the compiler errors when a relation is read but never
anchored (`relation-without-anchor`) or anchored in a position that cannot match
(`relation-placement`). StyleX's `when.*` with marker classes compiles either
way, and a mis-placed marker is a rule that silently never fires.

**Contextual styles have a layer of their own.** `select.descendant("svg")` lands
below element styles, so the target's own style always wins, with no hand-down
custom properties and no `:not([class*='size-'])` guards.

**`sx` is checked where it is used.** Passing it to a component that does not read
it is reported (`sx-on-external-component`), including one module away through a
rest spread, and a component that takes it and drops it gets `unused-sx`.

**Colour modes without plumbing.** Every colour is one `light-dark()` pair and
`mode.system` needs no JavaScript at all. StyleX needs a theme per mode and a
mechanism to switch it.

**Registered tokens.** A token declared with a `syntax` emits `@property`, so a
custom property can be animated and used as a keyframe key.

**Layers you control.** `layers.before` / `layers.after` place your reset and
vendor CSS around Kirana's own layers, and nothing is emitted unlayered, including
custom-property assignments, which StyleX leaves outside any layer.

**A branch budget for dynamic values.** A finite set of runtime values compiles
to a class expression, an open value to a custom-property bridge, and exceeding
the budget is an error rather than a combinatorial explosion.

**Tailwind's vocabulary, if you want it.** [`@kirana-style/preset-scales`](/docs/tokens/preset-scales)
is Tailwind v4's scales as tokens, and [utility strings](/docs/styling/utilities)
(`sx="px-4 text-sm"`) compile to the same atoms as the object form. StyleX
leaves the vocabulary to you.

**Hosts and frameworks.** Adapters for Vite, Rolldown, webpack, Rspack, Rsbuild, Parcel, Bun and esbuild; `sx` in
React, Preact, Solid, Qwik, Vue, Svelte, Astro, Angular and Ember and every framework built on them (React, Next.js, React Router, TanStack Start, Gatsby, Remix, Waku, Vike, Docusaurus, Preact, Solid, SolidStart, Vue, Nuxt, VitePress, Svelte, SvelteKit, Astro, Qwik, Angular, Ember and Meteor); and
templates in Laravel, Symfony, Rails, Phoenix and AdonisJS, each with an example CI builds and checks. See
[frameworks](/docs/frameworks/overview).

The longer argument, with the StyleX port's problems and what answers each, is
[Why Kirana](/docs/start/why-kirana#what-stylex-got-right-and-what-kirana-adds).

## What StyleX has that Kirana does not

Fairness matters more than a feature list:

- **It is published, versioned and used in production** at Meta scale. Kirana is
  at a 0.x version.
- **A larger ecosystem**: community plugins, documentation, examples, articles and people who have
  already hit your problem.
- **A few helpers** have no direct equivalent, `stylex.when.descendant` and
  `stylex.when.anySibling` among them; write a `:has()` condition.
  `kirana-style migrate stylex` names each one it meets in its report.

If you need a styling compiler in production this quarter, StyleX is the
defensible choice. Kirana is worth it when predictability and diagnostics are the
thing you are missing.

## What else is different

**Precedence.** StyleX has two modes (later-wins and property-specificity), and
neither reproduced what the Tailwind components needed. Kirana has one
[ladder](/docs/styling/precedence), and reports the cases it cannot order instead
of picking silently.

**Relations are declared.** StyleX's `when.*` and marker classes become a
`relation()` with an `anchor`, which the compiler then _checks_: a read with no
anchor is an error rather than a rule that never matches.

**Contextual styles have a layer.** `select.descendant("svg")` lands below element
styles, so a child that sets its own size keeps it, with no hand-down custom
properties and no guards.

**Everything is layered.** StyleX left custom-property assignments unlayered;
Kirana emits nothing outside its layers.

## The codemod

> [!TIP] Porting with a coding agent
> The [`kirana-migrate` skill](/docs/project/agent-skills) gives an agent this
> page's process: the codemod and its report, the traps, and how to prove the
> port renders the same.

```bash
kirana-style migrate stylex src          # print the diff and the report
kirana-style migrate stylex src --write  # apply it
```

It makes the mechanical rewrites, renames `*.stylex.ts` files, and prints a report
of everything it would not decide:

| StyleX                | Kirana         |
| --------------------- | -------------- |
| `create`              | `css`          |
| `defineVars`          | `defineTokens` |
| `createTheme`         | `defineTheme`  |
| markers               | `relation`     |
| `{...stylex.props()}` | `sx`           |

Two follow-up passes still live as scripts in the compiler's repository:

- `{...props(a, b)}` on an element you own becomes `sx={[a, b]}`;
- `sx` on a component from a package becomes `{...props(…)}`, because those never
  read `sx`.

## After the codemod

Work through the report, then let the compiler finish the job: `kirana-style check`
will find the relations without anchors, the components that swallow `sx`, and the
ambiguous pairs. Fix those and the port is done.
