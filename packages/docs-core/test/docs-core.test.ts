import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test"

import { parseFrontmatter } from "../src/frontmatter.ts"
import {
  generate,
  plainComponents,
  plainInstall,
  stripNotes,
} from "../src/generate.ts"
import type { DocsConfig } from "../src/generate.ts"
import { installLines } from "../src/package-managers.ts"
import { createPages } from "../src/pages.ts"
import { search } from "../src/search.ts"
import { flattenNav, isBranch } from "../src/types.ts"
import type { NavGroup, PageMeta, SearchRecord } from "../src/types.ts"

describe("parseFrontmatter", () => {
  it("reads scalars, inline lists and dashed lists", () => {
    const front = parseFrontmatter(
      [
        "title: Hello",
        'quoted: "a: b"',
        "order: 3",
        "draft: true",
        "tags: [one, two]",
        "keywords:",
        "- alpha",
        "- beta",
      ].join("\n"),
      "page.md"
    )
    expect(front).toMatchObject({
      title: "Hello",
      quoted: "a: b",
      order: 3,
      draft: true,
      tags: ["one", "two"],
      keywords: ["alpha", "beta"],
    })
  })

  it("throws on a line it does not understand, naming the line", () => {
    expect(() => parseFrontmatter("title Hello", "page.md")).toThrow(
      /page\.md:1/
    )
    expect(() => parseFrontmatter("- stray", "page.md")).toThrow(
      /without a key/
    )
  })
})

const record = (
  page: string,
  text: string,
  heading?: string
): SearchRecord => ({
  id: page,
  href: `/docs/${page.toLowerCase()}`,
  page,
  section: "start",
  ...(heading ? { heading } : {}),
  text,
})

describe("search", () => {
  const records = [
    record("Merging", "Later entries replace earlier ones per longhand."),
    record(
      "Relations",
      "An anchor names the element whose state is read.",
      "Anchors"
    ),
    record("Tokens", "Merging tokens is not a thing."),
  ]

  it("ranks a title match above a body mention", () => {
    const hits = search(records, "merging")
    expect(hits.map((hit) => hit.record.page)).toEqual(["Merging", "Tokens"])
  })

  it("scores headings and returns a snippet around the match", () => {
    const [hit] = search(records, "anchor")
    expect(hit?.record.page).toBe("Relations")
    expect(hit?.snippet).toContain("anchor")
  })

  it("ignores empty and one-letter queries, and respects the limit", () => {
    expect(search(records, " a ")).toEqual([])
    expect(search(records, "is", 1)).toHaveLength(1)
  })
})

describe("nav helpers", () => {
  it("flattens branches into reading order", () => {
    const groups: NavGroup[] = [
      {
        slug: "start",
        label: "Start",
        items: [
          { title: "One", href: "/docs/one", description: "" },
          {
            label: "More",
            items: [{ title: "Two", href: "/docs/two", description: "" }],
          },
        ],
      },
    ]
    expect(isBranch(groups[0]!.items[1]!)).toBe(true)
    expect(flattenNav(groups).map((item) => item.title)).toEqual(["One", "Two"])
  })
})

describe("createPages", () => {
  const pages = [
    { href: "/docs", title: "Home" },
    { href: "/docs/a", title: "A" },
    { href: "/docs/b", title: "B" },
  ] as PageMeta[]
  const document = { type: "root", children: [] } as never
  const index = createPages({
    pages,
    documents: { "./pages/index.json": async () => ({ default: document }) },
    prefix: "./pages/",
  })

  it("resolves splats and finds pages", () => {
    expect(index.pageHref(undefined)).toBe("/docs")
    expect(index.pageHref("/a/")).toBe("/docs/a")
    expect(index.findPage("/docs/b")?.title).toBe("B")
  })

  it("loads a document lazily and fails loudly for a missing one", async () => {
    await expect(index.loadDocument("/docs")).resolves.toBe(document)
    await expect(index.loadDocument("/docs/a")).rejects.toThrow(/no generated/)
  })

  it("walks neighbours in reading order", () => {
    expect(index.neighbours("/docs").next?.title).toBe("A")
    expect(index.neighbours("/docs/a")).toMatchObject({
      previous: { title: "Home" },
      next: { title: "B" },
    })
    expect(index.neighbours("/docs/missing")).toEqual({})
  })
})

