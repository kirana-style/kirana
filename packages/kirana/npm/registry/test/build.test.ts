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

import { afterAll, describe, expect, it } from "vite-plus/test"

import {
  INDEX_SCHEMA_URL,
  ITEM_SCHEMA_URL,
  buildRegistry,
  importsOf,
  packageOf,
  runBuild,
  sourcePlace,
  versionsFrom,
  withoutComments,
} from "../src/build.ts"
import type { SourceRegistry } from "../src/build.ts"
import { hashOf } from "../src/check.ts"
import { main } from "../src/index.ts"

const root = mkdtempSync(path.join(tmpdir(), "kirana-registry-build-"))
afterAll(() => rmSync(root, { recursive: true, force: true }))

/** A folder of sources: `{ "src/ui/x.tsx": "…" }` written under a new directory. */
function sources(name: string, files: Record<string, string>): string {
  const at = path.join(root, name)
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(at, file)), { recursive: true })
    writeFileSync(path.join(at, file), content)
  }
  return at
}

const ACME = {
  "package.json": JSON.stringify({
    dependencies: {
      "@base-ui/react": "^1.9.0",
      clsx: "^2.1.1",
      react: "^19.0.0",
      "@kirana-style/core": "0.3.7",
    },
  }),
  "src/lib/utils.ts":
    'import clsx from "clsx"\nexport const join = (...names: string[]) => clsx(names)\n',
  "src/ui/button.styles.ts":
    'import { css } from "@kirana-style/core"\nexport const button = css({ paddingInline: "12px" })\n',
  "src/ui/button.tsx": [
    'import { Button as Base } from "@base-ui/react/button"',
    'import { button } from "./button.styles"',
    'import { join } from "../lib/utils"',
    "export const Button = () => <Base data-x={join(String(button))} />",
    "",
  ].join("\r\n"),
  "src/ui/card.tsx":
    'import { Button } from "./button"\nexport const Card = () => <Button />\n',
}

const ACME_SOURCE: SourceRegistry = {
  name: "Acme",
  homepage: "https://acme.dev",
  items: [
    {
      name: "utils",
      type: "lib",
      version: "1.0.0",
      files: ["src/lib/utils.ts"],
    },
    {
      name: "button",
      type: "component",
      version: "1.0.0",
      title: "Button",
      description: "A button.",
      styles: ["src/ui/button.styles.ts"],
      frameworks: { react: { base: { files: ["./src/ui/button.tsx"] } } },
    },
    {
      name: "card",
      type: "component",
      version: "1.0.0",
      dependencies: {},
      frameworks: { react: { base: { files: ["src/ui/card.tsx"] } } },
    },
  ],
}

describe("KRN-DX-034 a source registry's imports", () => {
  it("reads every import but those in comments", () => {
    expect(
      importsOf(
        [
          'import a from "a"',
          "export { b } from 'b'",
          'import "./side.css"',
          'const c = await import("c")',
          '/* import x from "x" — it\'s commented */',
          '// import y from "y"',
          'const url = "https://example.com" // import z from "z"',
          'import type { T } from "t"',
        ].join("\n")
      )
    ).toEqual(["a", "b", "./side.css", "c", "t"])
  })

  it("drops comments in one pass, whatever the source holds", () => {
    expect(withoutComments('a /* x */ b // y\nc "https://x" // z')).toBe(
      'a  b \nc "https://x" '
    )
    expect(withoutComments("a // b /* c */\nd /* e // f */ g")).toBe("a \nd  g")
    expect(withoutComments("a /* open")).toBe("a ")
    expect(withoutComments("plain")).toBe("plain")
    // Inputs a backtracking pattern takes quadratic time on.
    for (const hostile of [
      `/*${"a/*".repeat(100_000)}`,
      `//${"9//".repeat(100_000)}`,
      "a://".repeat(100_000),
      `${"/**/".repeat(100_000)}//`,
    ]) {
      const started = performance.now()
      withoutComments(hostile)
      expect(performance.now() - started).toBeLessThan(500)
    }
  })

  it("names a specifier's package", () => {
    expect(packageOf("@base-ui/react/button")).toBe("@base-ui/react")
    expect(packageOf("clsx")).toBe("clsx")
    expect(packageOf("lucide-react/icons/x")).toBe("lucide-react")
  })
})

