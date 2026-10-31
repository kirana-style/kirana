# Relations
Source: https://site.kirana-style.workers.dev/docs/styling/relations

# Relations

Sometimes an element's style depends on _another_ element's state: a label that
dims when its field is disabled, an icon that rotates when its menu is open.

A relation names that connection once, and both ends refer to it:

```tsx
import { css, relation } from "@kirana-style/core"

export const field = relation("field")

const styles = {
  root: css({ display: "grid", gap: "0.25rem" }),
  label: css({
    opacity: {
      base: 1,
      [field.within('[data-disabled="true"]')]: 0.5,
    },
  }),
}

export function Field({ disabled, children }) {
  return (
    <div data-disabled={disabled} sx={[field.anchor, styles.root]}>
      <label sx={styles.label}>{children}</label>
    </div>
  )
}
```

`field.anchor` marks the element whose state is read. `field.within(state)` reads
it from a descendant.

<!-- ::figure-relation -->

## The four reads

| Read             | Means                                | Tailwind equivalent  |
| ---------------- | ------------------------------------ | -------------------- |
| `within(state?)` | the anchor is an **ancestor**        | `group-*`            |
| `parent(state?)` | the anchor is the **parent**         | `*:`, from the child |
| `after(state?)`  | the anchor is an **earlier sibling** | `peer-*`             |
| `before(state?)` | the anchor is a **later sibling**    | none                 |

The `state` argument is any selector the anchor may match, such as
`'[data-open]'`, `":hover"` or `'[data-size="lg"]'`. Omit it to mean "the anchor exists", which is
how you style by structure rather than state.

## Why declare it at all

Because the compiler checks it. Two errors you get for free:

- **`relation-without-anchor`**: a style reads a relation, but nothing applies
  its anchor. In a class-string system this is a `group-hover:` that silently
  never fires. An application's build checks the relations whose module it
  compiled, so a shared component may read an ancestor that only some
  applications render; `kirana-style check` checks every relation in the project.
- **`relation-placement`**: the anchor cannot be proven to be in the right
  position: `after()` used where the anchor is not an earlier sibling, for
  example.

A relation that is anchored and never read is reported too (`relation-unused`),
so dead relations do not accumulate, unless it is optional (below). One that its module keeps to itself is
checked in every build. One that is exported is checked where the whole project
is compiled, by `kirana-style check` and in your editor: a bundler build compiles
only the modules it reaches, so a shared component's reader may simply not be
in this application. And because a relation is identified by its
package and name, two modules of one package that both write `relation("card")`
would share one marker without meaning to: `relation-name-collision` names both
files. Export the relation from one module and import it where it is read.

A module that holds only the reads, with no `css()` of its own, compiles them too.

A component set installed one item at a time can have a reader whose anchor's
component is not installed: a select that fills the Field it sits in, in a
project without Field. It can also have an anchor whose readers are not
installed: a Tooltip that anchors a relation for the Kbd inside it, in a project
without Kbd. Declare that relation optional, and the read is left alone where no
anchor exists, where it never matches, and the anchor where nothing reads it:

```ts
export const fieldScope = relation("field", { optional: true })
```

Where both are installed, an optional relation is placed and checked like any
other; only the missing anchor or the missing reader is not reported.

### Nested in its own kind

A component can read its own relation to know it sits inside another of its
kind: shadcn/ui's FieldGroup tightens a group directly inside another group. The
group anchors the relation and reads it from the parent:

```tsx
const group = relation("field-group")

const styles = {
  group: css(group.anchor, {
    gap: { base: "1.75rem", [group.parent()]: "1rem" },
  }),
}
```

An element that carries an anchor and reads it can only mean an outer one, so the
placement check accepts it, for both kinds of ancestor read. A parent read reaches
the anchor's children only, where `within` reaches any depth: a port of `*:w-full`
written with `within` would also widen a grandchild inside a wrapper.

A read with a state there, such as a form that reads
`form.within('[data-disabled="true"]')`, is reported as `relation-read-on-anchor`,
an info: it never sees the form's own state, which a plain condition key reads.

The same holds beside it. shadcn/ui's `ItemContent` keeps its width when it
follows another, and its caller is the one that repeats it, so the part anchors
the relation and reads it `after()`:

```tsx
const content = relation("item-content")

const styles = {
  content: css(content.anchor, {
    flex: { base: "1 1 0%", [content.after()]: "none" },
  }),
}
```

The placement check accepts an `after()` or `before()` read on an element that
carries its own anchor: another instance beside it, which only the caller's tree
holds.

## Anchors are placed, not guessed

The anchor must sit on the element whose state you are reading. That sounds
obvious, and it is the most common mistake when porting: the state lives on the
root, the anchor gets attached to an inner wrapper, and the read never matches.

```tsx
// The attribute and the anchor belong on the same element.
<div data-state={open ? "open" : "closed"} sx={[menu.anchor, styles.root]}>
```

## `:has()` is not a relation

Styling a parent by its children is a plain condition, because the selector does
it on its own:

```tsx
css({
  paddingBlockEnd: { ":has([data-slot='footer'])": "0.5rem" },
})
```

Relations exist for the other direction (a descendant or sibling reading state
that lives elsewhere), where CSS needs the two ends to agree on a class.

## Precedence

A relation read is its own condition class, ranked below attributes and
pseudo-classes on the element itself, and above at-rules
([ladder](/docs/styling/precedence), step 3). So an element's own `:hover` beats a
value that depends on an ancestor's `:hover`, which is what an author usually
means.

A parent read is the exception: it ranks as a pseudo-class, as the
`:where([data-slot] > *)` selector it replaces does. A group inside another group
takes the nested gap over a style's wider one without restating it under every
style.
