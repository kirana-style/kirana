import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { gzipSync } from "node:zlib"

import { afterAll, describe, expect, it } from "vite-plus/test"

import { hashOf } from "../src/check.ts"
import { main } from "../src/index.ts"
import {
  fetchExample,
  startTemplate,
  untar,
  writeExample,
} from "../src/template.ts"
import type { Unpacked } from "../src/template.ts"
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
      [`${EXAMPLE}index.html`]: '<html lang="en"><body></body></html>\n',
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
        "--pointer",
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
    // The template's own root document takes the project options (KF-077).
    expect(readFileSync(path.join(cwd, "app/index.html"), "utf8")).toBe(
      '<html data-pointer lang="en"><body></body></html>\n'
    )
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

/** A template's archive, gzipped: its files under one top folder, as kirana-ui packs them. */
const packed = (files: Record<string, string>, top = "shop") =>
  gzipSync(tarball(files, top))

/** A Turborepo around `apps/web`, which asks for the package manager and names its app. */
const TURBO = {
  "package.json": JSON.stringify({
    name: "my-app",
    private: true,
    packageManager: "{packageManager}",
    workspaces: ["apps/*"],
    "kirana-template": { project: "apps/web" },
    devDependencies: { turbo: "^2.11.10" },
  }),
  "turbo.json": "{}\n",
  "apps/web/package.json": JSON.stringify({
    name: "web",
    type: "module",
    dependencies: { react: "^19.3.0", "@kirana-style/core": "0.4.0" },
    devDependencies: { vite: "^8.3.0" },
  }),
  "apps/web/tsconfig.json":
    '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }',
  "apps/web/index.html": '<html lang="en"><body></body></html>\n',
  "apps/web/src/main.tsx": "createRoot(document.body)\n",
}
/** One app, which names no package manager. */
const SINGLE = {
  "package.json": JSON.stringify({ name: "single", private: true }),
  "tsconfig.json": '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }',
  "src/main.tsx": "export {}\n",
}

const PNPM = {
  npm_config_user_agent: "pnpm/9.12.0 npm/? node/v24.0.0 linux x64",
}
const BUN = { npm_config_user_agent: "bun/1.3.1 npm/? node/v24.3.0 linux x64" }

/**
 * A registry on disk with a design system (`kit`) and `templates/index.json` beside its items: the
 * Turborepo packed once per package manager, the single app once.
 */
function templateRegistry(): string {
  const registry = mkdtempSync(path.join(root, "registry-"))
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
  mkdirSync(path.join(registry, "templates"))
  const write = (name: string, body: Uint8Array | string) =>
    writeFileSync(path.join(registry, "templates", name), body)
  write(
    "index.json",
    JSON.stringify({
      $schema: "https://kirana.style/schema/registry-templates.json",
      templates: [
        {
          name: "vite-react--turbo--oxlint",
          title: "Vite in a Turborepo",
          files: {
            npm: "vite-react--turbo--oxlint.npm.tgz",
            pnpm: "vite-react--turbo--oxlint.pnpm.tgz",
          },
          meta: { monorepo: "turbo" },
        },
        { name: "single", file: "single.tgz" },
        { name: "bare", files: { bun: "bare.tgz" } },
      ],
    })
  )
  write("vite-react--turbo--oxlint.npm.tgz", packed(TURBO))
  write("vite-react--turbo--oxlint.pnpm.tgz", packed(TURBO))
  write("single.tgz", packed(SINGLE))
  return registry
}

