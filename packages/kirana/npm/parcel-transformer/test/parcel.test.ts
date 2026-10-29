import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { Driver } from "@kirana-style/compiler"
import { afterAll, describe, expect, it, vi } from "vite-plus/test"

import transformer, { driverFor, transform } from "../src/index.ts"
import type { Asset } from "../src/index.ts"

const created: string[] = []
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

function project(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(import.meta.dirname, ".app-"))
  created.push(root)
  writeFileSync(
    path.join(root, "package.json"),
    '{"name":"app","type":"module"}'
  )
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    writeFileSync(path.join(root, name), text)
  }
  return root
}

function asset(filePath: string, code: string) {
  const invalidated: string[] = []
  const written: string[] = []
  const fake: Asset = {
    filePath,
    getCode: async () => code,
    setCode: (next) => void written.push(next),
    invalidateOnFileChange: (file) => void invalidated.push(file),
  }
  return { fake, invalidated, written }
}

const TOKENS = `import { defineTokens } from "@kirana-style/core"\nexport const color = defineTokens("color", { ink: "rgb(1, 2, 3)" })\n`

/** Every module compiles off the host's thread (`transformAsync`) and none on it (`transform`). */
function offThread() {
  const sync = vi.spyOn(Driver.prototype, "transform")
  const async = vi.spyOn(Driver.prototype, "transformAsync")
  return () => {
    expect(async).toHaveBeenCalled()
    expect(sync).not.toHaveBeenCalled()
    sync.mockRestore()
    async.mockRestore()
  }
}

describe("D-070 Parcel", () => {
  it("compiles a script's styles in place and watches what they read", async () => {
    const root = project({
      "kirana.config.json": "{}",
      "src/tokens.ts": TOKENS,
    })
    const file = path.join(root, "src/card.tsx")
    const source = `import { css } from "@kirana-style/core"\nimport { color } from "./tokens"\nconst card = css({ color: color.ink })\nexport const Card = () => <div sx={card} />\n`
    const { fake, invalidated, written } = asset(file, source)
    const logger = { warn: vi.fn() }
    const compiled = offThread()
    expect(
      await transform({ asset: fake, options: { projectRoot: root }, logger })
    ).toEqual([fake])
    compiled()
    expect(written[0]).toContain("className")
    expect(invalidated).toContain(path.join(root, "kirana.config.json"))
    expect(invalidated).toContain(path.join(root, "src/tokens.ts"))
    expect(logger.warn).not.toHaveBeenCalled()
    expect(await driverFor(root)).toBe(await driverFor(root))
  })

  it("leaves other scripts alone, warns, and fails on errors", async () => {
    const root = project({})
    const logger = { warn: vi.fn() }
    const plain = asset(path.join(root, "a.ts"), "export const a = 1\n")
    await transform({
      asset: plain.fake,
      options: { projectRoot: root },
      logger,
    })
    expect(plain.written).toEqual([])
    // An unresolved import warns.
    const warned = asset(
      path.join(root, "b.ts"),
      `import { css } from "@kirana-style/core"\nimport { x } from "missing-package"\nexport const b = css({ color: x })\n`
    )
    await transform({
      asset: warned.fake,
      options: { projectRoot: root },
      logger,
    })
    expect(logger.warn).toHaveBeenCalledWith({
      message: expect.stringContaining("unresolved-import"),
    })
    const broken = asset(
      path.join(root, "c.ts"),
      `import { css } from "@kirana-style/core"\nexport const c = css({ colour: "red" })\n`
    )
    await expect(
      transform({ asset: broken.fake, options: { projectRoot: root }, logger })
    ).rejects.toThrow("unknown-property")
  })

  it("is a Parcel transformer", () => {
    expect(transformer).toBeDefined()
  })
})
