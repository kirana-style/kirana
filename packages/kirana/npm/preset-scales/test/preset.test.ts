import { describe, expect, it } from "vite-plus/test"

import * as preset from "../src/index.ts"

// This suite runs under the Kirana Vite plugin, so the preset is compiled exactly as an
// application would compile it (KRN-TOK-009).
describe("KRN-TOK-009 @kirana-style/preset-scales", () => {
  // KF-012: a minifier folds `calc(1.25 / 0.875)` to 1.42857 and 14px text loses a pixel's
  // fraction per line; a number rounded up at five decimals is left alone and never short.
  it("writes each paired line height as Tailwind's ratio rounded up at five decimals", () => {
    const ratios: Record<string, number> = {
      xs: 1 / 0.75,
      sm: 1.25 / 0.875,
      base: 1.5 / 1,
      lg: 1.75 / 1.125,
      xl: 1.75 / 1.25,
      "2xl": 2 / 1.5,
      "3xl": 2.25 / 1.875,
      "4xl": 2.5 / 2.25,
    }
    for (const [step, ratio] of Object.entries(ratios)) {
      const value = preset.lineHeight[step as keyof typeof preset.lineHeight]
      expect(value, step).toMatch(/^\d+(\.\d{1,5})?$/)
      expect(Number(value), step).toBeGreaterThanOrEqual(ratio - 1e-9)
      expect(Number(value) - ratio, step).toBeLessThan(1e-5)
    }
  })

  it("provides Tailwind v4-compatible scale values", () => {
    expect(preset.space[4]).toBe("1rem")
    expect(preset.space.px).toBe("1px")
    expect(preset.space["0.5"]).toBe("0.125rem")
    expect(preset.color.blue[600]).toBe("oklch(54.6% 0.245 262.881)")
    expect(preset.color.white).toBe("#fff")
    expect(preset.fontSize.sm).toBe("0.875rem")
    expect(preset.lineHeight.sm).toBe("1.42858")
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
    // A breakpoint names the preset's own condition, which migrated code imports (D-115).
    expect(grammar.variants!.md).toEqual({
      module: "@kirana-style/preset-scales",
      export: "breakpoint",
      path: ["md"],
    })
    expect(grammar.variants!["pointer-fine"]).toBe("@media (pointer: fine)")
    expect(grammar.variants!["any-pointer-none"]).toBe(
      "@media (any-pointer: none)"
    )
  })
})
