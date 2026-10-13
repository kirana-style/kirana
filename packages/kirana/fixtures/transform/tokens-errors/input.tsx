import { defineTokens } from "@kirana-style/core"

export function Tokens({ runtime }: { runtime: string }) {
  return [
    defineTokens("dynamic", { value: runtime }),
    defineTokens("group", { nested: { value: runtime } }),
    defineTokens("leaf", { mode: { light: runtime, dark: "x" } }),
    defineTokens(runtime, { a: "1px" }),
  ]
}
export const invalid = defineTokens("invalid", { flag: true, [Symbol.iterator as never]: "x" })
export const missingValues = defineTokens("missing")
