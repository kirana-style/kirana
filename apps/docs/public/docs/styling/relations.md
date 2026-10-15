# Relations
Source: https://kirana.style/docs/styling/relations

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

## The three reads

| Read             | Means                                | Tailwind equivalent |
| ---------------- | ------------------------------------ | ------------------- |
| `within(state?)` | the anchor is an **ancestor**        | `group-*`           |
| `after(state?)`  | the anchor is an **earlier sibling** | `peer-*`            |
| `before(state?)` | the anchor is a **later sibling**    | none                |

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

A relation that is declared and never read is reported too (`relation-unused`),
so dead relations do not accumulate. And because a relation is identified by its
package and name, two modules of one package that both write `relation("card")`
would share one marker without meaning to: `relation-name-collision` names both
files. Export the relation from one module and import it where it is read.

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
