/**
 * The component registry's documents as JSON Schema (draft 2020-12): an item, a registry's index and
 * a project's lockfile (KRN-DX-021 – KRN-DX-025, D-107). Other tools and editors check documents with
 * them; this package checks them with its own reading of the same objects (`validate.ts`), so the
 * format has one definition. They keep to the keywords `validate.ts` reads.
 */

/** A schema: a JSON Schema object, in the subset `validate.ts` implements. */
export type Schema = {
  $id?: string
  $schema?: string
  $ref?: string
  $defs?: Record<string, Schema>
  title?: string
  description?: string
  type?: "object" | "array" | "string" | "integer" | "boolean"
  properties?: Record<string, Schema>
  patternProperties?: Record<string, Schema>
  additionalProperties?: false | Schema
  required?: readonly string[]
  minProperties?: number
  items?: Schema
  minItems?: number
  enum?: readonly string[]
  const?: string | number
  pattern?: string
  minLength?: number
  anyOf?: readonly Schema[]
}

const DIALECT = "https://json-schema.org/draft/2020-12/schema"
const BASE = "https://kirana.style/schema"

/** A lower-case, hyphenated name: an item's, a base's, a namespace's after its `@`. */
const NAME = "[a-z0-9]+(-[a-z0-9]+)*"
/** A path inside the project: relative, and never above where it starts. */
const RELATIVE_PATH = "^(?!/)(?!.*(^|/)\\.\\.(/|$)).+$"

/** The frameworks an item can carry markup for. */
export const FRAMEWORKS = [
  "react",
  "vue",
  "svelte",
  "solid",
  "angular",
] as const
/** The item types. */
export const ITEM_TYPES = [
  "component",
  "block",
  "chart",
  "lib",
  "hook",
  "font",
  "design-system",
] as const
/** Where a file installs: under the project's alias for its type, or a `file` at its own `target`. */
export const FILE_TYPES = [
  "ui",
  "component",
  "lib",
  "hook",
  "page",
  "file",
] as const

const definitions: Record<string, Schema> = {
  name: { type: "string", pattern: `^${NAME}$` },
  installed: {
    type: "string",
    description:
      "An installed file, as its imports name it: `@/registry/<type>/<path>`.",
    pattern: "^@/registry/(ui|lib|component|hook|page)/.+$",
  },
  export: {
    type: "object",
    required: ["module", "export"],
    properties: {
      module: { $ref: "#/$defs/installed" },
      export: { type: "string", pattern: "^[A-Za-z_$][\\w$]*$" },
    },
    additionalProperties: false,
  },
  reference: {
    type: "string",
    description: "An item: `name` in the same registry, or `@namespace/name`.",
    pattern: `^(@${NAME}/)?${NAME}$`,
  },
  version: {
    type: "string",
    description: "A semantic version.",
    pattern: "^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z.-]+)?(\\+[0-9A-Za-z.-]+)?$",
  },
  hash: {
    type: "string",
    description:
      "`sha256-` and the base64 SHA-256 of the content's UTF-8 bytes, as subresource integrity writes it.",
    pattern: "^sha256-[A-Za-z0-9+/]{43}=$",
  },
  packages: {
    type: "object",
    description:
      "npm packages, by name, and the version ranges the item was built with.",
    patternProperties: {
      "^(@[^/\\s]+/)?[^/\\s]+$": { type: "string", minLength: 1 },
    },
    additionalProperties: false,
  },
  file: {
    type: "object",
    required: ["path", "type", "content", "hash"],
    properties: {
      path: {
        type: "string",
        description:
          "Relative to the place `type` names: `button.tsx` under the `ui` alias.",
        pattern: RELATIVE_PATH,
      },
      type: { type: "string", enum: FILE_TYPES },
      target: {
        type: "string",
        description: "A `file`'s place in the project, relative to its root.",
        pattern: RELATIVE_PATH,
      },
      content: { type: "string" },
      hash: { $ref: "#/$defs/hash" },
    },
    additionalProperties: false,
  },
  files: { type: "array", items: { $ref: "#/$defs/file" } },
  values: {
    type: "array",
    minItems: 1,
    items: { type: "string", minLength: 1 },
  },
  base: {
    type: "object",
    required: ["files"],
    properties: {
      files: { type: "array", minItems: 1, items: { $ref: "#/$defs/file" } },
      dependencies: { $ref: "#/$defs/packages" },
      registryDependencies: {
        type: "array",
        description: "Items only this base needs, beside the item's own.",
        items: { $ref: "#/$defs/reference" },
      },
    },
    additionalProperties: false,
  },
  framework: {
    type: "object",
    description: "The framework's bases, by name: `base`, `aria`, `ark` …",
    minProperties: 1,
    patternProperties: { [`^${NAME}$`]: { $ref: "#/$defs/base" } },
    additionalProperties: false,
  },
}