describe("stripNotes", () => {
  it("drops tool comments and keeps components", () => {
    expect(
      stripNotes(
        'a\n<!-- prettier-ignore -->\n```tsx\n<!-- ::install dev="x" -->\n'
      )
    ).toBe('a\n```tsx\n<!-- ::install dev="x" -->\n')
  })
})

describe("plainComponents", () => {
  it("swaps components that have a plain version and keeps the rest", () => {
    expect(
      plainComponents('a <!-- ::list size="2" --> b <!-- ::other -->', {
        list: (attributes) => `- ${attributes.size}`,
      })
    ).toBe("a - 2 b <!-- ::other -->")
  })
})

describe("plainInstall", () => {
  it("turns the install component into npm commands for language models", () => {
    expect(
      plainInstall('a\n<!-- ::install packages="x y" dev="z" -->\nb')
    ).toBe("a\n```bash\nnpm install x y\nnpm install -D z\n```\nb")
    expect(plainInstall('<!-- ::install dev="z" -->')).toBe(
      "```bash\nnpm install -D z\n```"
    )
  })

  it("writes a command to run for every package manager", () => {
    expect(plainInstall('<!-- ::install run="tool@latest init" -->')).toBe(
      [
        "```bash",
        "# npm",
        "npx tool@latest init",
        "# pnpm",
        "pnpm dlx tool@latest init",
        "# yarn",
        "yarn dlx tool@latest init",
        "# bun",
        "bunx --bun tool@latest init",
        "# deno",
        "deno run -A npm:tool@latest init",
        "```",
      ].join("\n")
    )
    expect(plainInstall('<!-- ::install exec="tool check" -->')).toContain(
      "# pnpm\npnpm exec tool check\n# yarn\nyarn tool check\n# bun\nbunx tool check"
    )
  })
})

describe("installLines", () => {
  it("gives Deno each package as an npm: specifier", () => {
    expect(installLines("deno", { packages: "x y", dev: "z" })).toEqual([
      "deno add npm:x npm:y",
      "deno add -D npm:z",
    ])
    expect(installLines("bun", { dev: "z" })).toEqual(["bun add -d z"])
  })
})

