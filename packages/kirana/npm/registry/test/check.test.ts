import { describe, expect, it } from "vite-plus/test"

import { check, hashOf, kindOf } from "../src/check.ts"
import {
  INDEX_SCHEMA,
  ITEM_SCHEMA,
  LOCKFILE_SCHEMA,
  NAMESPACE_PATTERN,
  REFERENCE_PATTERN,
} from "../src/schema.ts"
import type { Index, Item, Lockfile, RegistryFile } from "../src/types.ts"

const file = (
  path: string,
  type: RegistryFile["type"],
  content: string,
  extra: Partial<RegistryFile> = {}
): RegistryFile => ({ path, type, content, hash: hashOf(content), ...extra })

/** An item with every field: kirana-ui's button, cut down. */
const button: Item = {
  $schema: "https://kirana.style/schema/registry-item.json",
  name: "button",
  type: "component",
  title: "Button",
  description: "A button, in every style.",
  version: "0.1.0",
  kirana: ">=0.3.3 <0.4.0",
  registryDependencies: ["separator", "@kirana/icon-placeholder"],
  dependencies: { lucide: "^1.0.0" },
  axes: ["style", "menuColor"],
  styles: [file("button.styles.ts", "ui", "export const button = {}\n")],
  frameworks: {
    react: {
      base: {
        files: [file("button.tsx", "ui", "export function Button() {}\n")],
        dependencies: { "@base-ui/react": "^1.9.0" },
      },
      aria: { files: [file("button.tsx", "ui", "// aria\n")] },
    },
    vue: {
      ark: { files: [file("button/Button.vue", "ui", "<template />\n")] },
    },
  },
  files: [
    file("kirana.css", "file", "/* reset */\n", { target: "src/kirana.css" }),
  ],
  meta: { slots: ["button"] },
}

describe("KRN-DX-024 the integrity hash", () => {
  it("is sha256- and the base64 SHA-256 of the content's UTF-8 bytes", () => {
    expect(hashOf("")).toBe(
      "sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU="
    )
    expect(hashOf("é")).not.toBe(hashOf("e"))
  })
})

describe("kindOf: which document it is", () => {
  it("reads $schema first, then the shape, and takes anything else for an item", () => {
    expect(kindOf(null)).toBe("item")
    expect(kindOf("text")).toBe("item")
    expect(
      kindOf({ $schema: "https://kirana.style/schema/lockfile.json" })
    ).toBe("lockfile")
    expect(kindOf({ lockfileVersion: 1, items: {} })).toBe("lockfile")
    expect(
      kindOf({ $schema: "https://kirana.style/schema/registry-index.json" })
    ).toBe("index")
    expect(kindOf({ items: [] })).toBe("index")
    expect(kindOf({ $schema: 1, name: "button" })).toBe("item")
  })
})

