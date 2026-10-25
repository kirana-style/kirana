import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { gzipSync } from "node:zlib"

import { afterAll, describe, expect, it } from "vite-plus/test"

import { hashOf } from "../src/check.ts"
import { main } from "../src/index.ts"
import { fetchExample, untar, writeExample } from "../src/template.ts"
import { version } from "../src/version.ts"

const root = mkdtempSync(path.join(tmpdir(), "kirana-registry-template-"))
afterAll(() => rmSync(root, { recursive: true, force: true }))

/** One tar header: the fields `untar` reads, the rest zero. */
function header(name: string, size: number, type: string, prefix = "") {
  const block = new Uint8Array(512)
  const put = (text: string, at: number) =>
    block.set(new TextEncoder().encode(text), at)
  put(name, 0)
  put(size.toString(8).padStart(11, "0"), 124)
  put(type, 156)
  put(prefix, 345)
  return block
}

/** A tar archive as GitHub writes one: a pax global header, a directory, files, one long path. */
function tarball(
  files: Record<string, string>,
  top = "kirana-0.3.2"
): Uint8Array {
  const blocks: Uint8Array[] = []
  const add = (block: Uint8Array, body = new Uint8Array()) => {
    blocks.push(block, body, new Uint8Array((512 - (body.length % 512)) % 512))
  }
  add(header("pax_global_header", 0, "g"))
  add(header(`${top}/`, 0, "5"))
  for (const [name, text] of Object.entries(files)) {
    const body = new TextEncoder().encode(text)
    const full = `${top}/${name}`
    if (full.length > 100) {
      const record = `path=${full}\n`
      const line = `${record.length + 3} ${record}`
      add(header("PaxHeader", line.length, "x"), new TextEncoder().encode(line))
      add(header(full.slice(0, 100), body.length, "0"), body)
    } else if (name.endsWith("prefixed.txt")) {
      const cut = full.lastIndexOf("/")
      add(
        header(full.slice(cut + 1), body.length, "0", full.slice(0, cut)),
        body
      )
    } else add(header(full, body.length, "0"), body)
  }
  blocks.push(new Uint8Array(1024))
  const archive = new Uint8Array(
    blocks.reduce((sum, block) => sum + block.length, 0)
  )
  let at = 0
  for (const block of blocks) {
    archive.set(block, at)
    at += block.length
  }
  return archive
}

const EXAMPLE = "packages/kirana/examples/vite-react/"
const PACKAGE = JSON.stringify({
  name: "kirana-example-vite-react",
  type: "module",
  "kirana-example": { edit: "src/main.tsx" },
  dependencies: { "@kirana-style/core": "0.1.0", react: "^19.0.0" },
  devDependencies: {
    "@kirana-style/vite": "0.1.0",
    "kirana-style": "0.1.0",
    vite: "^8.0.0",
  },
})
const LONG = `src/${"deep/".repeat(20)}file.ts`
const SOURCE = {
  [`${EXAMPLE}package.json`]: PACKAGE,
  [`${EXAMPLE}src/main.tsx`]: "createRoot(document.body)\n",
  [`${EXAMPLE}${LONG}`]: "export {}\n",
  [`${EXAMPLE}src/prefixed.txt`]: "via prefix\n",
  "packages/kirana/examples/next-turbopack/package.json": "{}",
  "README.md": "Kirana\n",
}

/** A fetch that serves the archive at the release's URL, and what it was asked for. */
function serving(archive: Uint8Array) {
  const asked: string[] = []
  const fetch = (async (url: string) => {
    asked.push(String(url))
    return new Response(gzipSync(archive))
  }) as unknown as typeof globalThis.fetch
  return { fetch, asked }
}

