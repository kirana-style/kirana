import { describe, expect, it } from "vite-plus/test"

import {
  baseRefusal,
  fittingTemplate,
  runtimeOf,
  templateRuntime,
} from "../src/runtime.ts"
import type { Index } from "../src/types.ts"

describe("KF-134 runtimes", () => {
  it("tells Solid 1 from Solid 2 by the packages a project lists, and nothing else", () => {
    expect(runtimeOf({ "@solidjs/web": "^2.0.3" }, "solid")).toBe("solid2")
    expect(runtimeOf({ "solid-js": "~2.1.0" }, "solid")).toBe("solid2")
    expect(runtimeOf({ "solid-js": "^1.9.9" }, "solid")).toBe("solid1")
    expect(runtimeOf({ "solid-js": "workspace:*" }, "solid")).toBeUndefined()
    expect(runtimeOf({}, "solid")).toBeUndefined()
    expect(runtimeOf({ react: "^19.0.0" }, "react")).toBeUndefined()
  })

  it("takes a template's runtime from its entry, else its packages, else its entry's framework", () => {
    const solid2 = { "solid-js": "^2.0.3", "@solidjs/web": "^2.0.3" }
    const name = "vite"
    expect(templateRuntime(solid2, undefined)).toEqual({
      framework: "solid",
      runtime: "solid2",
    })
    expect(
      templateRuntime({}, { name, framework: "solid", runtime: "solid2" })
    ).toEqual({ framework: "solid", runtime: "solid2" })
    // An entry naming its framework alone is on the default: Solid 1, or a framework's unnamed one.
    expect(templateRuntime({}, { name, framework: "solid" })).toEqual({
      framework: "solid",
      runtime: "solid1",
    })
    expect(templateRuntime({}, { name, framework: "vue" })).toEqual({
      framework: "vue",
      runtime: "",
    })
    expect(templateRuntime({ vue: "^3.5.0" }, undefined)).toBeUndefined()
    expect(templateRuntime({}, { name })).toBeUndefined()
  })

  it("names the template of the framework on the runtime whose name is closest", () => {
    const templates = [
      { name: "nuxt--turbo", framework: "vue" as const, runtime: "vue4" },
      { name: "vite-vue--turbo", framework: "vue" as const },
      { name: "vite-vue4--none", framework: "vue" as const, runtime: "vue4" },
      { name: "vite-vue4--turbo", framework: "vue" as const, runtime: "vue4" },
    ]
    expect(fittingTemplate("vite-vue--turbo", templates, "vue", "vue4")).toBe(
      "vite-vue4--turbo"
    )
    expect(fittingTemplate("vite-vue4--turbo", templates, "vue", "")).toBe(
      "vite-vue--turbo"
    )
    expect(fittingTemplate("x", templates, "vue", "vue4")).toBe("nuxt--turbo")
    expect(fittingTemplate("x", templates, "solid", "solid2")).toBeUndefined()
  })

  it("says why a base does not fit the project, on any framework the index names", () => {
    const index: Index = {
      requires: { vue: { reka: "vue4" } },
      items: [],
    }
    expect(
      baseRefusal(index, "@acme", "vue", "ark", "vue4", ["ark", "reka"])
    ).toEqual({
      message:
        "@acme's vue/ark base needs vue's default runtime, and the project is on vue4",
      fits: ["reka"],
    })
    expect(
      baseRefusal(index, "@acme", "vue", "reka", "", ["ark", "reka", "ark"])
    ).toEqual({
      message:
        "@acme's vue/reka base needs vue4, and the project is on vue's default runtime",
      fits: ["ark"],
    })
    expect(
      baseRefusal(index, "@acme", "vue", "reka", "vue4", ["reka"])
    ).toBeUndefined()
    expect(
      baseRefusal(index, "@acme", "solid", "ark", "solid2", ["ark"])
    ).toBeUndefined()
  })
})