describe("KRN-DX-021 an item", () => {
  it("is valid with every field", () => {
    expect(check(button)).toEqual({ kind: "item", problems: [] })
  })

  it("needs only its name, type and version", () => {
    expect(
      check({ name: "utils", type: "lib", version: "1.0.0-rc.1+build.5" })
        .problems
    ).toEqual([])
  })

  it("reports schema problems by JSON pointer, and checks no hash until the shape is right", () => {
    const { problems } = check({
      name: "Button",
      type: "widget",
      version: "1",
      frameworks: { qwik: {}, react: {} },
      registryDependencies: ["@Acme/card"],
      styles: [
        { path: "../escape.ts", type: "ui", content: "", hash: "md5-x" },
      ],
    })
    // In document order.
    expect(problems.map((problem) => problem.pointer)).toEqual([
      "/name",
      "/type",
      "/version",
      "/frameworks/qwik",
      "/frameworks/react",
      "/registryDependencies/0",
      "/styles/0/path",
      "/styles/0/hash",
    ])
  })

  it("refuses a file whose hash does not match its content", () => {
    const tampered = structuredClone(button)
    tampered.frameworks!.react!.base!.files[0]!.content =
      "export const evil = 1\n"
    expect(check(tampered).problems).toEqual([
      {
        pointer: "/frameworks/react/base/files/0/hash",
        message: `does not match the content, whose hash is ${hashOf("export const evil = 1\n")}`,
      },
    ])
  })

  it("wants a target on a file of type file, and on no other", () => {
    const item: Item = {
      name: "setup",
      type: "lib",
      version: "1.0.0",
      files: [
        file("globals.css", "file", ""),
        file("utils.ts", "lib", "", { target: "src/utils.ts" }),
      ],
    }
    expect(check(item).problems).toEqual([
      {
        pointer: "/files/0/target",
        message: "is required for a file of type file",
      },
      {
        pointer: "/files/1/target",
        message:
          "is only for a file of type file; a lib installs under its alias",
      },
    ])
  })

  it("wants a font on a font item, on no other, from a package it lists, and axis items for its values (KF-050)", () => {
    const lora: Item = {
      name: "font-lora",
      type: "font",
      version: "1.0.0",
      dependencies: { "@fontsource-variable/lora": "^5.2.0" },
      font: {
        family: "'Lora Variable', serif",
        import: "@fontsource-variable/lora/wght.css",
      },
    }
    expect(check(lora).problems).toEqual([])
    expect(
      check({ ...lora, font: { ...lora.font!, import: "lora" } }).problems
    ).toEqual([
      {
        pointer: "/font/import",
        message: "is in lora, which dependencies does not list",
      },
    ])
    expect(
      check({ ...lora, font: { family: "x", import: "Not A Package" } })
        .problems
    ).toEqual([expect.objectContaining({ pointer: "/font/import" })])
    const { dependencies: __, ...unlisted } = lora
    expect(check(unlisted).problems).toEqual([
      expect.objectContaining({ pointer: "/font/import" }),
    ])
    const { font: _, ...bare } = lora
    expect(check(bare).problems).toEqual([
      { pointer: "/font", message: "is required for a font item" },
    ])
    expect(check({ ...lora, type: "lib" }).problems).toEqual([
      {
        pointer: "/font",
        message: "is only for a font item; this one is a lib",
      },
    ])
    const kit: Item = {
      name: "kit",
      type: "design-system",
      version: "1.0.0",
      design: {
        axes: {
          font: {
            attribute: "data-font",
            values: ["inter", "lora"],
            items: { lora: "font-lora", serif: "@fonts/font-serif" },
          },
        },
      },
    }
    expect(check(kit).problems).toEqual([
      {
        pointer: "/design/axes/font/items/serif",
        message:
          "names an item for serif, which is not one of the axis's values",
      },
    ])
  })
})

describe("KRN-DX-022 an index", () => {
  it("lists items with their frameworks and bases", () => {
    const index: Index = {
      name: "Kirana UI",
      homepage: "https://ui.kirana.style",
      items: [
        {
          name: "button",
          type: "component",
          title: "Button",
          description: "A button.",
          version: "0.1.0",
          frameworks: { react: ["base", "aria"], vue: ["ark"] },
        },
      ],
    }
    expect(check(index)).toEqual({ kind: "index", problems: [] })
    expect(
      check({
        items: [
          {
            name: "x",
            type: "component",
            version: "0.1.0",
            frameworks: { react: [] },
          },
        ],
      }).problems
    ).toEqual([
      {
        pointer: "/items/0/frameworks/react",
        message: "must have at least 1 item",
      },
    ])
  })
})

describe("KRN-DX-025 the lockfile", () => {
  it("records each item by its namespace and name, with both hashes of each file", () => {
    const lockfile: Lockfile = {
      lockfileVersion: 1,
      items: {
        "@kirana/button": {
          registry: "https://ui.kirana.style/r/{name}.json",
          version: "0.1.0",
          framework: "react",
          base: "base",
          design: "k0",
          files: {
            "src/components/ui/button.tsx": {
              source: hashOf("a"),
              written: hashOf("b"),
            },
          },
        },
      },
    }
    expect(check(lockfile)).toEqual({ kind: "lockfile", problems: [] })
    expect(
      check({
        lockfileVersion: 2,
        items: { button: { registry: "", version: "1.0.0", files: {} } },
      }).problems
    ).toEqual([
      { pointer: "/lockfileVersion", message: "must be 1" },
      { pointer: "/items/button", message: "is not allowed here" },
    ])
  })
})

describe("the schemas", () => {
  it("are JSON documents with their own ids, in the subset the checks read", () => {
    for (const schema of [ITEM_SCHEMA, INDEX_SCHEMA, LOCKFILE_SCHEMA]) {
      expect(JSON.parse(JSON.stringify(schema))).toEqual(schema)
      expect(schema.$id).toMatch(/^https:\/\/kirana\.style\/schema\/.+\.json$/)
    }
  })

  it("name namespaces and references as the commands read them", () => {
    expect(NAMESPACE_PATTERN.test("@acme")).toBe(true)
    expect(NAMESPACE_PATTERN.test("acme")).toBe(false)
    expect(REFERENCE_PATTERN.test("@acme/date-picker")).toBe(true)
    expect(REFERENCE_PATTERN.test("button")).toBe(true)
    expect(REFERENCE_PATTERN.test("@acme/")).toBe(false)
  })
})
