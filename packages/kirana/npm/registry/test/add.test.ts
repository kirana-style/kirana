import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, describe, expect, it } from "vite-plus/test"

import { hashOf } from "../src/check.ts"
import { runInShell } from "../src/add.ts"
import { main } from "../src/index.ts"
import { readLockfile, writeLockfile } from "../src/lockfile.ts"
import { aliasDirectory, frameworkOf, readProject } from "../src/project.ts"
import type { Item, RegistryFile } from "../src/types.ts"

const root = mkdtempSync(path.join(tmpdir(), "kirana-registry-add-"))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const file = (
  where: string,
  type: RegistryFile["type"],
  content: string,
  target?: string
): RegistryFile => ({
  path: where,
  type,
  content,
  hash: hashOf(content),
  ...(target === undefined ? {} : { target }),
})

/** A design system, the React-only helper its markup imports, and a component on two bases. */
const KIT: Item = {
  name: "kit",
  type: "design-system",
  version: "1.0.0",
  dependencies: { "@kirana-style/core": "^0.3.2" },
  files: [
    file("kit/axes.ts", "lib", "export const axes = {}\n"),
    file("globals.css", "file", ":root {}\n", "app/globals.css"),
  ],
}
const SX: Item = {
  name: "sx",
  type: "lib",
  version: "1.0.0",
  frameworks: {
    react: { base: { files: [file("sx.ts", "lib", "export type Sx = {}\n")] } },
  },
}
const BUTTON: Item = {
  name: "button",
  type: "component",
  version: "1.2.0",
  registryDependencies: ["kit"],
  styles: [
    file(
      "button.styles.ts",
      "ui",
      'import { axes } from "@/registry/lib/kit/axes"\nexport const button = axes\n'
    ),
  ],
  frameworks: {
    react: {
      base: {
        files: [
          file(
            "button.tsx",
            "ui",
            "import { button } from \"@/registry/ui/button.styles\"\nimport type { Sx } from '@/registry/lib/sx'\nexport const Button = () => button\n"
          ),
        ],
        dependencies: { "@base-ui/react": "^1.9.0" },
        registryDependencies: ["sx"],
      },
      aria: {
        files: [file("button.tsx", "ui", "export const Button = 1\n")],
        dependencies: { "react-aria-components": "^1.22.1" },
      },
    },
    vue: { ark: { files: [file("button/Button.vue", "ui", "<template/>\n")] } },
  },
}

/** A project with a registry `@acme` on disk holding these items, and these settings. */
function project(
  ui: Record<string, unknown> = { base: "base" },
  items: Item[] = [KIT, SX, BUTTON],
  extra: Record<string, string> = {}
): string {
  const directory = mkdtempSync(path.join(root, "project-"))
  const files: Record<string, string> = {
    "package.json": JSON.stringify({
      dependencies: { react: "^19.0.0", "@kirana-style/core": "0.3.2" },
    }),
    "tsconfig.json":
      '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }',
    "kirana.config.json": JSON.stringify({
      ui: { registries: { "@acme": "acme/{name}.json" }, ...ui },
    }),
    ...Object.fromEntries(
      items.map((item) => [`acme/${item.name}.json`, JSON.stringify(item)])
    ),
    ...extra,
  }
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(directory, name)), { recursive: true })
    writeFileSync(path.join(directory, name), text)
  }
  return directory
}

async function add(cwd: string, ...argv: string[]) {
  let text = ""
  const commands: string[] = []
  const code = await main(
    ["add", ...argv],
    cwd,
    (chunk) => void (text += chunk),
    { run: (command) => (commands.push(command), 0) }
  )
  return { code, text, commands }
}

const read = (cwd: string, name: string) =>
  readFileSync(path.join(cwd, name), "utf8")

