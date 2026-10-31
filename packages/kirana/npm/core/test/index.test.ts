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
    ["fallback", () => core.fallback("" as core.Token, "2.5rem")],
    ["positionTry", () => core.positionTry({ positionArea: "top" })],
    ["viewTransition", () => core.viewTransition({ old: { opacity: 0 } })],
    ["counterStyle", () => core.counterStyle({ system: "cyclic" })],
    ["own", () => core.own("data-side")],
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

describe("keyframes types", () => {
  it("take CSS properties and custom properties in a frame (KF-055)", () => {
    const make = () => {
      const reveal = core.keyframes({
        from: { "--scroll-fade-t": "0px" },
        to: { "--scroll-fade-t": "24px", opacity: 1 },
      })
      // @ts-expect-error a frame takes CSS properties, and `colour` is none
      core.keyframes({ from: { colour: "red" } })
      return reveal
    }
    expectTypeOf<ReturnType<typeof make>>().toEqualTypeOf<core.Keyframes>()
  })
})

describe("counter-style types", () => {
  it("name a list style and a counter, and take descriptors only", () => {
    const make = () => {
      const check = core.counterStyle({
        system: "cyclic",
        symbols: '"✓"',
        suffix: '" "',
      })
      const roman = core.counterStyle({
        system: `extends ${check}`,
        fallback: check,
      })
      const style = core.css({
        listStyleType: check,
        content: `counter(item, ${roman})`,
      })
      // @ts-expect-error a property is not a descriptor
      core.counterStyle({ color: "red" })
      return { check, style }
    }
    expectTypeOf<
      ReturnType<typeof make>["check"]
    >().toEqualTypeOf<core.CounterStyle>()
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
      // @ts-expect-error fallback() needs what to read when the token is unset
      core.fallback("" as core.Token)
      // @ts-expect-error fallback() starts with a token
      core.fallback("1rem", "2rem")
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
    expectTypeOf(core.fallback).returns.toEqualTypeOf<core.Token>()
  })
})