/** `init` in a new folder of `root`, with what it printed and every command it ran. */
async function initIn(
  argv: string[],
  options: { env?: Record<string, string>; fetch?: typeof fetch; fails?: true }
) {
  const cwd = mkdtempSync(path.join(root, "projects-"))
  const ran: [string, string][] = []
  let text = ""
  const code = await main(
    ["init", ...argv],
    cwd,
    (chunk) => void (text += chunk),
    {
      env: options.env ?? {},
      ...(options.fetch ? { fetch: options.fetch } : {}),
      load: (url) => import(url),
      run: (command, where) => {
        ran.push([command, path.relative(cwd, where)])
        // The install writes the lockfile the package manager is then read from.
        if (command === "pnpm install")
          writeFileSync(path.join(where, "pnpm-lock.yaml"), "")
        return options.fails ? 1 : 0
      },
    }
  )
  return { code, text, ran, cwd }
}

describe("KRN-DX-029 a project from a registry's template, or an archive's URL (KF-108)", () => {
  it("finds @namespace/name in templates/index.json beside the registry's index, and starts init in the app it names", async () => {
    const registry = templateRegistry()
    const { code, text, ran, cwd } = await initIn(
      [
        "--template",
        "@acme/vite-react--turbo--oxlint",
        "my-app",
        "--registry",
        `@acme=${registry}/{name}.json`,
        "--design",
        "@acme/kit",
        "--pointer",
        "--rtl",
        "--no-check",
      ],
      { env: PNPM }
    )
    expect(code).toBe(0)
    const app = path.join(cwd, "my-app")
    expect(text.split("\n").slice(0, 4)).toEqual([
      `template: @acme/vite-react--turbo--oxlint from ${pathToFileURL(registry).href}/templates/vite-react--turbo--oxlint.pnpm.tgz in ${app}`,
      "packages: pnpm install",
      "template: init goes on in apps/web",
      expect.stringMatching(/^kirana: /),
    ])
    // The workspace installs first, at its root; init's packages go into the app, with pnpm.
    expect(ran[0]).toEqual(["pnpm install", "my-app"])
    expect(ran.slice(1).length).toBeGreaterThan(0)
    for (const [command, where] of ran.slice(1)) {
      expect(command).toMatch(/^pnpm /)
      expect(where).toBe(path.join("my-app", "apps/web"))
    }
    expect(
      JSON.parse(readFileSync(path.join(app, "package.json"), "utf8"))
    ).toEqual({
      name: "my-app",
      private: true,
      packageManager: "pnpm@9.12.0",
      workspaces: ["apps/*"],
      devDependencies: { turbo: "^2.11.10" },
    })
    expect(existsSync(path.join(app, "turbo.json"))).toBe(true)
    expect(existsSync(path.join(app, "apps/web/src/lib/kit/kit.ts"))).toBe(true)
    expect(existsSync(path.join(app, "apps/web/kirana-style.lock.json"))).toBe(
      true
    )
    expect(existsSync(path.join(app, "kirana-style.lock.json"))).toBe(false)
    expect(readFileSync(path.join(app, "apps/web/index.html"), "utf8")).toBe(
      '<html dir="rtl" data-pointer lang="en"><body></body></html>\n'
    )
  })

  it("reads @kirana's templates beside its index on the web, and names the directory after the template", async () => {
    const asked: [string, string | undefined][] = []
    const fetch = (async (url: URL, init: RequestInit) => {
      asked.push([
        String(url),
        (init.headers as Record<string, string>).authorization,
      ])
      return String(url).endsWith("/templates/index.json")
        ? Response.json({
            templates: [{ name: "single", file: "../files/single.tgz" }],
          })
        : new Response(packed(SINGLE))
    }) as unknown as typeof globalThis.fetch
    const { code, text, ran, cwd } = await initIn(
      ["--template", "@kirana/single"],
      { env: BUN, fetch, fails: true }
    )
    expect(asked).toEqual([
      ["https://ui.kirana.style/r/templates/index.json", undefined],
      ["https://ui.kirana.style/r/files/single.tgz", undefined],
    ])
    expect(code).toBe(1)
    // No packageManager asked for: the one running init installs it.
    expect(ran).toEqual([["bun install", "single"]])
    expect(text).toBe(
      `template: @kirana/single from https://ui.kirana.style/r/files/single.tgz in ${path.join(cwd, "single")}\n` +
        "packages: bun install\n" +
        `bun install failed: the template is in ${path.join(cwd, "single")}, Kirana is not set up in it\n`
    )
    expect(
      JSON.parse(readFileSync(path.join(cwd, "single/package.json"), "utf8"))
    ).toEqual({ name: "single", private: true })
  })

  it("unpacks a template's archive by URL or path, named after its file", async () => {
    const fetch = (async () =>
      new Response(
        packed({
          ...SINGLE,
          "package.json": JSON.stringify({
            name: "x",
            packageManager: "yarn@4.18.1",
          }),
        })
      )) as unknown as typeof globalThis.fetch
    const url = "https://templates.acme.dev/shop.tar.gz"
    const byUrl = await initIn(["--template", url], {
      env: PNPM,
      fetch,
      fails: true,
    })
    expect(byUrl.text.split("\n").slice(0, 2)).toEqual([
      `template: ${url} in ${path.join(byUrl.cwd, "shop")}`,
      // The package manager the template names over the one running init.
      "packages: yarn install",
    ])
    const archive = path.join(root, "local.tgz")
    writeFileSync(archive, packed(SINGLE))
    const byPath = await initIn(["--template", archive, "here"], {
      fails: true,
    })
    expect(byPath.text.split("\n").slice(0, 2)).toEqual([
      `template: ${archive} from ${pathToFileURL(archive).href} in ${path.join(byPath.cwd, "here")}`,
      // Nothing says which package manager: npm, as for any project without a lockfile.
      "packages: npm install",
    ])
  })

  it("takes the archive for the package manager running init, else the template's one archive", async () => {
    const registry = templateRegistry()
    const flags = ["--registry", `@acme=${registry}/{name}.json`]
    const npm = await initIn(
      ["--template", "@acme/vite-react--turbo--oxlint", ...flags],
      { env: { npm_config_user_agent: "npm/12.2.2 node/v24.0.0" }, fails: true }
    )
    expect(npm.text.split("\n")[0]).toMatch(/oxlint\.npm\.tgz in /)
    expect(
      JSON.parse(
        readFileSync(
          path.join(npm.cwd, "vite-react--turbo--oxlint/package.json"),
          "utf8"
        )
      ).packageManager
    ).toBe("npm@12.2.2")
    const yarn = await initIn(
      ["--template", "@acme/vite-react--turbo--oxlint", ...flags],
      { env: { npm_config_user_agent: "yarn/4.18.1 npm/? node/v24.0.0" } }
    )
    expect(yarn).toMatchObject({
      code: 1,
      text: `@acme/vite-react--turbo--oxlint has no archive for yarn: ${pathToFileURL(registry).href}/templates/index.json has one for npm, pnpm\n`,
    })
    // Installed, init goes on in the template's root.
    const single = await initIn(
      ["--template", "@acme/single", ...flags, "--design", "@acme/kit"],
      { env: PNPM }
    )
    expect(single.text.split("\n")[0]).toMatch(/single\.tgz in /)
    expect(single.ran[0]).toEqual(["pnpm install", "single"])
    expect(
      existsSync(path.join(single.cwd, "single/kirana-style.lock.json"))
    ).toBe(true)
    // Run by something that does not say what it is, a template asking for its package manager stops.
    const unknown = await initIn(
      ["--template", "@acme/vite-react--turbo--oxlint", ...flags],
      {}
    )
    expect(unknown.code).toBe(1)
    expect(unknown.text).toBe(
      `${pathToFileURL(registry).href}/templates/vite-react--turbo--oxlint.npm.tgz: names the package manager running kirana-style ({packageManager}), which says nothing of itself: run it with npx, pnpm dlx, yarn dlx or bunx\n`
    )
    expect(
      existsSync(path.join(unknown.cwd, "vite-react--turbo--oxlint"))
    ).toBe(false)
  })

  it("says when a template is not in the index, the index is not one, or the name is not a template's", async () => {
    const registry = templateRegistry()
    const flags = ["--registry", `@acme=${registry}/{name}.json`]
    const index = `${pathToFileURL(registry).href}/templates/index.json`
    expect(
      await initIn(["--template", "@acme/astro", ...flags], { env: PNPM })
    ).toMatchObject({
      code: 1,
      text: `@acme/astro is not one of the 3 templates ${index} lists\n`,
    })
    expect(
      await initIn(["--template", "@acme/bare", ...flags], { env: PNPM })
    ).toMatchObject({
      code: 1,
      text: `@acme/bare has no archive for pnpm: ${index} has one for bun\n`,
    })
    expect(
      await initIn(["--template", "@nobody/shop"], { env: PNPM })
    ).toMatchObject({
      code: 1,
      text: "@nobody is not a registry this project knows: @kirana (ui.registries in kirana.config)\n",
    })
    expect(await initIn(["--template", "@acme"], {})).toMatchObject({
      code: 1,
      text: "@acme: a registry's template is @namespace/name\n",
    })
    writeFileSync(
      path.join(registry, "templates/index.json"),
      JSON.stringify({ templates: [{ name: "Shop", file: "" }], extra: true })
    )
    expect(
      (await initIn(["--template", "@acme/shop", ...flags], {})).text
    ).toBe(
      [
        `${index}: /templates/0/name must match ^[a-z0-9]+(-{1,2}[a-z0-9]+)*$`,
        `${index}: /templates/0/file must have at least 1 character`,
        `${index}: /extra is not allowed here`,
        "",
      ].join("\n")
    )
    writeFileSync(path.join(registry, "templates/index.json"), "[]")
    expect(
      (await initIn(["--template", "@acme/shop", ...flags], {})).text
    ).toBe(`${index}: / must be an object\n`)
  })

  it("refuses an archive that is not one, writes outside the project, or lacks the project it names", async () => {
    const answering = (body: Uint8Array) =>
      (async () =>
        new Response(Buffer.from(body))) as unknown as typeof globalThis.fetch
    const url = "https://templates.acme.dev/shop.tgz"
    const tried = async (body: Uint8Array) =>
      (await initIn(["--template", url], { env: PNPM, fetch: answering(body) }))
        .text
    expect(
      (await initIn(["--template", "http://acme.dev/shop.tgz"], {})).text
    ).toBe(
      "http://acme.dev/shop.tgz: only https, or http from this machine, can be fetched\n"
    )
    // The environment's user agent when none is given.
    let text = ""
    expect(
      await main(
        ["init", "--template", url],
        root,
        (chunk) => void (text += chunk),
        {
          fetch: (async () =>
            new Response("", { status: 500 })) as unknown as typeof fetch,
        }
      )
    ).toBe(1)
    expect(text).toBe(`${url}: answered 500\n`)
    expect(await tried(new TextEncoder().encode("<html>"))).toBe(
      `${url}: is not a gzipped tar archive\n`
    )
    expect(await tried(packed({ ...SINGLE, "../escape.txt": "x" }))).toBe(
      `${url}: holds ../escape.txt, a path outside the project\n`
    )
    // Files beside the top folder are left out, as giget leaves them.
    const body = new Uint8Array(512)
    body.set(new TextEncoder().encode("{}"))
    const loose = gzipSync(
      Buffer.concat([header("package.json", 2, "0"), body, tarball({})])
    )
    expect(await tried(loose)).toBe(
      `${url}: holds no file under a top folder\n`
    )
    expect(await tried(packed({ "src/main.tsx": "" }))).toBe(
      `${url}: has no package.json at its root\n`
    )
    expect(await tried(packed({ "package.json": "{" }))).toMatch(
      new RegExp(
        `^${url.replaceAll(".", "\\.")}: its package\\.json is not JSON: `
      )
    )
    for (const project of ["apps/api", 7])
      expect(
        await tried(
          packed({
            ...TURBO,
            "package.json": JSON.stringify({ "kirana-template": { project } }),
          })
        )
      ).toBe(
        `${url}: kirana-template.project in its package.json is ${JSON.stringify(project)}, not a folder of it with a package.json\n`
      )
  })
})

