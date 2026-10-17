/**
 * The private runtime (KRN-DYN-005, D-018). The compiler imports it; applications never do.
 *
 * A compiled handle is a class string, or `{ c, v }` when it carries bridged custom properties.
 * Kirana class names are `{prefix}{key}_{value}`: merging keeps the last class per key, a
 * `{prefix}{key}_` tombstone removes one key, and `{prefix}{property}*_` removes every key of a
 * property, and `{prefix}{shorthand}/{codes}{scope}_` unfolds a shorthand atom into longhands.
 * Classes without the prefix pass through in order.
 */

import { FOUR, TWO } from "./families.generated.ts"

/** A base-62 property code (`0-9a-zA-Z`) for an index, as class names spell them (D-037). */
const code = (index: number): string =>
  (index > 61 ? code((index / 62) | 0) : "") +
  String.fromCharCode(
    (index %= 62) < 10 ? index + 48 : index < 36 ? index + 87 : index + 29
  )

/** `key` is `base`, or — for every condition set — `base` plus `-` and a 4-character condition hash. */
const scoped = (key: string, base: string, every: boolean) =>
  key === base ||
  (every && key.startsWith(base + "-") && key.length === base.length + 5)

export type Handle =
  | string
  | { readonly c: string; readonly v: Readonly<Record<string, string>> }
  | null
  | undefined
  | false
  | readonly Handle[]

/** A host element's props: its class attribute (`className` or `class`) and inline style. */
type Props = {
  className?: string
  class?: string
  style?: Record<string, string>
}

/** `c`: class per merge key, in merge order; `v`: bridged variables. */
type Merged = { c: Map<string, string>; v: Record<string, string> }

export type Recipe = {
  readonly s: readonly string[] | null
  readonly b: readonly string[]
  readonly v: Readonly<
    Record<string, Readonly<Record<string, readonly string[]>>>
  >
  readonly c: readonly (readonly [
    Readonly<Record<string, string>>,
    readonly string[],
  ])[]
  readonly d: Readonly<Record<string, string>>
}