describe("KRN-DX-034 a source file's place", () => {
  it("takes its type from its deepest folder that names one", () => {
    expect(sourcePlace("src/ui/button.tsx")).toEqual({
      source: "src/ui/button.tsx",
      type: "ui",
      path: "button.tsx",
    })
    expect(sourcePlace("./src/components/ui/form/field.tsx")).toEqual({
      source: "src/components/ui/form/field.tsx",
      type: "ui",
      path: "form/field.tsx",
    })
    expect(sourcePlace("src\\hooks\\use-x.ts").type).toBe("hook")
    expect(sourcePlace("blocks/login/page.tsx")).toMatchObject({
      type: "component",
      path: "login/page.tsx",
    })
    expect(sourcePlace("src/pages/home.tsx").type).toBe("page")
  })

  it("keeps a type, path and target the source gives", () => {
    // A type no folder names: the file's name is its path.
    expect(sourcePlace({ source: "src/ui/x/kit.ts", type: "lib" })).toEqual({
      source: "src/ui/x/kit.ts",
      type: "lib",
      path: "kit.ts",
    })
    // A type a folder names: under that folder.
    expect(sourcePlace({ source: "lib/ui/thing.ts", type: "ui" }).path).toBe(
      "thing.ts"
    )
    expect(
      sourcePlace({
        source: "src/ui/button.tsx",
        path: "forms/button.tsx",
        target: "x",
      })
    ).toEqual({
      source: "src/ui/button.tsx",
      type: "ui",
      path: "forms/button.tsx",
      target: "x",
    })
  })

  it("asks for a type where no folder gives one", () => {
    expect(() => sourcePlace("src/thing.ts")).toThrow(
      'src/thing.ts: no folder says its type (ui/, lib/, hooks/, components/, blocks/, pages/): give it a "type"'
    )
  })
})

