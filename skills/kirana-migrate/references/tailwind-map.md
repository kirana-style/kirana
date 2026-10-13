<!-- Condensed from https://kirana.style/docs/migration/from-tailwind.md; that page is the source of truth. -->

# Tailwind to Kirana

| Tailwind                                    | Kirana                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `flex items-center gap-2`                   | `{ display: "flex", alignItems: "center", gap: space[2] }`                            |
| `px-4 py-2`                                 | `{ paddingInline: space[4], paddingBlock: space[2] }`                                 |
| `text-sm`                                   | `{ fontSize: fontSize.sm, lineHeight: lineHeight.sm }`, always both                   |
| `bg-primary/80`                             | `{ backgroundColor: alpha.primary80 }`, a `color-mix` token                           |
| `hover:underline`                           | `{ textDecorationLine: { ":hover": "underline" } }`                                   |
| `md:grid-cols-2`                            | `{ gridTemplateColumns: { [breakpoint.md]: "repeat(2, minmax(0, 1fr))" } }`           |
| `dark:bg-zinc-900`                          | nothing: the colour token is a `light-dark()` pair                                    |
| `group-hover:opacity-100`                   | `{ opacity: { [group.within(":hover")]: 1 } }` with `const group = relation("group")` |
| `peer-checked:text-black`                   | `{ color: { [peer.after(":checked")]: "black" } }`                                    |
| `[&_svg]:size-4`                            | `{ [select.descendant("svg")]: { width: …, height: … } }`                             |
| `space-x-2`, `divide-y`                     | a `select.child(":not(:last-child)")` block                                           |
| `data-[state=open]:rotate-90`               | `{ rotate: { '[data-state="open"]': "90deg" } }`                                      |
| `cn(a, b)`                                  | `cx(a, b)`, or `sx={[a, b]}`                                                          |
| `cva({ variants })`                         | `recipe({ variants })`; `defaultVariants` carry over                                  |
| `className` prop on your components         | `sx?: Sx`, forwarded last                                                             |
| `p-0!` (important, no variant)              | `{ "*": null, base: 0 }`                                                              |
| `hover:size-3!` (important under a variant) | reported: put the value where it must win                                             |
| `[&:not([class*='size-'])]` guards          | deleted: the child's own size already wins                                            |
| `[.border-b]:pb-6` (reads a class)          | set the padding where the border is set                                               |

With the scales preset, a utility string is valid Kirana too (`sx="flex items-center gap-2"`) and
compiles to the same atoms; the codemod writes objects. Strings suit short layout lines; objects
suit anything with states or your own tokens.

## What the codemod reports instead of guessing

`!important` under a variant; undeclared custom variants and utilities; a contextual target under a
condition (`focus:**:text-x`); targets that are class names; `in-*` on anything but a `data-slot`;
a colour's `dark:` with no value at rest; relations anchored in no migrated file; a dropped `w-`/`h-`
guard; dynamic class strings; a `select` rule whose target sets the property itself.

## Variant order

Tailwind's stylesheet order decided between variants; Kirana's ladder decides instead: an attribute
outranks `:hover`, and two conditions beat one. Nest hover inside the attribute when both apply.
`kirana trace file:line property` shows the decision.
