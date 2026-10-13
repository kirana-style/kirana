import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"

import postcss from "postcss"
import { afterAll, describe, expect, it, vi } from "vitest"

import kirana, { Project, WATCHED, projectFor, sources } from "../src/index.ts"

const created: string[] = []
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

/** A project inside the workspace (so `@kirana-style/core` resolves), with `files` written into it. */
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

const CARD = `import { css } from "@kirana-style/core"
export const card = css({ color: "rgb(1, 2, 3)" })
export const Card = () => <p sx={card} />
`

async function run(root: string, css: string, options = {}) {
  return postcss([kirana({ root, ...options })]).process(css, {
    from: path.join(root, "app/globals.css"),
  })
}

describe("KRN-INT-010 PostCSS", () => {
  it("writes the project's stylesheet at the directive and asks to be run again on a change", async () => {
    const root = project({ "app/card.tsx": CARD, "kirana.config.json": "{}" })
    const result = await run(root, "body { margin: 0 }\n@kirana;\n")
    expect(result.css).toContain("body { margin: 0 }")
    expect(result.css).toContain("color: rgb(1, 2, 3)")
    expect(result.css).not.toContain("@kirana;")
    expect(result.messages).toContainEqual(
      expect.objectContaining({
        type: "dir-dependency",
        dir: root,
        glob: WATCHED,
      })
    )
    expect(result.messages).toContainEqual(
      expect.objectContaining({
        type: "dependency",
        file: path.join(root, "kirana.config.json"),
      })
    )
  })

  it("fills the stylesheet's own placeholder, and leaves other stylesheets alone", async () => {
    const root = project({ "card.tsx": CARD })
    const filled = await run(root, '.kirana-placeholder{--kirana:"stylesheet"}')
    expect(filled.css).toContain("color: rgb(1, 2, 3)")
    // Without a configuration file there is nothing else to watch.
    expect(
      filled.messages.filter((message) => message.type === "dependency")
    ).toEqual([])
    const other = await run(root, "a { color: red }")
    expect(other.css).toBe("a { color: red }")
    expect(other.messages).toEqual([])
  })

  it("compiles what changed since the last run, and forgets what was deleted", async () => {
    const root = project({ "card.tsx": CARD })
    const first = await run(root, "@kirana;")
    expect(first.css).toContain("rgb(1, 2, 3)")
    // An edit (with a new modification time) reaches the next run; untouched files are not read again.
    const file = path.join(root, "card.tsx")
    writeFileSync(file, CARD.replace("rgb(1, 2, 3)", "rgb(4, 5, 6)"))
    utimesSync(file, new Date(), new Date(Date.now() + 5000))
    const second = await run(root, "@kirana;")
    expect(second.css).toContain("rgb(4, 5, 6)")
    expect(second.css).not.toContain("rgb(1, 2, 3)")
    rmSync(file)
    const third = await run(root, "@kirana;")
    expect(third.css).not.toContain("rgb(4, 5, 6)")
  })

  it("minifies in production or when asked", async () => {
    const root = project({ "card.tsx": CARD })
    const asked = await run(root, "@kirana;", { minify: true })
    expect(asked.css).toContain("color:rgb(1,2,3)")
    const environment = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    try {
      const production = await postcss([kirana({ root })]).process("@kirana;", {
        from: undefined,
      })
      expect(production.css).toContain("color:rgb(1,2,3)")
    } finally {
      process.env.NODE_ENV = environment
    }
  })

  it("warns on the project's warnings and fails on its errors", async () => {
    const anchored = project({
      "a.tsx": `import { relation } from "@kirana-style/core"\nconst card = relation("card")\nexport const A = () => <div sx={card.anchor} />\n`,
    })
    const warned = await run(anchored, "@kirana;")
    expect(
      warned
        .warnings()
        .map((warning) => warning.text)
        .join("\n")
    ).toContain("anchored but never read")
    const unanchored = project({
      "b.tsx": `import { css, relation } from "@kirana-style/core"\nconst card = relation("card")\nexport const b = css({ color: { [card.within(":hover")]: "red" } })\nexport const B = () => <p sx={b} />\n`,
    })
    await expect(run(unanchored, "@kirana;")).rejects.toThrow(
      "its anchor is never applied"
    )
  })

  it("compiles the libraries a project compiles as its own", async () => {
    const root = project({
      "kirana.config.json": '{ "libraries": ["ui-kit"] }',
      "node_modules/ui-kit/package.json": '{"name":"ui-kit","type":"module"}',
      "node_modules/ui-kit/button.tsx": CARD.replace(
        "rgb(1, 2, 3)",
        "rgb(7, 8, 9)"
      ),
    })
    const result = await run(root, "@kirana;")
    expect(result.css).toContain("rgb(7, 8, 9)")
    expect(result.messages).toContainEqual(
      expect.objectContaining({
        type: "dir-dependency",
        dir: path.join(root, "node_modules/ui-kit"),
      })
    )
  })

  it("finds sources without installed packages, build output, hidden folders or declarations", () => {
    const root = project({
      "src/a.ts": "",
      "src/b.d.ts": "",
      "src/c.css": "",
      "dist/d.js": "",
      ".next/e.js": "",
      "node_modules/f/g.js": "",
    })
    expect(sources(root).map((file) => path.relative(root, file))).toEqual([
      path.join("src", "a.ts"),
    ])
  })

  it("opens one project per root, at the working directory by default", async () => {
    const root = project({ "card.tsx": CARD })
    expect(projectFor(root)).toBe(projectFor(root))
    expect(new Project(root).root).toBe(root)
    // Workers (the coverage run) cannot chdir, so the working directory is stubbed.
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(root)
    try {
      const result = await postcss([kirana()]).process("@kirana;", {
        from: undefined,
      })
      expect(result.css).toContain("rgb(1, 2, 3)")
    } finally {
      cwd.mockRestore()
    }
  })
})
