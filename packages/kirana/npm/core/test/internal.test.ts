import { gzipSync } from "node:zlib"
import { readFileSync } from "node:fs"
import { transformSync } from "oxc-transform"
import { minifySync } from "oxc-minify"
import { describe, expect, it } from "vite-plus/test"

import { runtime } from "../src/internal.ts"

const k = runtime("k", "className")

describe("KRN-DYN-005 private runtime", () => {
  it("merges the last class per key and passes foreign classes through", () => {
    expect(
      k.cx("k3T_aaa k4I_bbb", "foo", ["k3T_ccc", null, false], undefined)
    ).toBe("k4I_bbb foo k3T_ccc")
    expect(k.cx("foo  bar", "foo")).toBe("foo bar")
    expect(k.cx()).toBe("")
  })

  it("applies entry and property tombstones", () => {
    // removal of one entry
    expect(k.cx("k3T_aaa k3T-KFHz_bbb", "k3T_")).toBe("k3T-KFHz_bbb k3T_")
    // removal of every entry of the element's property, but not another target's
    expect(
      k.cx("k3T_aaa k3T-KFHz_bbb k3T-aje_ccc k3Tx_ddd", "k3T*_ k3T_eee")
    ).toBe("k3T-aje_ccc k3Tx_ddd k3T*_ k3T_eee")
    // another target's property tombstone survives (found by the merge vectors)
    expect(k.cx("k3T-aje*_ k3T_aaa", "k3T*_")).toBe("k3T-aje*_ k3T*_")
    // removal within one target
    expect(k.cx("k3T-aje_ccc k3T-aje-KFHz_ddd k3T_aaa", "k3T-aje*_")).toBe(
      "k3T_aaa k3T-aje*_"
    )
  })

  it("carries bridged variables, later values winning", () => {
    const first = k.b("k60_4ko", "--k60", 10)
    const second = k.b("k60_4ko", "--k60", null)
    expect(first).toEqual({ c: "k60_4ko", v: { "--k60": "10" } })
    expect(k.cx(first, second)).toEqual({
      c: "k60_4ko",
      v: { "--k60": "initial" },
    })
  })

  it("builds host element props", () => {
    expect(
      k.sx(
        ["k3T_aaa k7o*_", k.b("k60_4ko", "--k60", "50%")],
        ["x k3T_zzz", 3],
        [{ color: "red" }, null]
      )
    ).toEqual({
      className: "x k3T_aaa k60_4ko",
      style: { color: "red", "--k60": "50%" },
    })
    // Nothing to set is no key at all: spread after an element's own `style`, an `undefined`
    // would erase it.
    expect(k.sx([null], [], [])).toStrictEqual({})
    expect({
      style: { "--gap": 2 },
      ...k.sx(["k3T_aaa"], [], []),
    }).toStrictEqual({
      style: { "--gap": 2 },
      className: "k3T_aaa",
    })
    // Preact and Solid: the compiler asks for `class` (KRN-INT-004).
    expect(runtime("k", "class").sx(["k3T_aaa"], ["own"], [])).toStrictEqual({
      class: "own k3T_aaa",
    })
  })

  it("resolves recipes with defaults, booleans and compound variants", () => {
    const button = k.recipe({
      s: null,
      b: ["k4I_aaa"],
      v: {
        tone: { red: ["k3T_red"], blue: ["k3T_blu"] },
        flag: { true: ["k7o_hal"] },
      },
      c: [[{ tone: "red", flag: "true" }, ["k3T_pnk"]]],
      d: { tone: "blue" },
    })
    expect(button()).toBe("k4I_aaa k3T_blu")
    expect(button({ tone: "red", flag: true })).toBe("k4I_aaa k7o_hal k3T_pnk")
    expect(button({ tone: undefined, flag: false })).toBe("k4I_aaa k3T_blu")
    const card = k.recipe({
      s: ["root", "title"],
      b: ["k4I_grd", "k7F_600"],
      v: { size: { sm: ["k8n_sm", ""] } },
      c: [],
      d: {},
    })
    expect(card({ size: "sm" })).toEqual({
      root: "k4I_grd k8n_sm",
      title: "k7F_600",
    })
  })

  it("lets a box family atom replace its longhands, found from its code (D-045)", () => {
    // Index 0 (`0`) is a four-longhand family: longhands 1–4.
    expect(k.cx("k1_a k2-KFHz_b k4_c x", "k0_d")).toBe("k2-KFHz_b x k0_d")
    // Index 10 (`a`) and 40 (`E`) head four-longhand blocks; index 63 (`11`) a two-longhand one.
    expect(k.cx("kb_a ke_b kf_c", "ka_d")).toBe("kf_c ka_d")
    expect(k.cx("kF-aje_a kI-aje_b", "kE-aje_c")).toBe("kE-aje_c")
    expect(k.cx("k12_a k13_b k14_c", "k11_d")).toBe("k14_c k11_d")
    // Not a family head, or outside the family blocks: nothing else is replaced.
    expect(k.cx("k2_a", "k1_b", "kZZ_c", "k10_d")).toBe("k2_a k1_b kZZ_c k10_d")
  })

  it("unfolds a shorthand atom into the longhands it still owns (D-045)", () => {
    // The atom's own tombstones are replaced, in the atom's place; a longhand set after it keeps
    // its value.
    expect(k.cx("k5_ kx0_", "kx_v1", "k6_v2", "kx/5.6_")).toBe(
      "kx0_ k5_v1 k6_v2 kx/5.6_"
    )
    // A longhand before the atom holds an earlier atom's unfolded value, which the atom overrides.
    expect(k.cx("k5_v0 ky_v2", "ky/5_")).toBe("k5_v2 ky/5_")
    // Every condition set: `*`, with a target segment.
    expect(k.cx("kx-aje_a kx-aje-KFHz_b kx-abc_c", "kx/5-aje*_")).toBe(
      "k5-aje_a k5-aje-KFHz_b kx-abc_c kx/5-aje*_"
    )
    // A tombstone of the atom is not unfolded.
    expect(k.cx("kx_", "kx/5_")).toBe("kx_ kx/5_")
  })

  it("stays within 1.0 kB minified and gzipped", () => {
    // As bundled: the generated family constants inlined in place of their import.
    const families = readFileSync(
      new URL("../src/families.generated.ts", import.meta.url),
      "utf8"
    ).replaceAll("export ", "")
    const source = readFileSync(
      new URL("../src/internal.ts", import.meta.url),
      "utf8"
    ).replace(
      /import \{ FOUR, TWO \} from "\.\/families\.generated\.ts"\n/,
      families
    )
    expect(source).not.toContain("families.generated")
    const javascript = transformSync("internal.ts", source).code
    const minified = minifySync("internal.js", javascript).code
    expect(gzipSync(minified).length).toBeLessThanOrEqual(1000)
  })
})
