---
name: kirana-migrate
description: Migrate a codebase from Tailwind CSS (including shadcn/ui, cn() and class-variance-authority) or from StyleX to Kirana (@kirana-style/core). Use when asked to port, convert or move components or a whole app to Kirana, to run kirana-style migrate tailwind or kirana-style migrate stylex, or to fix styles that changed after such a port. Covers the codemods, their reports, the hand fixes they leave, and how to prove the port renders the same.
---

# Migrating to Kirana

Install and wire Kirana first (`npx kirana-style@latest init`, then `npx kirana-style doctor`), and read the `kirana`
skill: its rules apply to the migrated code. Migrate on a branch, keep the original build runnable
beside it, and port in small steps.

## The process

1. **Give the project its vocabulary first.** For Tailwind, add `@kirana-style/preset-scales` to
   `kirana.config.ts` (`import scales from "@kirana-style/preset-scales/preset"`, a default export,
   then `presets: [scales()]`) and point `utilities.scales.color` at the theme module, so
   `space[4]`, `color.zinc500` and `breakpoint.md` mean what they meant. Declare
   shadcn's `@custom-variant`s under `utilities.variants`, or pass the CSS file to the codemod.
2. **Dry-run the codemod, read the diff and the report:**
   ```bash
   npx kirana-style migrate tailwind src src/globals.css   # Tailwind: sources plus the CSS that declares variants and utilities
   npx kirana-style migrate stylex src                     # StyleX
   ```
   Add `--report migration.md` to keep the report. Every report item is something the codemod
   refused to guess; for Tailwind it is also left as a `// tailwind:` comment beside the style.
3. **Apply it:** the same command with `--write`.
4. **Resolve the report by hand,** with `references/tailwind-map.md` or `references/stylex-map.md`.
5. **`npx kirana-style check src` until it is clean** (`--format json` to work through the list). `sx-on-external-component`, `unused-sx`,
   `relation-without-anchor` and `ambiguous-precedence` are the diagnostics a port produces; the
   `kirana` skill's diagnostics reference says what to do about each. After a StyleX port, expect
   `mixed-logical-physical` too: StyleX's own property names hid it until the codemod renamed them.
6. **Prove it renders the same.** Compare **computed styles**, not screenshots: for each element,
   read `getComputedStyle` in the original build and the Kirana build, in light and dark, at a few
   widths, with overlays open and rows hovered. A 1 px border, an easing curve and a missing hover
   state are invisible in screenshots. When the original is the one that is wrong, fix it there.
7. **Keep hand fixes as patches** over a fresh codemod run when the codemod may be re-run.
8. **Clean up:** `npx kirana-style analyze src` lists tokens nothing reads any more and values bridged
   to runtime (an arbitrary value the codemod could not make static); remove the first, and turn the
   second into a finite set where the values are known.

Port leaf components first, and keep the markup structure identical: change only how styles are
expressed, so a difference means something.

## The traps, both directions

- **Merging is per entry.** Tailwind's `cn("p-2", "p-4")` kept the last class; StyleX replaced a
  whole property. Kirana replaces only the entries a later style names, so a component's
  conditional entry (`'[data-orientation="vertical"]'`) survives a caller's plain value. Write the
  override under the same condition, or clear first with `{ "*": null, base: value }`.
- **StyleX `default: null` is not Kirana `base: null`.** In StyleX it meant "nothing here"; in
  Kirana it _removes_ an earlier base value. The codemod drops it; if you port by hand, omit the key.
- **A `className` that still reaches a migrated component replaces its styles.** The component now
  reads `sx`; take `className` out of props that libraries hand in (react-day-picker's
  `components` is a known case).
- **Installed components do not read `sx`.** Base UI and Radix parts get
  `{...styleProps(a, sx)}` (`props as styleProps` from `@kirana-style/core`).
- **A parent's rule no longer beats the child's own.** `select` blocks rank below the target's own
  styles. When the parent must win, let the target read the parent (a relation, or a condition on
  its own position such as `':is([data-slot="field"] > *)'`).
- **Dark mode moves into tokens.** A colour's `dark:` becomes a `light-dark()` pair; where the old
  theme switch set `.dark`, apply `mode.dark` too.
- **No preflight.** Tailwind gave every border a colour and reset margins; name what you need.
- **Type sizes come with line heights.** `text-sm` set both; write both.

## More

Full guides: https://kirana.style/docs/migration/from-tailwind.md and
https://kirana.style/docs/migration/from-stylex.md.