describe("KRN-DX-034 buildRegistry", () => {
  it("builds each item and the index, imports written for an installed project", () => {
    const at = sources("acme", ACME)
    const built = buildRegistry(ACME_SOURCE, at)
    expect(built.problems).toEqual([])
    const [utils, button, card] = built.items
    expect(utils).toMatchObject({
      $schema: ITEM_SCHEMA_URL,
      name: "utils",
      dependencies: { clsx: "^2.1.1" },
      files: [{ path: "utils.ts", type: "lib" }],
    })
    expect(button!.styles![0]!.path).toBe("button.styles.ts")
    const react = button!.frameworks!.react!.base!
    expect(react.dependencies).toEqual({ "@base-ui/react": "^1.9.0" })
    expect(react.registryDependencies).toEqual(["utils"])
    const content = react.files[0]!.content
    expect(content).toContain('from "./button.styles"')
    expect(content).toContain('from "@/registry/lib/utils"')
    expect(content).not.toContain("\r\n")
    expect(react.files[0]!.hash).toBe(hashOf(content))
    // An empty `dependencies` is dropped; the item a file imports is a registry dependency.
    expect(card).not.toHaveProperty("dependencies")
    expect(card!.frameworks!.react!.base!.registryDependencies).toEqual([
      "button",
    ])
    expect(built.index).toEqual({
      $schema: INDEX_SCHEMA_URL,
      name: "Acme",
      homepage: "https://acme.dev",
      items: [
        { name: "utils", type: "lib", version: "1.0.0" },
        {
          name: "button",
          type: "component",
          title: "Button",
          description: "A button.",
          version: "1.0.0",
          frameworks: { react: ["base"] },
        },
        {
          name: "card",
          type: "component",
          version: "1.0.0",
          frameworks: { react: ["base"] },
        },
      ],
    })
  })

  it("follows folders, extensions, aliases and the dependencies the source declares", () => {
    const at = sources("shapes", {
      "src/lib/format/index.ts": "export const format = 1\n",
      "src/lib/style.css": ".x {}\n",
      "src/ui/Button.vue": "<template><button /></template>\n",
      "src/ui/use.ts": [
        'import { format } from "../lib/format"',
        'import { format as again } from "../lib/format/index"',
        'import Button from "./Button.vue"',
        'import "../lib/style.css"',
        'import { join } from "@/registry/lib/format"',
        'import { other } from "@/components/other"',
        'import fs from "node:fs"',
        'import { ref } from "vue"',
        'import { x } from "pinned"',
        'import { y } from "framework-only"',
        'import { z } from "@kirana-style/core"',
        "export { format, again, Button, join, other, fs, ref, x, y, z }",
        "",
      ].join("\n"),
    })
    const built = buildRegistry(
      {
        items: [
          {
            name: "format",
            type: "lib",
            version: "1.0.0",
            files: ["src/lib/format/index.ts", "src/lib/style.css"],
          },
          {
            name: "use",
            type: "component",
            version: "1.0.0",
            dependencies: { pinned: "^1.0.0" },
            registryDependencies: ["format", "use"],
            frameworks: {
              vue: {
                ark: {
                  files: ["src/ui/use.ts", "src/ui/Button.vue"],
                  dependencies: { "framework-only": "^2.0.0" },
                  registryDependencies: ["format", "extra"],
                },
              },
            },
          },
        ],
      },
      at,
      () => undefined
    )
    expect(built.problems).toEqual([])
    const use = built.items[1]!
    expect(use.registryDependencies).toEqual(["format"])
    expect(use.dependencies).toEqual({ pinned: "^1.0.0" })
    const ark = use.frameworks!.vue!.ark!
    expect(ark.dependencies).toEqual({
      "framework-only": "^2.0.0",
      pinned: "^1.0.0",
    })
    expect(ark.registryDependencies).toEqual(["extra"])
    const content = ark.files[0]!.content
    expect(content).toContain('from "@/registry/lib/format"\n')
    expect(content).toContain('from "@/registry/lib/format/index"')
    expect(content).toContain('from "./Button.vue"')
    expect(content).toContain('import "@/registry/lib/style.css"')
  })

  it("takes a file two items list from the item that imports it, else the first", () => {
    const at = sources("shared", {
      "package.json": JSON.stringify({ dependencies: { clsx: "^2.1.1" } }),
      "src/lib/utils.ts": 'import clsx from "clsx"\nexport const join = clsx\n',
      "src/ui/a.tsx":
        'import { join } from "../lib/utils"\nexport const A = join\n',
    })
    const built = buildRegistry(
      {
        items: [
          {
            name: "utils",
            type: "lib",
            version: "1.0.0",
            files: ["src/lib/utils.ts"],
          },
          {
            name: "more",
            type: "lib",
            version: "1.0.0",
            files: ["src/lib/utils.ts"],
          },
          {
            name: "a",
            type: "component",
            version: "1.0.0",
            files: ["src/ui/a.tsx", "src/lib/utils.ts"],
          },
          {
            name: "b",
            type: "component",
            version: "1.0.0",
            files: ["src/ui/a.tsx"],
          },
        ],
      },
      at
    )
    expect(built.problems).toEqual([])
    expect(built.items[2]).not.toHaveProperty("registryDependencies")
    expect(built.items[3]!.registryDependencies).toEqual(["utils"])
  })

  it("keeps a file's target, and a base that needs nothing has no lists", () => {
    const at = sources("target", {
      "src/ui/page.tsx": "export const Page = 1\n",
    })
    const built = buildRegistry(
      {
        items: [
          {
            name: "page",
            type: "block",
            version: "1.0.0",
            frameworks: {
              react: {
                base: {
                  files: [
                    {
                      source: "src/ui/page.tsx",
                      type: "file",
                      target: "app/page.tsx",
                    },
                  ],
                },
              },
            },
          },
        ],
      },
      at
    )
    expect(built.problems).toEqual([])
    expect(built.items[0]!.frameworks!.react!.base).toEqual({
      files: [
        expect.objectContaining({
          path: "page.tsx",
          type: "file",
          target: "app/page.tsx",
        }),
      ],
    })
  })

  it("says what stops the build", () => {
    const at = sources("broken", {
      "src/ui/x.tsx": [
        'import { y } from "./missing"',
        'import { z } from "@/registry/ui/nowhere"',
        'import unknown from "unversioned"',
        "export const X = 1",
        "",
      ].join("\n"),
    })
    const built = buildRegistry(
      {
        items: [
          { name: "index", type: "lib", version: "1.0.0" },
          {
            name: "x",
            type: "component",
            version: "1.0.0",
            files: ["src/ui/x.tsx"],
          },
          {
            name: "gone",
            type: "component",
            version: "1.0.0",
            frameworks: { react: { base: { files: ["src/ui/gone.tsx"] } } },
          },
          {
            name: "loose",
            type: "component",
            version: "1.0.0",
            files: ["src/loose.tsx"],
          },
          { name: "bad", type: "nothing", version: "1.0.0" } as never,
          { name: "nameless", type: "lib" } as never,
        ],
      },
      at,
      () => undefined
    )
    expect(built.problems).toEqual([
      "index: an item cannot be named index",
      expect.stringContaining("loose: src/loose.tsx: no folder says its type"),
      "x: src/ui/x.tsx: imports ./missing, which is not a file of the registry",
      "x: src/ui/x.tsx: imports @/registry/ui/nowhere, which no item provides",
      "x: src/ui/x.tsx: imports unversioned, which has no version: name it in the item's dependencies",
      "gone: src/ui/gone.tsx: not found",
      "gone: /frameworks/react/base/files must have at least 1 item",
      expect.stringMatching(/^bad: \/type /),
      "nameless: /version is required",
    ])
  })
})

