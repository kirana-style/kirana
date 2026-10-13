import { describe, expect, it } from "vitest"

import { KiranaPlugin } from "../src/index.ts"
import { withKirana } from "../src/next.ts"

describe("KRN-INT-003 Next.js with webpack", () => {
  it("adds the plugin at the project directory and keeps the existing webpack function", () => {
    const plain = withKirana()
    const config = plain.webpack!({}, { dir: "/app" })
    expect(config.plugins).toEqual([expect.any(KiranaPlugin)])
    expect(
      (config.plugins![0] as unknown as { options: object }).options
    ).toEqual({ root: "/app" })

    const chained = withKirana(
      {
        reactStrictMode: true,
        webpack: (given) => ({ ...given, touched: true }),
      },
      { reportInfo: true }
    )
    expect(chained.reactStrictMode).toBe(true)
    const result = chained.webpack!({ plugins: ["other"] }, { dir: "/app" })
    expect(result).toMatchObject({ touched: true })
    expect(result.plugins).toHaveLength(2)
  })
})
