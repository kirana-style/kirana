import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import type { BuilderContext } from "@angular-devkit/architect"
import { afterAll, describe, expect, it, vi } from "vite-plus/test"

/** What Angular's builders were given; `touch` edits a source while one is running (watch mode). */
const angular = vi.hoisted(() => ({
  options: [] as unknown[],
  touch: undefined as (() => Promise<void>) | undefined,
}))
vi.mock("@angular/build", () => ({
  buildApplication: async function* (options: unknown) {
    angular.options.push(options)
    await angular.touch?.()
    yield { success: true }
  },
  executeDevServerBuilder: async function* (
    _options: unknown,
    wrapped: BuilderContext
  ) {
    angular.options.push(
      await wrapped.getTargetOptions({ project: "app", target: "build" })
    )
    await angular.touch?.()
    yield { success: true }
  },
}))

const {
  application,
  applicationBuilder,
  devServer,
  devServerBuilder,
  withMirror,
} = await import("../src/builders.ts")
const { MIRROR, STYLESHEET, createMirror, walk, watchMirror } =
  await import("../src/mirror.ts")

const created: string[] = []
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)

const CARD = `import { css } from "@kirana-style/core"
export const card = css({ color: "rgb(1, 2, 3)" })
`

/** An Angular project inside the workspace (so `@kirana-style/core` resolves). */
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

function context(root: string, metadata: Record<string, unknown> = {}) {
  const logged: string[] = []
  const fake = {
    workspaceRoot: root,
    target: { project: "app", target: "build" },
    getProjectMetadata: async () => metadata,
    getTargetOptions: async () => ({
      browser: "src/main.ts",
      styles: ["src/styles.css"],
    }),
    logger: {
      warn: (message: string) => logged.push(`warn ${message}`),
      error: (message: string) => logged.push(`error ${message}`),
    },
  }
  return { context: fake as unknown as BuilderContext, logged }
}