describe("KRN-DX-034 versionsFrom", () => {
  it("reads the registry's package.json, a catalog from the workspace above", () => {
    const workspace = sources("workspace", {
      "package.json": JSON.stringify({
        workspaces: { catalog: { clsx: "^2.1.1" } },
      }),
      "registry/package.json": JSON.stringify({
        devDependencies: { a: "^1.0.0", b: "^0.1.0" },
        peerDependencies: { b: "^1.0.0" },
        dependencies: { clsx: "catalog:", missing: "catalog:" },
      }),
    })
    const versions = versionsFrom(path.join(workspace, "registry"))
    expect(versions("a")).toBe("^1.0.0")
    expect(versions("b")).toBe("^1.0.0")
    expect(versions("clsx")).toBe("^2.1.1")
    expect(versions("missing")).toBeUndefined()
    expect(versions("absent")).toBeUndefined()
    const bun = sources("bun-catalog", {
      "package.json": JSON.stringify({
        catalog: { zod: "^4.0.0" },
        dependencies: { zod: "catalog:" },
      }),
    })
    expect(versionsFrom(bun)("zod")).toBe("^4.0.0")
  })

  it("reads nothing where there is no package.json, nor a catalog", () => {
    expect(versionsFrom(path.join(root, "nowhere"))("clsx")).toBeUndefined()
    const lone = sources("lone", {
      "package.json": JSON.stringify({ dependencies: { clsx: "catalog:" } }),
    })
    expect(versionsFrom(lone)("clsx")).toBeUndefined()
  })
})

describe("KRN-DX-034 kirana-style ui build", () => {
  const run = async (args: string[], cwd: string) => {
    let out = ""
    const code = await runBuild(args, cwd, (text) => {
      out += text
    })
    return { code, out }
  }

  it("writes each item and the index, to public/r by default", async () => {
    const at = sources("cli", {
      ...ACME,
      "registry.json": JSON.stringify(ACME_SOURCE),
    })
    expect(await run([], at)).toEqual({
      code: 0,
      out: "build: 3 item(s) and the index in public/r\n",
    })
    const index = JSON.parse(
      readFileSync(path.join(at, "public/r/index.json"), "utf8")
    )
    expect(index.items.map((item: { name: string }) => item.name)).toEqual([
      "utils",
      "button",
      "card",
    ])
    expect(existsSync(path.join(at, "public/r/card.json"))).toBe(true)
    expect((await run(["registry.json", "--out", "."], at)).out).toBe(
      "build: 3 item(s) and the index in .\n"
    )
    expect(existsSync(path.join(at, "button.json"))).toBe(true)
  })

  it("is reached through main", async () => {
    const at = sources("main", {
      ...ACME,
      "registry.json": JSON.stringify(ACME_SOURCE),
    })
    let out = ""
    const code = await main(["build", "--out", "dist/r"], at, (text) => {
      out += text
    })
    expect(code).toBe(0)
    expect(out).toBe("build: 3 item(s) and the index in dist/r\n")
  })

  it("writes nothing on a problem", async () => {
    const at = sources("cli-broken", {
      "registry.json": JSON.stringify({
        items: [
          { name: "x", type: "lib", version: "1.0.0", files: ["src/lib/x.ts"] },
        ],
      }),
    })
    expect(await run([], at)).toEqual({
      code: 1,
      out: "x: src/lib/x.ts: not found\nbuild: 1 problem(s), nothing written\n",
    })
    expect(existsSync(path.join(at, "public"))).toBe(false)
  })

  it("refuses a source it cannot read, or one with no items", async () => {
    const at = sources("cli-bad", {
      "registry.json": "{",
      "empty.json": "{}",
    })
    expect((await run([], at)).out).toMatch(/^registry\.json: /)
    expect((await run(["empty.json"], at)).out).toBe(
      "empty.json: lists no items\n"
    )
    // A directory has no relative name from itself: the path is written whole.
    const directory = await run(["."], at)
    expect(directory.code).toBe(1)
    expect(directory.out.startsWith(`${at}: `)).toBe(true)
  })

  it("exits 2 on a malformed command", async () => {
    expect(await run(["--outdir", "x"], root)).toEqual({
      code: 2,
      out: "kirana-style ui build: unknown option --outdir\n",
    })
    expect(await run(["a.json", "b.json"], root)).toEqual({
      code: 2,
      out: "kirana-style ui build takes one source registry\n",
    })
  })
})