/** One item, as `ui add` installs it (KRN-DX-021). */
export const ITEM_SCHEMA: Schema = {
  $schema: DIALECT,
  $id: `${BASE}/registry-item.json`,
  title: "Kirana registry item",
  type: "object",
  required: ["name", "type", "version"],
  properties: {
    $schema: { type: "string" },
    name: { $ref: "#/$defs/name" },
    type: { type: "string", enum: ITEM_TYPES },
    title: { type: "string" },
    description: { type: "string" },
    version: { $ref: "#/$defs/version" },
    kirana: {
      type: "string",
      description:
        "The Kirana versions the item was built and checked with, as a range.",
      minLength: 1,
    },
    registryDependencies: {
      type: "array",
      items: { $ref: "#/$defs/reference" },
    },
    dependencies: { $ref: "#/$defs/packages" },
    axes: {
      type: "array",
      description:
        "The design axes its styles read, which installation flattens.",
      items: { type: "string", pattern: "^[a-z][A-Za-z0-9]*$" },
    },
    styles: { $ref: "#/$defs/files" },
    frameworks: {
      type: "object",
      properties: Object.fromEntries(
        FRAMEWORKS.map((framework) => [
          framework,
          { $ref: "#/$defs/framework" },
        ])
      ),
      additionalProperties: false,
    },
    files: { $ref: "#/$defs/files" },
    design: {
      type: "object",
      description:
        "A design system's axes and preset layouts (D-110): what `ui preset` reads.",
      required: ["axes"],
      properties: {
        axes: {
          type: "object",
          description:
            "Each axis by name: the attribute on <html> it is written to, and its values, the first the default.",
          minProperties: 1,
          patternProperties: {
            "^[A-Za-z][A-Za-z0-9]*$": {
              type: "object",
              required: ["attribute", "values"],
              properties: {
                attribute: { type: "string", pattern: "^data-[a-z0-9-]+$" },
                values: { $ref: "#/$defs/values" },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
        flatten: {
          type: "string",
          description: "The axis registries flatten style modules for.",
          minLength: 1,
        },
        presets: {
          type: "object",
          description:
            "Preset layouts by the letter a code starts with: fields from bit 0, each an axis, its values and its bits.",
          patternProperties: {
            "^[a-z]$": {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["axis", "values", "bits"],
                properties: {
                  axis: { type: "string", minLength: 1 },
                  values: { $ref: "#/$defs/values" },
                  bits: { type: "integer" },
                },
                additionalProperties: false,
              },
            },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    flattened: {
      type: "object",
      description:
        "Its style modules flattened for each value of `axis` and each base (D-110), in place of `styles`.",
      required: ["axis", "builds"],
      properties: {
        axis: { type: "string", minLength: 1 },
        builds: {
          type: "object",
          patternProperties: {
            "^.+$": {
              type: "object",
              patternProperties: {
                [`^${NAME}$`]: {
                  type: "array",
                  minItems: 1,
                  items: { $ref: "#/$defs/file" },
                },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    setup: {
      type: "object",
      description:
        "A design system's wiring (D-109): what `ui init` adds to a project once the item is installed.",
      properties: {
        config: {
          $ref: "#/$defs/export",
          description: "The configuration a project spreads into its own.",
        },
        stylesheets: {
          type: "array",
          description: "Stylesheets the app imports, after Kirana's.",
          items: { $ref: "#/$defs/installed" },
        },
        document: {
          $ref: "#/$defs/export",
          description: "The styles `<html>` takes.",
        },
      },
      additionalProperties: false,
    },
    meta: { type: "object" },
  },
  additionalProperties: false,
  $defs: definitions,
}

/** A registry's index: the item named `index`, which lists every item (KRN-DX-022). */
export const INDEX_SCHEMA: Schema = {
  $schema: DIALECT,
  $id: `${BASE}/registry-index.json`,
  title: "Kirana registry index",
  type: "object",
  required: ["items"],
  properties: {
    $schema: { type: "string" },
    name: { type: "string" },
    homepage: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "type", "version"],
        properties: {
          name: { $ref: "#/$defs/name" },
          type: { type: "string", enum: ITEM_TYPES },
          title: { type: "string" },
          description: { type: "string" },
          version: { $ref: "#/$defs/version" },
          frameworks: {
            type: "object",
            properties: Object.fromEntries(
              FRAMEWORKS.map((framework) => [
                framework,
                { type: "array", minItems: 1, items: { $ref: "#/$defs/name" } },
              ])
            ),
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
  $defs: definitions,
}

/** What a project installed: `kirana-style.lock.json` (KRN-DX-025). */
export const LOCKFILE_SCHEMA: Schema = {
  $schema: DIALECT,
  $id: `${BASE}/lockfile.json`,
  title: "Kirana lockfile",
  type: "object",
  required: ["lockfileVersion", "items"],
  properties: {
    $schema: { type: "string" },
    lockfileVersion: { const: 1 },
    items: {
      type: "object",
      patternProperties: {
        [`^@${NAME}/${NAME}$`]: {
          type: "object",
          required: ["registry", "version", "files"],
          properties: {
            registry: {
              type: "string",
              description: "The registry's URL template the item came from.",
              minLength: 1,
            },
            version: { $ref: "#/$defs/version" },
            framework: { type: "string", enum: FRAMEWORKS },
            base: { $ref: "#/$defs/name" },
            design: {
              type: "string",
              description: "The preset code the item was flattened for.",
              minLength: 1,
            },
            files: {
              type: "object",
              description: "Each installed file, by its path in the project.",
              patternProperties: {
                "^.+$": {
                  type: "object",
                  required: ["source", "written"],
                  properties: {
                    source: { $ref: "#/$defs/hash" },
                    written: { $ref: "#/$defs/hash" },
                  },
                  additionalProperties: false,
                },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
  $defs: definitions,
}

/** The icon libraries an `<IconPlaceholder>` names an icon for, as shadcn/ui's are. */
export const ICON_LIBRARIES = [
  "lucide",
  "tabler",
  "hugeicons",
  "phosphor",
  "remixicon",
] as const

/** The file types a project has an alias for: every type but `file`, which names its own target. */
export const ALIASED_TYPES = ["ui", "lib", "component", "hook", "page"] as const

/**
 * `ui` in `kirana.config.*`, as far as this release's commands read it (KRN-DX-022, KRN-DX-026,
 * KRN-DX-028). Its other keys belong to the commands still to come, so they pass.
 */
export const SETTINGS_SCHEMA: Schema = {
  $schema: DIALECT,
  $id: `${BASE}/settings.json`,
  title: "Kirana ui settings",
  type: "object",
  properties: {
    framework: {
      type: "string",
      description: "The framework whose markup `ui add` installs.",
      enum: FRAMEWORKS,
    },
    base: {
      type: "string",
      description:
        "The base whose markup `ui add` installs: `base`, `aria`, `ark` …",
      pattern: `^${NAME}$`,
    },
    iconLibrary: {
      type: "string",
      description: "The library `ui add` draws each `<IconPlaceholder>` with.",
      enum: ICON_LIBRARIES,
    },
    design: {
      type: "object",
      description:
        "The design system's axis values the project uses, which `ui preset` writes.",
      patternProperties: {
        "^[A-Za-z][A-Za-z0-9]*$": { type: "string", minLength: 1 },
      },
      additionalProperties: false,
    },
    aliases: {
      type: "object",
      description:
        "The import specifier for each file type, which the project's tsconfig.json maps to a directory.",
      properties: Object.fromEntries(
        ALIASED_TYPES.map((type) => [type, { type: "string", minLength: 1 }])
      ),
      additionalProperties: false,
    },
    registries: {
      type: "object",
      description:
        "Registries by namespace: a URL template holding {name}, or { url, headers }.",
      patternProperties: { [`^@${NAME}$`]: { $ref: "#/$defs/registry" } },
      additionalProperties: false,
    },
  },
  $defs: {
    template: {
      type: "string",
      description:
        "A URL, a path or a file: URL holding {name}, the item's name.",
      pattern: "\\{name\\}",
    },
    registry: {
      anyOf: [
        { $ref: "#/$defs/template" },
        {
          type: "object",
          required: ["url"],
          properties: {
            url: { $ref: "#/$defs/template" },
            headers: {
              type: "object",
              description:
                "HTTP headers, each value able to read the environment as ${NAME}.",
              patternProperties: {
                "^[!#$%&'*+.^_`|~0-9A-Za-z-]+$": { type: "string" },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      ],
    },
  },
}

/** A namespace as `ui.registries` names it: `@acme`. */
export const NAMESPACE_PATTERN = new RegExp(`^@${NAME}$`)
/** An item as a command names it: `button`, or `@acme/card`. */
export const REFERENCE_PATTERN = new RegExp(`^(@${NAME}/)?${NAME}$`)
