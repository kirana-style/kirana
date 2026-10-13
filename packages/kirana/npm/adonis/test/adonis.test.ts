import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { Edge } from "edge.js"
import { afterAll, describe, expect, it } from "vitest"

import { registerKirana } from "../src/index.ts"
import KiranaProvider from "../src/provider.ts"

const directory = mkdtempSync(path.join(tmpdir(), "kirana-adonis-"))
afterAll(() => rmSync(directory, { recursive: true, force: true }))

const file = path.join(directory, "classes.json")
writeFileSync(
  file,
  JSON.stringify({
    version: 1,
    prefix: "k",
    families: { four: 45, two: 111 },
    classes: { card: "k3_aaaa k1x_bbbb", "card.active": "k3_cccc" },
  })
)

const TEMPLATE = `<div class="{{ kirana('card', active && 'card.active') }}"></div>`

describe("D-069 kirana() in Edge templates", () => {
  it("merges the named handles", async () => {
    const edge = new Edge()
    registerKirana(edge, file)
    expect(await edge.renderRaw(TEMPLATE, { active: true })).toBe(
      '<div class="k1x_bbbb k3_cccc"></div>'
    )
    expect(await edge.renderRaw(TEMPLATE, { active: false })).toBe(
      '<div class="k3_aaaa k1x_bbbb"></div>'
    )
  })

  it("is registered by the provider, from the configuration or public/", async () => {
    const { default: edge } = await import("edge.js")
    const app = (classes: string | undefined) =>
      ({
        config: { get: () => classes },
        publicPath: (name: string) => path.join(directory, name),
      }) as unknown as ConstructorParameters<typeof KiranaProvider>[0]
    await new KiranaProvider(app(file)).boot()
    expect(await edge.renderRaw(TEMPLATE, { active: true })).toBe(
      '<div class="k1x_bbbb k3_cccc"></div>'
    )
    await new KiranaProvider(app(undefined)).boot()
    await expect(edge.renderRaw(TEMPLATE, {})).rejects.toThrow(
      path.join(directory, "kirana/classes.json")
    )
  })
})
