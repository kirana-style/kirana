import { KiranaPlugin as FromWebpack } from "@kirana-style/webpack"
import { describe, expect, it } from "vitest"

import KiranaPlugin, { pluginKirana } from "../src/index.ts"
import type { RsbuildPluginAPI } from "../src/index.ts"

describe("KRN-INT-003 Rspack and Rsbuild", () => {
  it("is the webpack plugin, and Rsbuild's plugin adds it at the project root", () => {
    expect(KiranaPlugin).toBe(FromWebpack)
    const configs: { plugins?: unknown[] }[] = [{}, { plugins: ["other"] }]
    const plugin = pluginKirana({ reportInfo: true })
    expect(plugin.name).toBe("kirana")
    for (const config of configs) {
      plugin.setup({
        context: { rootPath: "/project" },
        modifyRspackConfig: (modify) => modify(config),
      } satisfies RsbuildPluginAPI)
    }
    expect(configs[0]!.plugins).toEqual([expect.any(FromWebpack)])
    expect(configs[1]!.plugins).toEqual(["other", expect.any(FromWebpack)])
    expect(
      (configs[0]!.plugins![0] as unknown as { options: object }).options
    ).toEqual({ root: "/project", reportInfo: true })
  })
})
