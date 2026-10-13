import { KiranaPlugin } from "@kirana-style/webpack"
import { describe, expect, it, vi } from "vite-plus/test"

import { onCreateWebpackConfig } from "../src/index.ts"

describe("D-071 Gatsby", () => {
  it("adds Kirana's webpack plugin to every stage, with Kirana's options only", () => {
    for (const stage of [
      "develop",
      "develop-html",
      "build-javascript",
      "build-html",
    ]) {
      const setWebpackConfig = vi.fn()
      onCreateWebpackConfig(
        { stage, actions: { setWebpackConfig } },
        { plugins: [], reportInfo: true }
      )
      expect(setWebpackConfig).toHaveBeenCalledWith({
        plugins: [expect.any(KiranaPlugin)],
      })
    }
    const setWebpackConfig = vi.fn()
    onCreateWebpackConfig({ stage: "develop", actions: { setWebpackConfig } })
    expect(setWebpackConfig).toHaveBeenCalledOnce()
  })
})