describe("KRN-DX-028 kirana-style ui add", () => {
  it("installs an item after the items it needs, at the project's aliases, and records them", async () => {
    const cwd = project()
    const { code, text, commands } = await add(cwd, "@acme/button")
    expect(code).toBe(0)
    expect(text.split("\n")).toEqual([
      "@acme/kit 1.0.0",
      "  + src/lib/kit/axes.ts",
      "  + app/globals.css",
      "@acme/sx 1.0.0 · react/base",
      "  + src/lib/sx.ts",
      "@acme/button 1.2.0 · react/base",
      "  + src/components/ui/button.styles.ts",
      "  + src/components/ui/button.tsx",
      "packages: npm install @base-ui/react@^1.9.0",
      "kirana-style.lock.json: 3 item(s) recorded",
      "check: kirana-style check on 4 file(s)",
      "0 diagnostic(s), 0 error(s)",
      "",
    ])
    // The project already lists @kirana-style/core; the rest goes to its package manager.
    expect(commands).toEqual(["npm install @base-ui/react@^1.9.0"])
    expect(read(cwd, "src/components/ui/button.tsx")).toBe(
      "import { button } from \"@/components/ui/button.styles\"\nimport type { Sx } from '@/lib/sx'\nexport const Button = () => button\n"
    )
    expect(read(cwd, "src/components/ui/button.styles.ts")).toContain(
      'from "@/lib/kit/axes"'
    )
    const lockfile = readLockfile(cwd)
    expect(Object.keys(lockfile.items)).toEqual([
      "@acme/button",
      "@acme/kit",
      "@acme/sx",
    ])
    const button = lockfile.items["@acme/button"]!
    expect(button).toMatchObject({
      registry: "acme/{name}.json",
      version: "1.2.0",
      framework: "react",
      base: "base",
    })
    const styles = button.files["src/components/ui/button.styles.ts"]!
    expect(styles.source).toBe(BUTTON.styles![0]!.hash)
    expect(styles.written).toBe(
      hashOf(read(cwd, "src/components/ui/button.styles.ts"))
    )
    expect(lockfile.items["@acme/kit"]).not.toHaveProperty("framework")
  })

  it("leaves what is the same, and changes nothing a project edited unless told to", async () => {
    const cwd = project()
    await add(cwd, "@acme/button")
    const again = await add(cwd, "@acme/button")
    expect(again.code).toBe(0)
    expect(again.text).toContain("  = src/components/ui/button.tsx")
    writeFileSync(path.join(cwd, "src/lib/sx.ts"), "// mine\n")
    const refused = await add(cwd, "@acme/button")
    expect(refused.code).toBe(1)
    expect(refused.text).toContain("  ! src/lib/sx.ts")
    expect(refused.text).toContain(
      "1 file(s) the project has would change (!): nothing written; --overwrite replaces them"
    )
    expect(refused.commands).toEqual([])
    expect(read(cwd, "src/lib/sx.ts")).toBe("// mine\n")
    expect((await add(cwd, "@acme/button", "--overwrite")).code).toBe(0)
    expect(read(cwd, "src/lib/sx.ts")).toBe("export type Sx = {}\n")
  })

  it("writes nothing on a dry run", async () => {
    const cwd = project()
    const { code, text, commands } = await add(cwd, "--dry-run", "@acme/button")
    expect(code).toBe(0)
    expect(text).toMatch(/dry run: nothing written\n$/)
    expect(commands).toEqual([])
    expect(() => read(cwd, "src/lib/sx.ts")).toThrow()
    expect(() => read(cwd, "kirana-style.lock.json")).toThrow()
  })

  it("takes the framework the project depends on, and its only base", async () => {
    const vue = project({}, [KIT, BUTTON], {
      "package.json": JSON.stringify({
        dependencies: { vue: "^3.5.0", "@kirana-style/core": "0.3.2" },
      }),
    })
    // Nothing to install, so the package manager's runner, left as it is, is never called.
    let text = ""
    const code = await main(["add", "@acme/button"], vue, (chunk) => {
      text += chunk
    })
    expect(code).toBe(0)
    expect(text).toContain("@acme/button 1.2.0 · vue/ark")
    expect(text).not.toContain("packages:")
    expect(read(vue, "src/components/ui/button/Button.vue")).toBe(
      "<template/>\n"
    )
    const aria = project({ framework: "react", base: "aria" }, [KIT, BUTTON])
    expect((await add(aria, "@acme/button")).text).toContain("· react/aria")
  })

  it("says what an item supports when the project cannot take it", async () => {
    const several = await add(project({}), "@acme/button")
    expect(several).toMatchObject({ code: 1, commands: [] })
    expect(several.text).toBe(
      "@acme/button has several react bases (base, aria): set ui.base in kirana.config\n"
    )
    expect((await add(project({ base: "radix" }), "@acme/button")).text).toBe(
      "@acme/button has no react markup for the base radix: it has base, aria\n"
    )
    expect(
      (await add(project({ framework: "svelte" }), "@acme/button")).text
    ).toBe(
      "@acme/button has no markup for svelte: it supports react (base, aria), vue (ark)\n"
    )
    const unknown = project({}, [KIT, BUTTON], {
      "package.json": JSON.stringify({
        dependencies: { react: "19", vue: "3" },
      }),
    })
    expect((await add(unknown, "@acme/button")).text).toBe(
      "@acme/button has markup for react (base, aria), vue (ark): set ui.framework in kirana.config\n"
    )
  })

  it("stops on what is not an item, an item no installed one provides for, or two at one place", async () => {
    const cwd = project()
    expect((await add(cwd, "../x")).text).toBe(
      "../x is not an item: @namespace/name, or a name for @kirana's\n"
    )
    writeFileSync(
      path.join(cwd, "acme/index.json"),
      JSON.stringify({ items: [] })
    )
    expect((await add(cwd, "@acme/index")).text).toBe(
      "@acme/index is an index, not an item\n"
    )
    const lonely: Item = {
      ...BUTTON,
      name: "lonely",
      registryDependencies: [],
      frameworks: undefined,
    }
    expect((await add(project({}, [lonely]), "@acme/lonely")).text).toBe(
      "@acme/lonely: button.styles.ts imports @/registry/lib/kit/axes, which no item being installed provides\n"
    )
    const odd: Item = {
      name: "odd",
      type: "lib",
      version: "1.0.0",
      files: [file("odd.ts", "lib", 'import x from "@/registry/file/x"\n')],
    }
    expect((await add(project({}, [odd]), "@acme/odd")).text).toBe(
      "@acme/odd: odd.ts imports @/registry/file/x, a type without an alias\n"
    )
    const twin: Item = { ...SX, name: "twin" }
    const both: Item = {
      name: "both",
      type: "lib",
      version: "1.0.0",
      registryDependencies: ["sx", "twin"],
    }
    expect(
      (await add(project({ base: "base" }, [SX, twin, both]), "@acme/both"))
        .text
    ).toBe("@acme/twin and @acme/sx both install src/lib/sx.ts\n")
    const page: Item = {
      name: "page",
      type: "block",
      version: "1.0.0",
      files: [file("home.tsx", "page", "export default 1\n")],
    }
    expect((await add(project({}, [page]), "@acme/page")).text).toBe(
      "@acme/page installs a page file: set ui.aliases.page in kirana.config\n"
    )
    const routed = project({ aliases: { page: "@/app" } }, [page])
    expect((await add(routed, "@acme/page")).code).toBe(0)
    expect(read(routed, "src/app/home.tsx")).toBe("export default 1\n")
  })

  it("needs an item, knows its options, and stops on settings or a lockfile it cannot use", async () => {
    const cwd = project()
    expect(await add(cwd)).toMatchObject({
      code: 2,
      text: "kirana-style ui add needs at least one item\n",
    })
    expect(await add(cwd, "--force", "x")).toMatchObject({
      code: 2,
      text: "kirana-style ui add: unknown option --force\n",
    })
    writeFileSync(path.join(cwd, "kirana-style.lock.json"), "{")
    expect((await add(cwd, "@acme/sx")).text).toMatch(
      /^kirana-style\.lock\.json: not JSON: /
    )
    writeFileSync(path.join(cwd, "kirana-style.lock.json"), "[]")
    expect((await add(cwd, "@acme/sx")).text).toBe(
      "kirana-style.lock.json: / must be an object\n"
    )
    writeFileSync(path.join(cwd, "kirana-style.lock.json"), '{"items":{}}')
    expect((await add(cwd, "@acme/sx")).text).toBe(
      "kirana-style.lock.json: /lockfileVersion is required\n"
    )
    writeFileSync(
      path.join(cwd, "kirana.config.json"),
      '{"ui":{"framework":"jquery"}}'
    )
    const broken = await add(cwd, "@acme/sx")
    expect(broken.code).toBe(2)
    expect(broken.text).toMatch(/ui\/framework must be one of/)
  })

  it("draws icons with the project's library, adding its package unless the project lists it", async () => {
    const icon: Item = {
      name: "chevron",
      type: "component",
      version: "1.0.0",
      files: [
        file(
          "chevron.tsx",
          "ui",
          'import { IconPlaceholder } from "@/registry/lib/icons/icon-placeholder"\nexport const C = () => <IconPlaceholder lucide="ChevronDownIcon" hugeicons="ArrowDown01Icon" />\n'
        ),
      ],
    }
    const lucide = project({}, [icon])
    const drawn = await add(lucide, "@acme/chevron")
    expect(drawn.commands).toEqual(["npm install lucide-react"])
    expect(read(lucide, "src/components/ui/chevron.tsx")).toBe(
      'import { ChevronDownIcon } from "lucide-react"\n\nexport const C = () => <ChevronDownIcon />\n'
    )
    const huge = project({ iconLibrary: "hugeicons" }, [icon], {
      "package.json": JSON.stringify({
        dependencies: {
          react: "19",
          "@hugeicons/react": "1",
          "@hugeicons/core-free-icons": "4",
        },
      }),
    })
    const listed = await add(huge, "@acme/chevron")
    expect(listed.commands).toEqual([])
    expect(read(huge, "src/components/ui/chevron.tsx")).toContain(
      "<HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />"
    )
  })

  it("checks what it wrote with Kirana, unless told not to", async () => {
    const wrong: Item = {
      name: "wrong",
      type: "lib",
      version: "1.0.0",
      files: [
        file(
          "wrong.ts",
          "lib",
          'import { css } from "@kirana-style/core"\nexport const a = css({ colour: "red" })\n'
        ),
        file("wrong.css", "lib", ".a {}\n"),
      ],
    }
    const checked = await add(project({}, [wrong]), "@acme/wrong")
    expect(checked.code).toBe(1)
    expect(checked.text).toContain(
      "unknown-property: colour is not a CSS property"
    )
    expect(checked.text).toMatch(
      /kirana-style check found errors in what was written \(above\)\n$/
    )
    const skipped = await add(project({}, [wrong]), "@acme/wrong", "--no-check")
    expect(skipped.code).toBe(0)
    expect(skipped.text).not.toContain("check:")
    // Nothing to check: a stylesheet alone.
    const sheet: Item = { ...wrong, name: "sheet", files: [wrong.files![1]!] }
    const plain = await add(project({}, [sheet]), "@acme/sheet")
    expect(plain.code).toBe(0)
    expect(plain.text).not.toContain("check:")
  })

  it("leaves out a design system's unread relations in its check, not another item's (KF-035)", async () => {
    const declaring = (name: string) =>
      `import { css, relation } from "@kirana-style/core"\nexport const ${name} = relation("${name}")\nexport const html = css(${name}.anchor, { color: "red" })\n`
    const deck: Item = {
      name: "deck",
      type: "design-system",
      version: "1.0.0",
      files: [file("deck/relation.ts", "lib", declaring("deck"))],
    }
    const orphan: Item = {
      name: "orphan",
      type: "lib",
      version: "1.0.0",
      files: [file("orphan/relation.ts", "lib", declaring("orphan"))],
    }
    const { code, text } = await add(
      project({}, [deck, orphan]),
      "@acme/deck",
      "@acme/orphan"
    )
    expect(code).toBe(0)
    // The design system's relation is read by items not installed yet; the other item's is a finding.
    expect(text).not.toContain('relation "deck"')
    expect(text).toContain(
      'warning[KRN1402] relation-unused: relation "orphan" is anchored but never read (src/lib/orphan/relation.ts:2:'
    )
    expect(text).toMatch(/1 diagnostic\(s\), 0 error\(s\)\n$/)
    // A diagnostic without a span names its file alone.
    const reader: Item = {
      name: "reader",
      type: "lib",
      version: "1.0.0",
      files: [
        file(
          "reader.ts",
          "lib",
          'import { css, relation } from "@kirana-style/core"\nconst field = relation("field")\nexport const x = css({ color: { [field.within(":hover")]: "red" } })\n'
        ),
      ],
    }
    const unanchored = await add(project({}, [reader]), "@acme/reader")
    expect(unanchored.code).toBe(1)
    expect(unanchored.text).toContain(
      'error[KRN1401] relation-without-anchor: relation "field" is read but its anchor is never applied (src/lib/reader.ts)\n'
    )
  })

  it("says so when the check cannot read the project's configuration", async () => {
    const cwd = project({}, [KIT], {
      "kirana.config.json": JSON.stringify({
        names: 5,
        ui: { registries: { "@acme": "acme/{name}.json" } },
      }),
    })
    const { code, text } = await add(cwd, "@acme/kit")
    expect(code).toBe(1)
    expect(text).toContain("invalid-config")
    expect(text).toMatch(
      /kirana-style check could not run on what was written \(above\)\n$/
    )
  })

  it("reads a dependency named in full, and an item asked for twice once", async () => {
    const full: Item = { ...BUTTON, registryDependencies: ["@acme/kit"] }
    const cwd = project({ base: "aria" }, [KIT, full])
    const { code, text } = await add(cwd, "@acme/button", "@acme/kit")
    expect(code).toBe(0)
    expect(text.match(/^@acme\/kit /gm)).toHaveLength(1)
  })

  it("runs the package manager in a shell, a signal as a failure", () => {
    expect(runInShell("exit 3", root)).toBe(3)
    expect(runInShell("kill -9 $$", root)).toBe(1)
  })

  it("keeps the files when a package fails to install, and says the lockfile is not written", async () => {
    const cwd = project()
    let text = ""
    const code = await main(
      ["add", "@acme/button"],
      cwd,
      (chunk) => void (text += chunk),
      { run: () => 1 }
    )
    expect(code).toBe(1)
    expect(text).toMatch(
      /npm install @base-ui\/react@\^1\.9\.0 failed: the files are written, the lockfile is not\n$/
    )
    expect(read(cwd, "src/lib/sx.ts")).toBe("export type Sx = {}\n")
    expect(() => read(cwd, "kirana-style.lock.json")).toThrow()
  })
})

