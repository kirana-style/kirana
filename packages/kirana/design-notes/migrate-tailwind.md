# `kirana-style migrate tailwind` (2026-09-23)

KRN-API-013's second codemod, and M5 phase 2. It rewrites the mechanical half of a Tailwind
migration and reports the other half, like `kirana-style migrate stylex`:

| Rewrites                                                        | Into                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------- |
| A static class string (`className="…"`, an argument of `cn`)    | `css({…})` objects, with the preset's tokens          |
| `cn(…)` / `clsx(…)` in `className`                              | an `sx` array (`sx={[a, open && b, sx]}`)             |
| `cva(base, { variants, compoundVariants, defaultVariants })`    | `recipe({…})`                                         |
| `group/name` + `group-*/name:` and `peer/name` + `peer-*/name:` | a `relation("name")`: its anchor and `within`/`after` |
| `[&_x]:`, `[&>x]:`, `*:`, `**:`                                 | `select.descendant(x)` / `select.child(x)`            |
| `space-x-2`, `divide-y`, `divide-border`                        | a `select.child(":not(:last-child)")` block           |
| a component's `className` prop                                  | `sx`, passed on                                       |

## One lowering, two outputs

The codemod does not have a second Tailwind parser. The utility surface's lowering
(`design-notes/utility-surface.md`) moves into its own crate, `kirana_utility`, and becomes generic
over what a value is:

- the **engine** turns each value into an IR value (the scale's token), as it does today;
- the **codemod** turns it into **source**: `space[4]`, `color.blue[600]`, `"center"`,
  `` `calc(${space[2]} * -1)` ``, with the import the expression needs.

Both read scales through the same resolution, so which utilities exist, which rule of a mixed root
(`text-sm` against `text-blue-600`) applies and what a key's path is (`blue-600` is
`color.blue[600]`) are decided once. The consequence worth having: **the object the codemod writes
compiles to the same atoms as the utility string it came from**, which the property test already
proves equal to the hand-written object. A codemod test compiles both and compares. The one exception
is a composed utility on an element nothing else can add a layer to, written resolved (below): its
atoms are the resolved values', which compute to what the composition computes there.

The grammar comes from the project's configuration, exactly as for utility strings: the codemod
runs in the project being migrated, with `@kirana-style/preset-scales/preset` listed and the application's
own scales (`bg-primary` → its theme) under `utilities`. A project without a grammar gets an error
that says to add one first.

## Where the objects go