/** A Solid app as a registry's template packs it: on Solid 1, or on Solid 2 with `@solidjs/web`. */
const solidApp = (solid2: boolean) => ({
  "package.json": JSON.stringify({
    name: "app",
    private: true,
    dependencies: solid2
      ? { "solid-js": "^2.0.3", "@solidjs/web": "^2.0.3" }
      : { "solid-js": "^1.9.9" },
  }),
  "tsconfig.json": '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }',
  "src/index.tsx": "export {}\n",
})

/**
 * A registry whose Solid on ui-sdk base needs Solid 2 (KF-134): a design system whose preset `p0`
 * gives solid/ark and `p2` solid/uisdk, an index naming ark the default and, unless `requires` is
 * false, what uisdk needs, and templates on both Solids. `templates` replaces the templates' entries.
 */
function runtimeRegistry(
  options: {
    requires?: false
    defaultBase?: false
    templates?: Record<string, unknown>[]
  } = {}
): string {
  const registry = mkdtempSync(path.join(root, "runtimes-"))
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
      design: {
        axes: { style: { attribute: "data-style", values: ["nova"] } },
        presets: {
          p: [
            { axis: "framework", values: ["solid"], bits: 1 },
            { axis: "base", values: ["ark", "uisdk"], bits: 1 },
          ],
        },
      },
    })
  )
  writeFileSync(
    path.join(registry, "index.json"),
    JSON.stringify({
      ...(options.defaultBase === false
        ? {}
        : { defaultBase: { solid: "ark" } }),
      ...(options.requires === false
        ? {}
        : { requires: { solid: { uisdk: "solid2" } } }),
      items: [
        { name: "kit", type: "design-system", version: "1.0.0" },
        {
          name: "button",
          type: "component",
          version: "1.0.0",
          frameworks: { solid: ["ark", "uisdk"] },
        },
      ],
    })
  )
  mkdirSync(path.join(registry, "templates"))
  const write = (name: string, body: Uint8Array | string) =>
    writeFileSync(path.join(registry, "templates", name), body)
  write(
    "index.json",
    JSON.stringify({
      $schema: "https://kirana.style/schema/registry-templates.json",
      templates: options.templates ?? [
        { name: "vite-react--none", framework: "react", file: "react.tgz" },
        { name: "vite-solid--turbo", framework: "solid", file: "solid.tgz" },
        { name: "vite-solid--none", framework: "solid", file: "solid.tgz" },
        {
          name: "vite-solid2--turbo",
          framework: "solid",
          runtime: "solid2",
          file: "solid2.tgz",
        },
        {
          name: "vite-solid2--none",
          framework: "solid",
          runtime: "solid2",
          file: "solid2.tgz",
        },
      ],
    })
  )
  write(
    "react.tgz",
    packed({
      ...solidApp(false),
      "package.json": JSON.stringify({ dependencies: { react: "^19.3.0" } }),
    })
  )
  write("solid.tgz", packed(solidApp(false)))
  write("solid2.tgz", packed(solidApp(true)))
  return registry
}

