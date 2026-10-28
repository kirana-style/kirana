import { describe, expect, it } from "vite-plus/test"

import { engineJson, mergeGrammars, posixResolve } from "../src/engine-json.ts"

describe("posixResolve", () => {
  it("joins a relative module to the root, `.` and `..` resolved", () => {
    expect(posixResolve("/app", "./src/theme.ts")).toBe("/app/src/theme.ts")
    expect(posixResolve("/app/web", "../shared/./scale.ts")).toBe(
      "/app/shared/scale.ts"
    )
    expect(posixResolve("app", "./theme.ts")).toBe("app/theme.ts")
  })
})

describe("engineJson", () => {
  it("merges the inline options over the file's, and leaves out what the engine refuses", () => {
    const json = engineJson(
      "/app",
      {
        names: { prefix: "a" },
        ui: { registry: "x" },
        presets: [
          {
            name: "scales",
            utilities: {
              scales: { space: [{ module: "./space.ts", export: "space" }] },
            },
          },
        ],
      },
      { names: { prefix: "b" } },
      { jsx: "preact" }
    )
    expect(JSON.parse(json)).toEqual({
      names: { prefix: "b" },
      jsx: "preact",
      utilities: {
        scales: { space: [{ module: "/app/space.ts", export: "space" }] },
        utilities: {},
        variants: {},
      },
      root: "/app",
    })
  })

  it("keeps the configuration's own `jsx` over the detected one, and adds nothing unset", () => {
    expect(
      JSON.parse(engineJson("/app", { jsx: "solid" }, {}, { jsx: "qwik" }))
    ).toEqual({ jsx: "solid", root: "/app" })
    expect(JSON.parse(engineJson("/app", {}, {}))).toEqual({ root: "/app" })
  })
})

describe("mergeGrammars", () => {
  it("resolves relative modules with the resolver it is given, and keeps package ones", () => {
    expect(
      mergeGrammars(
        [
          {
            scales: {
              color: [
                { module: "./theme.ts", export: "theme" },
                { module: "@acme/tokens", export: "colors" },
              ],
            },
          },
        ],
        "/app",
        (root, module) => `${root}|${module}`
      )?.scales?.color
    ).toEqual([
      { module: "/app|./theme.ts", export: "theme" },
      { module: "@acme/tokens", export: "colors" },
    ])
  })
})