Each class string becomes a named entry of one `styles` object per module, declared after the imports,
because a `css()` call reads best by name, and that is how this repository's own components are
written. The name is the element's `data-slot` (`card-header` → `cardHeader`), else the enclosing
component and the tag (`cardSpan`), numbered when taken, always a valid identifier. A `cva` becomes a
`recipe` under the `cva`'s own name; its `className` option in a call (`buttonVariants({ size,
className })`) becomes an `sx` item of its own, since a recipe takes only its variants.

Token imports are named after their exports, unless the file already has that name — two modules
exporting `color`, or the file's own `color` import — and then after the module (`color as
themeColor`). Only what the rewritten file names is imported or declared.

A recipe is a style wherever it is called: `buttonVariants()` imported from the migrated file that
declares it (found by the survey) becomes an `sx` item like a local one, not a class string.

A relation a `cva` anchors (`group/tabs-list`) cannot live in the recipe, which holds styles, not
handles; every call of the recipe applies it instead (`sx={[tabsListGroup.anchor, tabsList({…})]}`).
A joiner call where a class string is wanted — react-day-picker's `classNames={{ day: cn(…) }}`, Base
UI's `className={(state) => cn(…)}` — becomes `styleProps(…).className`.

A relation anchored in one file and read in another (`group/menu-button` on the sidebar's button, read
by an app's menu) is one relation: the command surveys every file first, the anchoring file exports
it, and each reader imports it — relatively within a package, and through the other package's
`exports` across packages. A relation anchored in no migrated file is reported.

A wrapper — a component that destructures `{ ...props }` without `className` and spreads them into
an installed component (`<Collapsible.Root {...props} />`) — takes `sx` and applies it through
`{...styleProps(sx)}`, when some migrated file passes that component a class; a provider nobody
styles is left alone. Spread into a host element (`<form {...props}>`), it passes `sx={sx}`: the
compiler reads `sx` as an element's own attribute, not from a spread (`sx-on-external-component`). An installed part that renders one of the project's components (`<ChipRemove render={<Button />}
className="…">`) is that component's element, so the part's styles become the component's `sx`
(`render={<Button sx={…} />}`): a class the part merged into the component's props would replace the
component's own, since its props spread comes after them. Only when the rendered element has no
class, `sx` or `data-slot` of its own. A class string in another class prop (`containerClassName="md:col-span-2"`) is compiled where it
stands, `{styleProps(styles.x).className}`: it stays a class string, which reaches `cn()` or an
installed component as the Tailwind classes did; so is each static string of a class map
(`classNames={{ day: "…" }}`, `modifiersClassNames={{ booked: "…" }}`). A module constant holding a class string (`const LABEL = "…"`) used as a class
becomes `css({…})` in place.

A component that some file renders through a part's `render` prop (`<Trigger render={<Button />}>`) is
handed the part's class by Base UI, as a `className` in its props; the original merged it through
`cn()`. So such a component (found by the survey) keeps `className` beside `sx` and passes it on:
`{...styleProps(…, sx, typeof className === "string" && className)}` on an installed component,
the same on a host element (beside `sx`, the compiler would merge it first, where `cn(own,
className)` put it last), and `className={className}` passed on to another of the project's components. `cn()` dropped a function of state the same way. A
render target passing its class on to another of the project's components makes that one keep it too
(the survey closes over these forwards), or the inner component would drop it the same way.

A component's `className` prop becomes `sx` in its parameters and wherever it is passed, and in its
own props type when that declares it (`{ className?: string }` → `{ sx?: Sx }`, a nested object's
`className` left alone). On an
element or a project component the result is `sx={…}`; on a component from an installed package
(Base UI parts), which does not read `sx`, it is `{...styleProps(…)}`, decided by resolving the
import. What stays a runtime class string (`cn(props.id, "p-2")`) stays in `className`, beside the
`sx`, and the compiler merges the two.

## Beyond the grammar

What the utility surface refuses, because a string cannot say it, an object can:

- **relations**: `group/card` anchors `cardGroup = relation("card")`; `group-hover/card:` reads
  `[cardGroup.within(":hover")]`, `peer-disabled/field:` reads `[fieldPeer.after(":disabled")]`;
- **`in-data-[slot=x]:`**: inside any element written with `data-slot="x"`. The survey finds those
  elements; each anchors `inX = relation("in-x")` (in its class list, or as an attribute of its own),
  and the reader's condition is `[inX.within()]`. A `data-slot` nobody reads anchors nothing;
- **contextual targets**: `[&_svg]:` and `**:` are `select.descendant`, `[&>svg]:` and `*:` are
  `select.child`; the variant after `*:` names the target (`*:data-[slot=x]:` is
  `select.child('[data-slot="x"]')`), and shadcn's `:not([class*='size-'])` guards are dropped (a contextual rule already loses to the element's own size). A `w-` or `h-` guard is reported when dropped: in Tailwind it also let a child opt out through `max-w-*` or `min-h-*`, which set no width of their own, so such a child needs `width: auto`;
- **contextual rules on a `data-slot` target, inverted**: Tailwind let a parent's `*:data-[slot=x]:w-full`
  beat the target's own `w-fit`; a `select` block ranks below it (D-016), which stays. So when the
  parent is known — an element written with `data-slot="p"`, or a recipe's base applied by elements of
  one `data-slot` — and the elements with `data-slot="x"` have a class list or recipe of their own,
  the rule leaves the parent and every such element carries it under a condition on its position:
  `width: { ':is([data-slot="p"] > [data-slot="x"])': "100%" }` (`" "` for a descendant, and conditions
  after the target kept), in source order so the later of two on one property wins as it did. The
  survey finds both ends across files. A rule whose `:not([class*=…])` guard the codemod drops stays with
  the parent: on the target it would beat the class a caller passes. Not inverted, and reported when
  outranked: a parent with no `data-slot` or a recipe's variant, a target with no styles of its own,
  `dark:`, `!` and arbitrary properties;
- **child rules**: `space-x-2` and `divide-y` style every child but the last at zero specificity in
  Tailwind 4 (`:where(& > :not(:last-child))`), so a child's own margin wins; a
  `select.child(":not(:last-child)")` block does the same. Values come from the grammar's `me-*`,
  `mb-*` and `border-*`, so the margin is the same token; `*-reverse` and a child rule under a variant are reported;
- **arbitrary properties**: `[content-visibility:auto]` is `contentVisibility: "auto"`, with Tailwind's
  `--spacing(n)` as `n` steps of the grammar's own `space[1]`;
- **`dark:`**: every Kirana colour is a `light-dark()` pair, so a colour's `dark:` value is paired with
  the value at the same or the enclosing conditions into `light-dark(light, dark)` (a background with
  none pairs with `transparent`). Any other property gets a `{ light, dark }` token in a file-level
  group (`modes`), light half from the same place or `initial`; per-mode tokens follow the color scheme
  and Kirana's `mode` handles.
- **`dark:` outranks the states it encloses**: Tailwind prints `dark:` after the state variants, so
  `dark:bg-input/30` beats `aria-expanded:bg-muted` in dark mode. A colour's state entry with no
  `dark:` value of its own takes the dark half of the nearest enclosing one
  (`light-dark(muted, input/30)`); at-rules (`md:`) keep their value.
- **tailwind-merge's pair deletion in a `cva`**: an option setting a size alone (`text-[0.8rem]`) over
  a base `text-sm` removes the base's paired line height (`lineHeight: null`), as `cn()` deleted the
  whole base utility.
- **composed utilities, resolved where nothing else composes** (KF-076): Tailwind's layers
  (`--tw-ring-shadow`, `--tw-translate-y`, `--tw-grayscale`, `--tw-border-style`) combine across the
  classes of one element, and with a component's own classes when the element is a component that
  merges the class it is given. A host element whose `className` is one static class list (a string,
  or a joiner of static strings only), without spread props or a contextual rule moved onto it, can
  receive no other layer, unless a contextual rule elsewhere sets one: the survey records every layer a
  `select` block sets or reads, and those stay composed. There each property reading layers is written
  resolved, per condition: a layer set under the same or fewer conditions is substituted, an unset one
  takes its registered initial value (`0`, `solid`, `currentcolor`, nothing for a filter step), and a
  comma-separated item that reads only unset layers is left out (`box-shadow`'s four `0 0 #0000`). A
  layer under other conditions (`md:ring-2 hover:ring-4`), one set without the property that reads it
  (`ring-1 hover:ring-blue-600`), or one set by `dark:` keeps the composition. A layer is a registered
  token that does not inherit, read from the evaluated token module. Components, recipes, constants,
  other class props and `lowerTailwind` keep the composition, so a caller's `border` over a component's
  `border-dashed` stays dashed, as in Tailwind.