describe("D-068 the Angular CLI mirror", () => {
  it("copies the source folder, compiles what holds styles, and writes the stylesheet", async () => {
    const root = project({
      "src/main.ts": "bootstrap()\n",
      "src/app/card.ts": CARD,
      "src/app/types.ts": `import type { Sx } from "@kirana-style/core"\nexport type P = { sx?: Sx }\n`,
      "src/app/card.html": "<p></p>",
      "src/env.d.ts": "",
      "src/.hidden/x.ts": "",
    })
    const mirror = await createMirror(root, "src", { minify: true })
    expect(walk(path.join(root, "src")).sort()).toEqual(
      [
        "app/card.html",
        "app/card.ts",
        "app/types.ts",
        "env.d.ts",
        "main.ts",
      ].map((file) => path.normalize(file))
    )
    const compiled = readFileSync(
      path.join(root, MIRROR, "src/app/card.ts"),
      "utf8"
    )
    expect(compiled).not.toContain("css({")
    expect(
      readFileSync(path.join(root, MIRROR, "src/app/card.html"), "utf8")
    ).toBe("<p></p>")
    expect(readFileSync(path.join(root, STYLESHEET), "utf8")).toContain(
      "color:rgb(1,2,3)"
    )
    expect(mirror.replacements).toEqual([
      {
        replace: path.join("src", "app/card.ts"),
        with: path.join(MIRROR, "src", "app/card.ts"),
      },
      {
        replace: path.join("src", "app/types.ts"),
        with: path.join(MIRROR, "src", "app/types.ts"),
      },
      {
        replace: path.join("src", "main.ts"),
        with: path.join(MIRROR, "src", "main.ts"),
      },
    ])
    // A module that only imports types from Kirana is mirrored as written.
    expect(
      readFileSync(path.join(root, MIRROR, "src/app/types.ts"), "utf8")
    ).toContain("import type")
    expect(mirror.messages()).toEqual([])
  })

  it("mirrors a change, a deletion and the diagnostics they bring", async () => {
    const root = project({ "src/app/card.ts": CARD })
    const mirror = await createMirror(root, "src")
    // An edit that leaves the stylesheet as it is does not rewrite it.
    expect(mirror.update("src/app/card.ts")).toBe(false)
    writeFileSync(
      path.join(root, "src/app/card.ts"),
      CARD.replace("rgb(1, 2, 3)", "rgb(4, 5, 6)")
    )
    expect(mirror.update("src/app/card.ts")).toBe(true)
    expect(readFileSync(path.join(root, STYLESHEET), "utf8")).toContain(
      "rgb(4, 5, 6)"
    )
    writeFileSync(
      path.join(root, "src/app/card.ts"),
      `import { css } from "@kirana-style/core"\nexport const a = css({ width: 5 })\n`
    )
    mirror.update("src/app/card.ts")
    expect(mirror.messages()[0]).toMatch(
      /^error\[KRN1203\] unitless-length: .*\(src\/app\/card\.ts:2:/
    )
    rmSync(path.join(root, "src/app/card.ts"))
    mirror.update("src/app/card.ts")
    expect(existsSync(path.join(root, MIRROR, "src/app/card.ts"))).toBe(false)
  })

  it("watches the source folder, ignoring hidden and installed files", async () => {
    const root = project({ "src/a.ts": CARD })
    const mirror = await createMirror(root, "src")
    const update = vi.spyOn(mirror, "update")
    const onUpdate = vi.fn()
    let listener: (event: string, name: unknown) => void = () => {}
    const closed = vi.fn()
    const handle = watchMirror(root, "src", mirror, onUpdate, ((
      _: string,
      __: unknown,
      callback: typeof listener
    ) => {
      listener = callback
      return { close: closed }
    }) as never)
    listener("change", "a.ts")
    listener("change", ".a.ts.swp")
    listener("change", path.join("node_modules", "x.ts"))
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(path.join("src", "a.ts"))
    expect(onUpdate).toHaveBeenCalledTimes(1)
    handle.close()
    expect(closed).toHaveBeenCalled()
    // By default it is the file system's own watcher.
    watchMirror(root, "src", mirror, () => {}).close()
  })
})

describe("D-068 the Angular CLI builders", () => {
  it("hand Angular's application builder the mirror, the stylesheet, and the entry left alone", async () => {
    const root = project({
      "src/main.ts": "bootstrap()\n",
      "src/app/card.ts": CARD,
    })
    const { context: fake, logged } = context(root, { root: "" })
    angular.options.length = 0
    const outputs = []
    for await (const output of application(
      { browser: "src/main.ts", styles: ["src/styles.css"] } as never,
      fake
    ))
      outputs.push(output)
    expect(outputs).toEqual([{ success: true }])
    expect(angular.options[0]).toMatchObject({
      fileReplacements: [{ replace: path.join("src", "app/card.ts") }],
      styles: ["src/styles.css", STYLESHEET],
    })
    expect(logged).toEqual([])
  })

  it("watch builds and the dev server keep the mirror up to date and report its diagnostics", async () => {
    const root = project({
      // An error, a warning, and an info (a bridged value), which stays quiet.
      "web/app/card.ts": `import { css } from "@kirana-style/core"\nexport const a = css({ color: { "[data-a]": "red", "[data-b]": "blue" }, width: 5 })\nexport const b = (w: string) => css({ height: w })\n`,
    })
    const { context: fake, logged } = context(root, { sourceRoot: "web" })
    angular.options.length = 0
    // While Angular runs, a source changes: the watcher mirrors it and reports again.
    angular.touch = async () => {
      writeFileSync(
        path.join(root, "web/app/card.ts"),
        readFileSync(path.join(root, "web/app/card.ts"), "utf8") + "\n"
      )
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    for await (const _ of application({ watch: true } as never, fake));
    expect(logged.some((line) => line.startsWith("error error[KRN1203]"))).toBe(
      true
    )
    expect(
      logged.some((line) => line.startsWith("warn warning[KRN1302]"))
    ).toBe(true)
    expect(logged.some((line) => line.includes("KRN1601"))).toBe(false)
    const reported = logged.length
    for await (const _ of devServer({} as never, fake));
    angular.touch = undefined
    expect(logged.length).toBeGreaterThan(reported)
    expect(angular.options[1]).toMatchObject({
      browser: "src/main.ts",
      fileReplacements: [{ replace: path.join("web", "app/card.ts") }],
      styles: ["src/styles.css", STYLESHEET],
    })
    // A project without metadata uses `src` under its root.
    const bare = context(project({ "src/a.ts": "" }), {}).context
    for await (const _ of application(
      {} as never,
      { ...bare, target: undefined } as never
    ));
  })

  it("leave options without replacements or styles as Angular expects them", () => {
    const mirror = { replacements: [], update: () => false, messages: () => [] }
    expect(withMirror({}, mirror)).toEqual({
      fileReplacements: [],
      styles: [STYLESHEET],
    })
    expect(applicationBuilder).toEqual(
      expect.objectContaining({ handler: expect.any(Function) })
    )
    expect(devServerBuilder).toEqual(
      expect.objectContaining({ handler: expect.any(Function) })
    )
  })

  it("ship Angular's own option schemas, the same as the installed @angular/build's", () => {
    const require = createRequire(import.meta.url)
    const build = path.dirname(require.resolve("@angular/build/package.json"))
    for (const [name, folder] of [
      ["application", "application"],
      ["dev-server", "dev-server"],
    ]) {
      // Compared as JSON: the copies are formatted with the repository's formatter.
      const read = (file: string) =>
        JSON.parse(readFileSync(file, "utf8")) as unknown
      expect(
        read(path.join(import.meta.dirname, `../schemas/${name}.json`))
      ).toEqual(read(path.join(build, `src/builders/${folder}/schema.json`)))
    }
  })
})
