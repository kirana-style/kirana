import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { afterAll, describe, expect, it, vi } from "vite-plus/test"

import { Driver } from "../src/index.ts"
import type * as Sfc from "../src/sfc.ts"

/** `moduleAnchors` as written, counted. */
const anchors = vi.hoisted(() => ({ calls: [] as string[] }))
vi.mock("../src/sfc.ts", async (original) => {
  const sfc = await original<typeof Sfc>()
  return {
    ...sfc,
    moduleAnchors: (id: string, code: string) => {
      anchors.calls.push(path.basename(id))
      return sfc.moduleAnchors(id, code)
    },
  }
})

const created: string[] = []
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

const STYLES = `import { css, relation } from "@kirana-style/core"\nconst menu = relation("menu")\nconst item = css({ color: { base: "black", [menu.within("[data-open]")]: "red" } })\n`
const COMPONENT = `${STYLES}@Component({\n  selector: "app-menu",\n  template: \`<ul [sx]="[menu.anchor, item]"><li [sx]="item">x</li></ul>\`,\n})\nexport class Menu {\n  protected readonly menu = menu\n  protected readonly item = item\n}\n`

describe("kept answers (KF-106)", () => {
  it("answer an unchanged module before its template is looked for", async () => {
    const root = mkdtempSync(path.join(import.meta.dirname, ".app-"))
    created.push(root)
    writeFileSync(
      path.join(root, "package.json"),
      '{"name":"app","type":"module"}'
    )
    writeFileSync(
      path.join(root, "kirana.config.json"),
      '{"externals":["@angular/"]}'
    )
    const driver = await Driver.create({
      root,
      importModule: (url: string) => import(url),
    })
    driver.reuseTransforms()
    const file = path.join(root, "menu.component.ts")

    const first = driver.transform(file, COMPONENT)
    expect(first.code).toContain("export class Menu")
    expect(first.code).not.toContain("KF-088")
    expect(anchors.calls.splice(0)).toEqual(["menu.component.ts"])
    // The same source again: the kept answer, with the template's anchors already cut, and no
    // scan of the module.
    expect(driver.transform(file, COMPONENT)).toEqual({
      ...first,
      cssChanged: false,
    })
    expect(await driver.transformAsync(file, COMPONENT)).toEqual({
      ...first,
      cssChanged: false,
    })
    expect(anchors.calls).toEqual([])
    // The anchor the template applies still counts.
    expect(
      driver
        .diagnostics()
        .filter((diagnostic) => diagnostic.name === "relation-without-anchor")
    ).toEqual([])
    // Another source is looked at again.
    const edited = `${COMPONENT}// edit\n`
    expect(driver.transform(file, edited).code).not.toContain("KF-088")
    expect(
      (await driver.transformAsync(file, `${edited}// again\n`)).code
    ).not.toContain("KF-088")
    expect(anchors.calls).toEqual(["menu.component.ts", "menu.component.ts"])
  })
})