## What it reports instead of guessing

A report item leaves the utility in a comment beside the object (`// tailwind: … — reason`), never
silently dropped:

- **`!important` under a variant** (`hover:size-3!`): Kirana has no `!important`; the ladder decides.
  Without a variant (`p-0!`), it is rewritten as `{ "*": null, base: … }`, which removes every other
  value of that property — what `!important` achieved against the component's own entries.
- **custom variants and utilities** from the project's CSS (`@custom-variant data-open`, `@utility
  no-scrollbar`), which the command reads from the CSS files among its paths: declare them under
  `utilities.variants` / `utilities.utilities` and run again. Without that list, `data-open:` would
  silently get Tailwind's default meaning (`[data-open]`) instead of shadcn's.
- **a contextual target under a condition of the element itself** (`focus:**:text-x`,
  `group-data-[size=sm]/avatar:[&>svg]:size-3`) and **a state of the target** (`*:hover:`): `select`
  blocks carry no condition of either end (KRN-CAS-006).
- **a contextual rule the target outranks** (`*:data-[slot=field-label]:w-full` where the label
  writes `w-fit`): Tailwind's parent rule won, a `select` block ranks below the target's own styles
  (D-016). The survey records what each `data-slot` element's own class list and recipe set; a block
  targeting that slot and setting an overlapping longhand (to another value, or under a condition) keeps its entry and is reported, to be read
  from the target instead (as the migrated button group does).
- **targets that are not elements or attributes** (`[&_.recharts-dot]`, `[&>a:hover]`).
- **`in-*`** other than `in-data-[slot=…]` (`in-data-[side=left]`): an ancestor's state with no element
  to anchor; declare a relation.
- **a colour's `dark:` without any value at rest** to pair with (other than a background).
- **a relation read in one file and anchored in another**, and **a recipe that anchors one**
  (`group/badge` in a `cva`): the anchor must be applied where the recipe is used.
- **dynamic class strings**, cva's dynamic `className` option, and a `className` function of state.
- **a class string left on a project component** (`<Button className={cn(defaultClassNames.day)}>`):
  the migrated component reads `sx`, so the class reaches its props, and their spread replaces the
  class its own styles compiled to. The same happens when a library hands a migrated component a
  `className` (react-day-picker's `components`), which no file shows; drop or restyle it by hand.

Planned in KRN-API-013 and **not built**: `cn` conflict deletions that dropped a paired value, and
wrapper components' default props. Both need knowledge beyond one class string (tailwind-merge's
conflict table; the wrapped component's defaults) and stay with the person doing the migration.

Nothing is written without `--write`; the report is printed either way.

## Measured on the Tailwind original (2026-09-23)

328 files (packages/ui, shell, and the web, blocks and examples apps), with the preset, the Kirana
theme as the colour scale and shadcn's nine custom variants declared:

| Step                                                               | Report items | Compile errors after `--write` |
| ------------------------------------------------------------------ | -----------: | -----------------------------: |
| First run (phase-1 grammar)                                        |        1,183 |                              — |
| Pseudo-elements, `(--x)`, numbers, `rtl`, containers, `nth-*`, …   |          594 |                              — |
| Composed utilities (`ring`, `shadow`, `translate`, `scale`)        |          503 |                            134 |
| Arbitrary properties; `*:` targets named by the next variant       |          535 |                              8 |
| Filters, animations (D-059), `transform`, `scroll-*`, `contain`, … |          321 |                              8 |

(The fourth row gains items because `select.child("*")` is no longer written: Kirana rejects it, and
those 121 compile errors became report items.) The 8 remaining errors are the reported
`relation-without-anchor` cases. Of the 321 items, 63 are `!important`, 91 contextual targets `select` cannot
express (under a condition of the element, a state of the target, or a class target), 32 `dark:` values
that need a `{ light, dark }` token, 23 relations to check across files, 17 `in-*` and 15 dynamic class
strings.

## Proof

- `crates/kirana_migrate/tests/tailwind.rs`: the fixture (`fixtures/migrate-tailwind/`) as a snapshot,
  and every rewrite path.
- The atoms test in the same file: for class strings covering scales, colours with alpha, negatives,
  fractions, numbers, composed `ring`, `border`, `translate` and filters, pseudo-elements, containers
  and attribute variants, the string lowered on its own (`lower`, which keeps every composition)
  compiles to exactly the atoms of the same string as `sx`.
- The exit (KRN-TEST-008): migrate the Tailwind original's apps, resolve the report, build, and pass
  conformance against the Tailwind twin.
