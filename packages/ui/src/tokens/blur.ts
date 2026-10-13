/**
 * Tailwind's blur scale, for `filter` and `backdrop-filter`.
 *
 * Layer 1 (primitives), from `@kirana-style/preset-scales`: Tailwind CSS v4-compatible values,
 * inlined at build time. Unused tokens emit nothing, so the full vocabulary costs nothing to carry.
 * These are lengths, so wrap them: `blur(${blur.xs})`.
 *
 * `backdrop-blur-xs` is 4px, not 2px. Every overlay was ported at 2px before
 * this file existed, which is why the scale lives here instead of in each
 * component's head.
 */

export { blur } from "@kirana-style/preset-scales"
