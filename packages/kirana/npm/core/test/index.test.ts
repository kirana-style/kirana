import { describe, expect, expectTypeOf, it } from "vite-plus/test"

import * as core from "../src/index.ts"
import { defineConfig } from "../src/config.ts"
import type { StyleHandle } from "../src/index.ts"

describe("KRN-API uncompiled calls fail loudly", () => {
  const calls: [string, () => unknown][] = [
    ["css", () => core.css()],
    ["cx", () => core.cx()],
    ["props", () => core.props()],
    ["recipe", () => core.recipe({})],
    ["relation", () => core.relation("field")],
    ["select.descendant", () => core.select.descendant("svg")],
    ["select.child", () => core.select.child("svg")],
    ["keyframes", () => core.keyframes({})],
    ["defineTokens", () => core.defineTokens("space", {})],
    ["defineTheme", () => core.defineTheme({}, {})],
    ["mode.system", () => core.mode.system],
    ["mode.light", () => core.mode.light],
    ["mode.dark", () => core.mode.dark],
    ["media", () => core.media("(x)")],
    ["container", () => core.container("(x)")],
    ["supports", () => core.supports("(x)")],
    ["firstThatWorks", () => core.firstThatWorks("100dvh", "100vh")],
    ["positionTry", () => core.positionTry({ positionArea: "top" })],
    ["viewTransition", () => core.viewTransition({ old: { opacity: 0 } })],
  ]
  it.each(calls)("%s throws", (name, call) => {
    expect(call).toThrow(`Kirana: ${name}() ran without being compiled`)
  })

  it("defineConfig returns its input", () => {
    const config = { names: { prefix: "ds" } }
    expect(defineConfig(config)).toBe(config)
  })
})

describe("recipe types", () => {
  it("take slot names from `slots` alone, never from a style's properties", () => {
    const make = () =>
      core.recipe({
        base: { display: "flex" },
        variants: { size: { sm: { padding: "1px" }, md: { padding: "2px" } } },
        compoundVariants: [{ size: "sm", css: { margin: "1px" } }],
        defaultVariants: { size: "md" },
      })
    expectTypeOf<
      ReturnType<ReturnType<typeof make>>
    >().toEqualTypeOf<StyleHandle>()
    expectTypeOf<
      NonNullable<Parameters<ReturnType<typeof make>>[0]>
    >().toEqualTypeOf<{
      readonly size?: "sm" | "md" | null
    }>()
  })
})

describe("fallback, position-try and view-transition types", () => {
  it("fit where their values go", () => {
    const make = () => {
      const below = core.positionTry({
        positionArea: "bottom",
        marginTop: "4px",
      })
      const slide = core.viewTransition({
        old: { animationDuration: "150ms" },
        new: { animationDuration: { base: "250ms", "@media (x)": "0s" } },
      })
      const style = core.css({
        minHeight: core.firstThatWorks("100dvh", "100vh"),
        positionTryFallbacks: below,
      })
      // @ts-expect-error colour has no effect in @position-try
      core.positionTry({ color: "red" })
      // @ts-expect-error firstThatWorks takes at least one value
      core.firstThatWorks()
      const sx: core.Sx = [style, slide]
      const name: string = slide
      return { below, slide, sx, name }
    }
    expectTypeOf<
      ReturnType<typeof make>["below"]
    >().toEqualTypeOf<core.PositionTry>()
    expectTypeOf<
      ReturnType<typeof make>["slide"]
    >().toEqualTypeOf<core.ViewTransition>()
    expectTypeOf(core.firstThatWorks<"a" | "b">).returns.toEqualTypeOf<
      core.Fallbacks<"a" | "b">
    >()
  })
})