export function runtime(prefix: string, attribute: string) {
  const add = (merged: Merged, handle: Handle): void => {
    if (!handle) return
    if (Array.isArray(handle)) {
      for (const inner of handle as readonly Handle[]) add(merged, inner)
      return
    }
    if (typeof handle === "object") {
      Object.assign(merged.v, (handle as { v: Record<string, string> }).v)
      handle = (handle as { c: string }).c
    }
    let classes = merged.c
    for (const token of (handle as string).split(" ")) {
      if (!token) continue
      const end = token.lastIndexOf("_")
      if (!token.startsWith(prefix) || end < 0) {
        classes.set(" " + token, token)
        continue
      }
      const key = token.slice(prefix.length, end)
      const head = key.split("-")[0]!
      if (!head[2]) {
        // A box family atom (or its tombstone) replaces its longhands, whose codes follow its own
        // (D-045).
        let index = 0
        for (const digit of head) {
          const unit = digit.charCodeAt(0)
          index = index * 62 + unit - (unit > 96 ? 87 : unit > 64 ? 29 : 48)
        }
        let size =
          index < FOUR
            ? index % 5
              ? 0
              : 4
            : index < TWO && !((index - FOUR) % 3)
              ? 2
              : 0
        while (size)
          classes.delete(code(index + size--) + key.slice(head.length))
      }
      const slash = key.indexOf("/")
      if (slash > 0) {
        // `{shorthand}/{kept codes}{target}{-conditions | *}`: replace earlier shorthand atoms by
        // atoms of the kept longhands in their place, reusing each atom's value segment (D-045).
        const every = key.endsWith("*")
        const tail = key.slice(slash + 1, every ? -1 : undefined)
        const dash = tail.indexOf("-") >>> 0
        const shorthand = key.slice(0, slash)
        const earlier = classes
        merged.c = classes = new Map()
        for (const [existing, atom] of earlier) {
          if (
            !atom.endsWith("_") &&
            scoped(existing, shorthand + tail.slice(dash), every)
          ) {
            const rest = existing.slice(shorthand.length)
            for (let kept of tail.slice(0, dash).split(".")) {
              // A longhand entry after the atom (not copied yet) was written after it and keeps its
              // value; one before it is the atom's own tombstone or an earlier, broader atom's value.
              if (classes.delete((kept += rest)) || !earlier.has(kept))
                classes.set(
                  kept,
                  prefix + kept + atom.slice(atom.lastIndexOf("_"))
                )
            }
          } else classes.set(existing, atom)
        }
      } else if (key.endsWith("*")) {
        // A target's own `-xyz*` tombstone has the length of a condition key and must survive.
        for (const existing of classes.keys()) {
          if (
            scoped(existing, key.slice(0, -1), true) &&
            !existing.endsWith("*")
          ) {
            classes.delete(existing)
          }
        }
      }
      classes.delete(key)
      classes.set(key, token)
    }
  }

  const merge = (handles: readonly Handle[]): Merged => {
    const merged: Merged = { c: new Map(), v: {} }
    add(merged, handles)
    return merged
  }

  /** Merges handles into one handle. */
  const cx = (...handles: Handle[]): Handle => {
    const merged = merge(handles)
    const c = [...merged.c.values()].join(" ")
    return Object.keys(merged.v).length ? { c, v: merged.v } : c
  }

  /**
   * Props already merged, by their inputs' text. An element renders the same few combinations over
   * and over (a table cell with no `sx` of its own is one), so each is merged once and shared, with
   * its `className`, by every element that renders it; past a bound the cache starts over, so text
   * built at runtime cannot grow it without end.
   */
  const settled = new Map<string, Props>()

  /** The props for a host element: foreign classes first, then handles; bridged variables last. */
  const sx = (
    handles: readonly Handle[],
    classNames: readonly unknown[],
    styles: readonly unknown[]
  ): Props => {
    const key = JSON.stringify([handles, classNames, styles])
    let props = settled.get(key)
    if (!props) {
      const merged = merge([
        classNames.filter((name) => typeof name === "string") as string[],
        handles,
      ])
      const className = [...merged.c.values()]
        .filter((token) => !token.endsWith("_"))
        .join(" ")
      const style = Object.assign(
        {},
        ...styles.filter((value) => value && typeof value === "object"),
        merged.v
      ) as Record<string, string>
      // Only the keys that carry something: spread after an element's own `style` or class
      // (`style={…} {...props(a)}`), an `undefined` would erase it.
      props = {
        ...(className ? { [attribute]: className } : {}),
        ...(Object.keys(style).length ? { style } : {}),
      }
      if (settled.size > 4095) settled.clear()
      settled.set(key, props)
    }
    // A copy: a caller may change what it is given, and the shared one must not change with it.
    return props.style ? { ...props, style: { ...props.style } } : { ...props }
  }

  /** A bridged value: `null` and `undefined` become `initial` so the declaration falls back. */
  const b = (c: string, variable: string, value: unknown): Handle => ({
    c,
    v: { [variable]: value == null ? "initial" : String(value) },
  })

  /** A recipe resolved at runtime from its compiled table. */
  const recipe =
    (table: Recipe) => (options?: Readonly<Record<string, unknown>>) => {
      const pick = (group: string) => {
        const value = options?.[group] ?? table.d[group]
        return value == null ? undefined : String(value)
      }
      const slots = (table.s ?? [""]).map((_, index) => {
        const parts: Handle[] = [table.b[index]]
        for (const group in table.v) {
          parts.push(table.v[group]![pick(group)!]?.[index])
        }
        for (const [selection, handles] of table.c) {
          if (
            Object.keys(selection).every(
              (group) => pick(group) === selection[group]
            )
          ) {
            parts.push(handles[index])
          }
        }
        return cx(parts)
      })
      return table.s
        ? Object.fromEntries(table.s.map((name, index) => [name, slots[index]]))
        : slots[0]
    }

  return { cx, sx, b, recipe }
}
