import { describe, expect, it } from "vite-plus/test"

import { transientNpmError, transientStatus } from "../registry-retry.ts"

describe("transientNpmError", () => {
  // The output 0.3.1's release stopped on.
  it("retries a registry that is unavailable", () => {
    expect(
      transientNpmError(
        "npm error code E503\nnpm error 503 Service Unavailable - PUT https://registry.npmjs.org/@kirana-style%2fcore - Service Unavailable\n"
      )
    ).toBe(true)
  })

  it("retries rate limits, timeouts and dropped connections", () => {
    for (const code of [
      "E429",
      "E408",
      "E500",
      "E502",
      "ECONNRESET",
      "ETIMEDOUT",
      "EAI_AGAIN",
    ])
      expect(transientNpmError(`npm error code ${code}\n`)).toBe(true)
    expect(transientNpmError("npm ERR! code E504\n")).toBe(true)
  })

  it("stops on what another attempt would meet again", () => {
    // E401 is a trusted publisher npm refuses; E403 a version that is already published.
    for (const code of ["E401", "E403", "E404", "E422", "EOTP", "ENEEDAUTH"])
      expect(transientNpmError(`npm error code ${code}\n`)).toBe(false)
    expect(transientNpmError("something else went wrong\n")).toBe(false)
  })
})

describe("transientStatus", () => {
  it("separates a failing registry from a refused request", () => {
    expect([503, 500, 429, 408].map(transientStatus)).toEqual([
      true,
      true,
      true,
      true,
    ])
    expect([200, 401, 403, 404].map(transientStatus)).toEqual([
      false,
      false,
      false,
      false,
    ])
  })
})