describe("KRN-DX-029 a project from one of Kirana's examples", () => {
  it("reads a tar archive's files, long paths and prefixed ones included", () => {
    const files = untar(tarball(SOURCE))
    expect(
      new TextDecoder().decode(files.get(`kirana-0.3.2/${EXAMPLE}${LONG}`))
    ).toBe("export {}\n")
    expect(files.has(`kirana-0.3.2/${EXAMPLE}src/prefixed.txt`)).toBe(true)
    expect(files.has("kirana-0.3.2/")).toBe(false)
    expect(untar(new Uint8Array(100)).size).toBe(0)
  })

  it("fetches the release's source once and keeps the example's files", async () => {
    const { fetch, asked } = serving(tarball(SOURCE))
    const files = await fetchExample("vite-react", "0.3.2", { fetch })
    expect(asked).toEqual([
      "https://codeload.github.com/kirana-style/kirana/tar.gz/refs/tags/v0.3.2",
    ])
    expect([...files.keys()].sort()).toEqual(
      ["package.json", LONG, "src/main.tsx", "src/prefixed.txt"].sort()
    )
    await expect(fetchExample("astro", "0.3.2", { fetch })).rejects.toThrow(
      "astro is not one of Kirana 0.3.2's examples (packages/kirana/examples/ in its repository)"
    )
    // Node's own fetch when none is given.
    const original = globalThis.fetch
    globalThis.fetch = fetch
    try {
      expect((await fetchExample("vite-react", "0.3.2")).size).toBe(4)
    } finally {
      globalThis.fetch = original
    }
    const down = (async () => {
      throw new Error("offline")
    }) as unknown as typeof globalThis.fetch
    await expect(
      fetchExample("vite-react", "0.3.2", { fetch: down })
    ).rejects.toThrow(
      "https://codeload.github.com/kirana-style/kirana/tar.gz/refs/tags/v0.3.2: could not be fetched: offline"
    )
    const missing = (async () =>
      new Response("", { status: 404 })) as unknown as typeof globalThis.fetch
    await expect(
      fetchExample("vite-react", "9.9.9", { fetch: missing })
    ).rejects.toThrow("v9.9.9: answered 404")
  })

  it("writes it under the directory's name with this release's versions, into an empty directory only", async () => {
    const { fetch } = serving(tarball(SOURCE))
    const directory = path.join(root, "my-app")
    writeExample(
      await fetchExample("vite-react", "0.4.0", { fetch }),
      directory,
      "0.4.0"
    )
    const manifest = JSON.parse(
      readFileSync(path.join(directory, "package.json"), "utf8")
    )
    expect(manifest).toEqual({
      name: "my-app",
      type: "module",
      dependencies: { "@kirana-style/core": "0.4.0", react: "^19.0.0" },
      devDependencies: {
        "@kirana-style/vite": "0.4.0",
        "kirana-style": "0.4.0",
        vite: "^8.0.0",
      },
    })
    expect(readFileSync(path.join(directory, "src/main.tsx"), "utf8")).toBe(
      "createRoot(document.body)\n"
    )
    expect(() => writeExample(new Map(), directory, "0.4.0")).toThrow(
      `${directory} is not empty: name a new directory`
    )
    const bare = path.join(root, "bare")
    writeExample(
      new Map([["package.json", new TextEncoder().encode("{}")]]),
      bare,
      "0.4.0"
    )
    expect(
      JSON.parse(readFileSync(path.join(bare, "package.json"), "utf8"))
    ).toEqual({
      name: "bare",
    })
  })

  it("starts kirana-style ui init from it, in a new directory", async () => {
    const release = await version()
    const source = {
      ...SOURCE,
      [`${EXAMPLE}tsconfig.json`]:
        '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }',
    }
    const { fetch, asked } = serving(tarball(source))
    const registry = path.join(root, "registry")
    mkdirSync(registry, { recursive: true })
    const content = "export const kit = {}\n"
    writeFileSync(
      path.join(registry, "kit.json"),
      JSON.stringify({
        name: "kit",
        type: "design-system",
        version: "1.0.0",
        files: [
          { path: "kit/kit.ts", type: "lib", content, hash: hashOf(content) },
        ],
      })
    )
    const cwd = mkdtempSync(path.join(root, "projects-"))
    let text = ""
    const code = await main(
      [
        "init",
        "--template",
        "vite-react",
        "app",
        "--registry",
        `@acme=${registry}/{name}.json`,
        "--design",
        "@acme/kit",
        "--no-check",
      ],
      cwd,
      (chunk) => void (text += chunk),
      { fetch, run: () => 0, load: (url) => import(url) }
    )
    expect(code).toBe(0)
    expect(asked).toEqual([
      `https://codeload.github.com/kirana-style/kirana/tar.gz/refs/tags/v${release}`,
    ])
    expect(text.split("\n")[0]).toBe(
      `template: Kirana ${release}'s vite-react in ${path.join(cwd, "app")}`
    )
    expect(existsSync(path.join(cwd, "app/src/lib/kit/kit.ts"))).toBe(true)
    expect(existsSync(path.join(cwd, "app/kirana-style.lock.json"))).toBe(true)
  })

  it("takes one directory, no dry run, and says when the example cannot be had", async () => {
    const run = async (...argv: string[]) => {
      let text = ""
      const code = await main(
        ["init", ...argv],
        root,
        (chunk) => void (text += chunk),
        {
          fetch: (async () =>
            new Response("", { status: 500 })) as unknown as typeof fetch,
        }
      )
      return { code, text }
    }
    expect(await run("--template", "vite-react", "a", "b")).toEqual({
      code: 2,
      text: "kirana-style ui init --template takes one directory\n",
    })
    expect(await run("--template", "vite-react", "--dry-run")).toEqual({
      code: 2,
      text: "kirana-style ui init: --dry-run cannot start from a template\n",
    })
    const failed = await run("--template", "vite-react")
    expect(failed.code).toBe(1)
    expect(failed.text).toMatch(/answered 500\n$/)
  })
})
