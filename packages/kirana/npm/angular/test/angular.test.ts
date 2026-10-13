import "@angular/compiler"
import {
  ElementRef,
  Injector,
  Renderer2,
  runInInjectionContext,
  ɵINJECTOR_SCOPE as INJECTOR_SCOPE,
  ɵgetDirectiveDef as getDirectiveDef,
} from "@angular/core"
import { describe, expect, it, vi } from "vite-plus/test"

import {
  KIRANA_PREFIX,
  SxDirective,
  applySx,
  provideKirana,
  runtimeFor,
} from "../src/index.ts"
import type { Renderer } from "../src/index.ts"
import kiranaAngular from "../src/vite.ts"

/** A renderer that records what it did to one element. */
function renderer() {
  const classes = new Set<string>(["own"])
  const styles = new Map<string, string>()
  const fake: Renderer = {
    addClass: vi.fn((_: unknown, name: string) => void classes.add(name)),
    removeClass: vi.fn((_: unknown, name: string) => void classes.delete(name)),
    setStyle: vi.fn(
      (_: unknown, name: string, value: string) => void styles.set(name, value)
    ),
    removeStyle: vi.fn((_: unknown, name: string) => void styles.delete(name)),
  }
  return { fake, classes, styles }
}

const EMPTY = { classes: new Set<string>(), styles: new Set<string>() }

describe("D-068 [sx] for Angular", () => {
  it("merges handles, keeps the element's own classes, and moves from one value to the next", () => {
    const { fake, classes, styles } = renderer()
    // Two atoms of one property: the later wins, as in a compiled sx array.
    let applied = applySx(
      fake,
      {},
      EMPTY,
      ["k50_aaaa", false, "k50_bbbb kaF_cccc"],
      "k"
    )
    expect([...classes]).toEqual(["own", "k50_bbbb", "kaF_cccc"])
    applied = applySx(
      fake,
      {},
      applied,
      { c: "k7_dddd", v: { "--k7": "2px" } },
      "k"
    )
    expect([...classes]).toEqual(["own", "k7_dddd"])
    expect(Object.fromEntries(styles)).toEqual({ "--k7": "2px" })
    // What stays is neither removed nor added again; a bridged value is updated in place.
    vi.mocked(fake.addClass).mockClear()
    applied = applySx(
      fake,
      {},
      applied,
      { c: "k7_dddd", v: { "--k7": "3px" } },
      "k"
    )
    expect(fake.addClass).not.toHaveBeenCalled()
    expect(fake.removeStyle).not.toHaveBeenCalled()
    expect(styles.get("--k7")).toBe("3px")
    applySx(fake, {}, applied, undefined, "k")
    expect([...classes]).toEqual(["own"])
    expect(styles.size).toBe(0)
    expect(runtimeFor("k")).toBe(runtimeFor("k"))
  })

  it("is a standalone directive Angular can compile, with `sx` as its input", () => {
    const definition = getDirectiveDef(SxDirective)!
    expect(definition.selectors).toEqual([["", "sx", ""]])
    expect(definition.standalone).toBe(true)
    expect(Object.keys(definition.inputs)).toEqual(["sx"])
    expect(SxDirective.ɵfac).toEqual(expect.any(Function))
  })

  it("applies its input on every change, with the provided prefix", () => {
    const { fake, classes } = renderer()
    const element = {}
    const injector = Injector.create({
      providers: [
        { provide: ElementRef, useValue: new ElementRef(element) },
        { provide: Renderer2, useValue: fake },
        ...provideKirana({ prefix: "q" }),
      ],
    })
    const directive = runInInjectionContext(injector, () => new SxDirective())
    directive.sx = ["q50_aaaa", "q50_bbbb"] as never
    directive.ngOnChanges()
    expect([...classes]).toEqual(["own", "q50_bbbb"])
    expect(fake.addClass).toHaveBeenCalledWith(element, "q50_bbbb")
    // Without a provider, the prefix is Kirana's default, from the root injector.
    const root = Injector.create({
      providers: [{ provide: INJECTOR_SCOPE, useValue: "root" }],
    })
    expect(root.get(KIRANA_PREFIX)).toBe("k")
  })

  it("runs Kirana's Vite plugin after Angular's compile", () => {
    const [main, late] = kiranaAngular()
    expect(main!.enforce).toBe("post")
    expect(main!.name).toBe("kirana")
    expect(late!.name).toBe("kirana:late")
  })
})