describe("D-108 where an alias points", () => {
  const write = (files: Record<string, string>) => {
    const directory = mkdtempSync(path.join(root, "tsconfig-"))
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(directory, name)), { recursive: true })
      writeFileSync(path.join(directory, name), text)
    }
    return directory
  }

  it("reads tsconfig.json's paths, the closest match, from baseUrl", () => {
    const cwd = write({
      "tsconfig.json": `{
        // comments are allowed
        "compilerOptions": {
          "baseUrl": "./app",
          "paths": { "@/*": ["./*"], "@/ui": ["./design/ui"], "~/*": ["./x/*"], "#": [] },
        },
      }`,
    })
    expect(aliasDirectory(cwd, "@/components/ui")).toBe(
      path.join(cwd, "app/components/ui")
    )
    expect(aliasDirectory(cwd, "@/ui")).toBe(path.join(cwd, "app/design/ui"))
    expect(() => aliasDirectory(cwd, "lib")).toThrow(
      'lib: no compilerOptions.paths entry in tsconfig.json maps it to a directory (for example "@/*": ["./src/*"])'
    )
  })

  it("follows extends, then references, as Vite's and Next.js's templates split them", () => {
    const extended = write({
      "tsconfig.json": '{ "extends": "./tsconfig.base.json" }',
      "tsconfig.base.json":
        '{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }',
    })
    expect(aliasDirectory(extended, "@/lib")).toBe(
      path.join(extended, "src/lib")
    )
    const referenced = write({
      "tsconfig.json":
        '{ "extends": "@tsconfig/strictest", "references": [{ "path": "./tsconfig.node.json" }, { "path": "./app" }, {}] }',
      "tsconfig.node.json": '{ "references": [{ "path": "./tsconfig.json" }] }',
      "app/tsconfig.json":
        '{ "compilerOptions": { "paths": { "@/*": ["../src/*"] } } }',
    })
    expect(aliasDirectory(referenced, "@/lib")).toBe(
      path.join(referenced, "src/lib")
    )
    expect(() => aliasDirectory(write({}), "@/lib")).toThrow(
      "no compilerOptions"
    )
  })

  it("names the framework only when the project depends on exactly one", () => {
    const of = (dependencies: Record<string, string>) =>
      frameworkOf(
        readProject(write({ "package.json": JSON.stringify({ dependencies }) }))
      )
    expect(of({ "solid-js": "1" })).toBe("solid")
    expect(of({ "@angular/core": "20", svelte: "5" })).toBeUndefined()
    expect(of({})).toBeUndefined()
  })
})

describe("KRN-DX-025 the lockfile, written", () => {
  it("sorts its items and their files", () => {
    const cwd = mkdtempSync(path.join(root, "lock-"))
    const entry = (files: string[]) => ({
      registry: "r/{name}.json",
      version: "1.0.0",
      files: Object.fromEntries(
        files.map((name) => [name, { source: hashOf(""), written: hashOf("") }])
      ),
    })
    writeLockfile(cwd, {
      lockfileVersion: 1,
      items: { "@b/y": entry(["z.ts", "a.ts"]), "@a/x": entry([]) },
    })
    const text = readFileSync(path.join(cwd, "kirana-style.lock.json"), "utf8")
    expect(text.indexOf("@a/x")).toBeLessThan(text.indexOf("@b/y"))
    expect(text.indexOf('"a.ts"')).toBeLessThan(text.indexOf('"z.ts"'))
    expect(readLockfile(cwd).items["@b/y"]!.version).toBe("1.0.0")
  })
})
