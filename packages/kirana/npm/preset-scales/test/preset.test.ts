import { describe, expect, it } from "vitest"

import * as preset from "../src/index.ts"

// This suite runs under the Kirana Vite plugin, so the preset is compiled exactly as an
// application would compile it (KRN-TOK-009).
describe("KRN-TOK-009 @kirana-style/preset-scales", () => {
  it("provides Tailwind v4-compatible scale values", () => {
    expect(preset.space[4]).toBe("1rem")
    expect(preset.space.px).toBe("1px")
    expect(preset.space["0.5"]).toBe("0.125rem")
    expect(preset.color.blue[600]).toBe("oklch(54.6% 0.245 262.881)")
    expect(preset.color.white).toBe("#fff")
    expect(preset.fontSize.sm).toBe("0.875rem")
    expect(preset.lineHeight.sm).toBe("calc(1.25 / 0.875)")
    expect(preset.radius.lg).toBe("0.5rem")
    expect(preset.shadow.sm).toContain("rgb(0 0 0 / 0.1)")
    expect(Object.keys(preset.color)).toHaveLength(28)
    expect(Object.keys(preset.fontFamily)).toEqual(["sans", "serif", "mono"])
    // The type ramp holds font sizes only; Tailwind's `--text-shadow-*` are their own scale.
    expect(Object.keys(preset.fontSize)).not.toContain("shadow-sm")
    expect(preset.textShadow.sm).toContain("rgb(0 0 0 / 0.075)")
    expect([
      preset.blur.xs,
      preset.easing.inOut,
      preset.screen.md,
      preset.containerSize.xs,
    ]).toEqual(["4px", "cubic-bezier(0.4, 0, 0.2, 1)", "48rem", "20rem"])
    expect([
      preset.fontWeight.bold,
      preset.letterSpacing.tight,
      preset.leading.tight,
    ]).toEqual(["700", "-0.025em", "1.25"])
    expect([
      preset.duration[150],
      preset.duration[0],
      preset.zIndex[50],
      preset.zIndex.auto,
    ]).toEqual(["150ms", "0s", "50", "auto"])
  })

  it("provides breakpoint and container conditions", () => {
    expect(preset.breakpoint.md).toBe("@media (width >= 48rem)")
    expect(preset.containerQuery["7xl"]).toBe("@container (width >= 80rem)")
  })
})

describe("KRN-API-012 the preset", () => {
  it("declares its utility grammar, and nothing else", async () => {
    const { default: scales, grammar } = await import("../src/preset.ts")
    expect(scales()).toEqual({
      name: "@kirana-style/preset-scales",
      utilities: grammar,
    })
    expect(Object.keys(grammar.utilities!)).toContain("px")
    expect(grammar.variants!.md).toBe("@media (width >= 48rem)")
  })
})