describe("generate", () => {
  let root: string
  const config = (check = false): DocsConfig => ({
    root,
    typesImport: "@/lib/content",
    generatedBy: "test",
    regenerateCommand: "regenerate",
    check,
    site: {
      url: "https://example.test",
      fullTitle: "Example docs",
      llms: ["# Example", ""],
    },
    plain: { cards: () => "- a plain list" },
  })

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "docs-core-"))
    await mkdir(join(root, "content/docs/start"), { recursive: true })
    await mkdir(join(root, "content/blog"), { recursive: true })
    await writeFile(
      join(root, "content/docs/sections.json"),
      JSON.stringify([{ slug: "start", label: "Start" }])
    )
    await writeFile(
      join(root, "content/docs/index.md"),
      "---\ntitle: Home\ndescription: The start.\nsection: start\norder: 1\n---\n\n# Home\n\nWelcome.\n"
    )
    await writeFile(
      join(root, "content/docs/start/install.md"),
      [
        "---",
        "title: Install",
        "description: Get it.",
        "section: start",
        "order: 2",
        "kind: cli",
        "---",
        "",
        "# Install",
        "",
        "<!-- ::cards -->",
        "",
        "## Steps",
        "",
        '```ts file="a.ts" {1}',
        "const a = 1",
        "```",
        "",
        "> [!NOTE] Heads up",
        "> Inside a callout.",
        "",
        "> A quote with code:",
        ">",
        "> ```sh",
        "> bun add x",
        "> ```",
        "",
        "- a list item",
        "",
        "  ```css",
        "  a { color: red }",
        "  ```",
        "",
        "A claim.[^1]",
        "",
        "[^1]: A footnote.",
        "",
      ].join("\n")
    )
    await writeFile(
      join(root, "content/blog/hello.md"),
      "---\ntitle: Hello\nsummary: First.\ndate: 2026-09-01\nauthor: Someone\n---\n\n# Hello\n\n## Part\n\nText.\n"
    )
    await writeFile(
      join(root, "content/blog/covered.md"),
      "---\ntitle: Covered\nsummary: Second.\ndate: 2026-09-02\nauthor: Someone\ncover: https://example.test/a.jpg\n---\n\nText.\n"
    )
    await writeFile(
      join(root, "content/blog/described.md"),
      "---\ntitle: Described\nsummary: Third.\ndate: 2026-09-03\nauthor: Someone\ncover: https://example.test/b.jpg\ncoverAlt: A picture\n---\n\nText.\n"
    )
  })
  afterEach(() => rm(root, { recursive: true, force: true }))

  it("writes the manifest, documents, highlight CSS, llms files and twins", async () => {
    await generate(config())
    const manifest = await readFile(
      join(root, "src/generated/content.gen.ts"),
      "utf8"
    )
    expect(manifest).toContain('"/docs/start/install"')
    expect(manifest).toContain('from "@/lib/content"')
    expect(manifest).toContain('"slug": "start"')
    expect(manifest).toContain('"kind": "cli"')
    expect(manifest).toContain('"cover": "https://example.test/a.jpg"')
    expect(manifest).toContain('"coverAlt": ""')
    expect(manifest).toContain('"coverAlt": "A picture"')
    expect(manifest).not.toContain("SEARCH")
    const records = await readFile(
      join(root, "src/generated/search.gen.ts"),
      "utf8"
    )
    expect(records).toContain("export const SEARCH")
    expect(records).toContain('"/docs/start/install"')
    const llms = await readFile(join(root, "public/llms.txt"), "utf8")
    expect(llms).toContain(
      "[Install](https://example.test/docs/start/install.md)"
    )
    const twin = await readFile(
      join(root, "public/docs/start/install.md"),
      "utf8"
    )
    expect(twin).toContain("- a plain list")
    expect(
      twin.startsWith(
        "# Install\nSource: https://example.test/docs/start/install"
      )
    ).toBe(true)
    const install = await readFile(
      join(root, "src/generated/pages/start/install.json"),
      "utf8"
    )
    expect(install).toContain("md-code")
    expect(install).toContain("md-callout")
    expect(install.match(/md-code/g)?.length).toBeGreaterThanOrEqual(3)
    await readFile(join(root, "src/generated/pages/blog/hello.json"), "utf8")
  })

  it("check mode passes when fresh and fails when a file is stale", async () => {
    await generate(config())
    process.exitCode = 0
    await generate(config(true))
    expect(process.exitCode).toBe(0)
    await writeFile(join(root, "public/llms.txt"), "stale")
    await generate(config(true))
    expect(process.exitCode).toBe(1)
    process.exitCode = 0
  })

  it("removes documents of deleted pages", async () => {
    await generate(config())
    await rm(join(root, "content/docs/start/install.md"))
    await generate(config())
    await expect(
      readFile(join(root, "src/generated/pages/start/install.json"), "utf8")
    ).rejects.toThrow()
  })

  it("rejects sx= in prose, unknown sections and missing fields", async () => {
    const page = join(root, "content/docs/start/bad.md")
    await writeFile(
      page,
      "---\ntitle: Bad\ndescription: x\nsection: start\n---\n\n<div sx={a}>x</div>\n"
    )
    await expect(generate(config())).rejects.toThrow(/sx=/)
    await writeFile(
      page,
      "---\ntitle: Bad\ndescription: x\nsection: nope\n---\n"
    )
    await expect(generate(config())).rejects.toThrow(/unknown section/)
    await writeFile(page, "---\ntitle: Bad\nsection: start\n---\n")
    await expect(generate(config())).rejects.toThrow(/needs a description/)
  })
})
