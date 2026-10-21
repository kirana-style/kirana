import { describe, expect, it } from "vite-plus/test"

import { compare, counts, flatten, report, size } from "../budgets.ts"

describe("budgets", () => {
  it("measures raw, gzip and brotli bytes at fixed levels", () => {
    expect(size("")).toEqual({ raw: 0, gzip: 20, brotli: 1 })
    const repeated = size(".a{color:red}".repeat(100))
    expect(repeated.raw).toBe(1300)
    expect(repeated.gzip).toBeLessThan(repeated.raw)
    expect(repeated.brotli).toBeLessThan(repeated.gzip)
  })

  it("reads types and instantiations from tsc's extended diagnostics", () => {
    expect(
      counts("Symbols: 9\nTypes:  1599\nInstantiations:    166\n")
    ).toEqual({
      types: 1599,
      instantiations: 166,
    })
    expect(() => counts("Types: 1\n")).toThrow(/Instantiations/)
  })

  it("compares every number by its path, new and removed ones included", () => {
    const before = { size: { a: { css: { gzip: 100 } }, gone: 1 }, same: 2 }
    const after = { size: { a: { css: { gzip: 105 } }, added: 3 }, same: 2 }
    expect([...flatten(after).keys()]).toEqual([
      "size.a.css.gzip",
      "size.added",
      "same",
    ])
    expect(compare(before, after)).toEqual([
      { measure: "size.a.css.gzip", before: 100, after: 105 },
      { measure: "size.added", before: undefined, after: 3 },
      { measure: "size.gone", before: 1, after: undefined },
    ])
    expect(compare(after, after)).toEqual([])
  })

  it("reports the changes as a table with each difference", () => {
    expect(report([])).toBe("Budgets: no change.\n")
    const table = report([
      { measure: "size.a.css.gzip", before: 100, after: 105 },
      { measure: "size.b", before: 40, after: 30 },
      { measure: "size.c", before: 0, after: 4 },
      { measure: "size.added", after: 3 },
      { measure: "size.gone", before: 1 },
    ])
    expect(table).toContain("Budgets: 5 measures changed.")
    expect(table).toContain("| `size.a.css.gzip` | 100 | 105 | +5 (5.0 %) |")
    expect(table).toContain("| `size.b` | 40 | 30 | -10 (-25.0 %) |")
    expect(table).toContain("| `size.c` | 0 | 4 | +4 |")
    expect(table).toContain("| `size.added` | — | 3 | new |")
    expect(table).toContain("| `size.gone` | 1 | — | removed |")
    expect(report([{ measure: "x", before: 1, after: 2 }])).toContain(
      "1 measure changed."
    )
  })
})