describe("KF-134 ui init --template checks the runtime the base needs", () => {
  /** `init --template` from the registry, and whether anything was written or run. */
  const fromTemplate = async (registry: string, ...argv: string[]) => {
    const result = await initIn(
      [...argv, "--registry", `@acme=${registry}/{name}.json`, "--no-check"],
      { env: PNPM }
    )
    return { ...result, written: readdirSync(result.cwd) }
  }

  it("refuses a template on another runtime than the base needs, naming the one that fits, before writing", async () => {
    const registry = runtimeRegistry()
    // Solid on ui-sdk, from a preset, on a Solid 1 template.
    const uisdk = await fromTemplate(
      registry,
      "--template",
      "@acme/vite-solid--none",
      "--preset",
      "p2"
    )
    expect(uisdk).toMatchObject({
      code: 1,
      text: "@acme/vite-solid--none is on solid1, and @acme's solid/uisdk base needs solid2: nothing written; start from @acme/vite-solid2--none, on solid2\n",
      ran: [],
      written: [],
    })
    // The reverse: Ark UI, the registry's default base, on the Solid 2 template; the closest name wins.
    const ark = await fromTemplate(
      registry,
      "--template",
      "@acme/vite-solid2--turbo"
    )
    expect(ark).toMatchObject({
      code: 1,
      text: "@acme/vite-solid2--turbo is on solid2, and @acme's solid/ark base needs solid1: nothing written; start from @acme/vite-solid--turbo, on solid1\n",
      written: [],
    })
    // A base named by its flag over the default.
    expect(
      (
        await fromTemplate(
          registry,
          "--template",
          "@acme/vite-solid--none",
          "--base",
          "uisdk"
        )
      ).text
    ).toBe(
      "@acme/vite-solid--none is on solid1, and @acme's solid/uisdk base needs solid2: nothing written; start from @acme/vite-solid2--none, on solid2\n"
    )
  })

  it("refuses, in a project of its own, a base on another runtime than the project's", async () => {
    const registry = runtimeRegistry()
    /** `init` in a Solid app already there, on Solid 1 or 2, and what it wrote. */
    const inApp = async (solid2: boolean, ...argv: string[]) => {
      const cwd = mkdtempSync(path.join(root, "solid-app-"))
      for (const [name, text] of Object.entries(solidApp(solid2))) {
        mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true })
        writeFileSync(path.join(cwd, name), text)
      }
      let text = ""
      const code = await main(
        [
          "init",
          ...argv,
          "--registry",
          `@acme=${registry}/{name}.json`,
          "--no-check",
        ],
        cwd,
        (chunk) => void (text += chunk),
        { env: {}, load: (url) => import(url), run: () => 0 }
      )
      return { code, text, written: readdirSync(cwd).sort() }
    }
    expect(await inApp(false, "--preset", "p2")).toEqual({
      code: 1,
      text: "@acme's solid/uisdk base needs solid2, and the project is on solid1: nothing written; take a base on solid1 (ark)\n",
      written: ["package.json", "src", "tsconfig.json"],
    })
    expect((await inApp(true)).text).toBe(
      "@acme's solid/ark base needs solid1, and the project is on solid2: nothing written; take a base on solid2 (uisdk)\n"
    )
    expect((await inApp(true, "--preset", "p2")).code).toBe(0)
    // An index that cannot be read names no runtime.
    const index = readFileSync(path.join(registry, "index.json"), "utf8")
    rmSync(path.join(registry, "index.json"))
    expect(
      (
        await inApp(
          false,
          "--design",
          "@acme/kit",
          "--framework",
          "solid",
          "--base",
          "uisdk"
        )
      ).code
    ).toBe(0)
    writeFileSync(path.join(registry, "index.json"), index)
    // A base the index lists for no runtime the project is on.
    writeFileSync(
      path.join(registry, "index.json"),
      JSON.stringify({
        requires: { solid: { uisdk: "solid2", ark: "solid2" } },
        items: [
          { name: "kit", type: "design-system", version: "1.0.0" },
          {
            name: "dialog",
            type: "component",
            version: "1.0.0",
            frameworks: { solid: ["ark", "uisdk"] },
          },
        ],
      })
    )
    expect((await inApp(false, "--base", "ark")).text).toBe(
      "@acme's solid/ark base needs solid2, and the project is on solid1: nothing written; @acme has no solid base on solid1\n"
    )
  })

  it("reads an example's packages before writing it, none where it has no package.json", async () => {
    const seen: Unpacked[] = []
    const vet = async (unpacked: Unpacked) => {
      seen.push(unpacked)
      throw new Error("refused")
    }
    const { fetch } = serving(
      tarball({
        [`${EXAMPLE}package.json`]: PACKAGE,
        "packages/kirana/examples/bare/README.md": "Bare\n",
      })
    )
    const start = mkdtempSync(path.join(root, "vetted-"))
    for (const example of ["vite-react", "bare"])
      await expect(
        startTemplate(example, undefined, start, {}, () => {}, { fetch }, vet)
      ).rejects.toThrow("refused")
    expect(seen).toEqual([
      {
        template: "vite-react",
        listed: {
          "@kirana-style/core": "0.1.0",
          react: "^19.0.0",
          "@kirana-style/vite": "0.1.0",
          "kirana-style": "0.1.0",
          vite: "^8.0.0",
        },
      },
      { template: "bare", listed: {} },
    ])
    expect(readdirSync(start)).toEqual([])
  })

  it("tells an archive's runtime from its packages, and says when no template it lists fits", async () => {
    const registry = runtimeRegistry({
      templates: [
        { name: "vite-solid", file: "solid.tgz" },
        { name: "vite-react", framework: "react", file: "solid.tgz" },
      ],
    })
    // An entry that names no framework: its archive's packages say Solid 1.
    expect(
      (
        await fromTemplate(
          registry,
          "--template",
          "@acme/vite-solid",
          "--preset",
          "p2"
        )
      ).text
    ).toBe(
      "@acme/vite-solid is on solid1, and @acme's solid/uisdk base needs solid2: nothing written; no template @acme lists is on solid2\n"
    )
    // An archive by its path has no index to name one from.
    const archive = path.join(root, "solid2-app.tgz")
    writeFileSync(archive, packed(solidApp(true)))
    const byPath = await fromTemplate(
      registry,
      "--template",
      archive,
      "--design",
      "@acme/kit"
    )
    expect(byPath).toMatchObject({
      code: 1,
      text: `${archive} is on solid2, and @acme's solid/ark base needs solid1: nothing written; start from a template on solid1\n`,
      written: [],
    })
  })

  it("starts from a template on the runtime the base needs, and from any template where the index names none", async () => {
    const registry = runtimeRegistry()
    for (const [template, preset] of [
      ["@acme/vite-solid2--none", "p2"],
      ["@acme/vite-solid--none", "p0"],
    ] as const) {
      const { code, text, cwd } = await fromTemplate(
        registry,
        "--template",
        template,
        "--preset",
        preset,
        "app"
      )
      expect([template, code]).toEqual([template, 0])
      expect(text).toContain(`template: ${template} from `)
      expect(existsSync(path.join(cwd, "app/src/lib/kit/kit.ts"))).toBe(true)
    }
    // A preset for another framework than the template's, and no base yet, are left to what follows.
    expect(
      (
        await fromTemplate(
          registry,
          "--template",
          "@acme/vite-react--none",
          "--preset",
          "p2"
        )
      ).text
    ).toContain("template: @acme/vite-react--none from ")
    expect(
      (
        await fromTemplate(
          runtimeRegistry({ defaultBase: false }),
          "--template",
          "@acme/vite-solid2--none"
        )
      ).code
    ).toBe(0)
    // Without `requires`, the index behaves as it did before.
    const before = runtimeRegistry({ requires: false })
    const { code, text } = await fromTemplate(
      before,
      "--template",
      "@acme/vite-solid--none",
      "--preset",
      "p2"
    )
    expect(code).toBe(0)
    expect(text).toContain("@acme/kit 1.0.0\n")
    // An index that cannot be read leaves the check to what follows.
    rmSync(path.join(before, "index.json"))
    expect(
      (
        await fromTemplate(
          before,
          "--template",
          "@acme/vite-solid2--none",
          "--design",
          "@acme/kit"
        )
      ).code
    ).toBe(0)
  })
})
