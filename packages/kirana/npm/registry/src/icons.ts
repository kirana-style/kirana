/**
 * The icon placeholder, resolved at install (KRN-DX-028): a registry's markup names each icon once
 * for every library, `<IconPlaceholder lucide="ChevronDownIcon" hugeicons="ArrowDown01Icon" … />`
 * (shadcn/ui's convention), and the project gets its own library's component in its place, every
 * other attribute kept, with the library's import added and the placeholder's import dropped.
 */
import { addImport } from "@kirana-style/compiler"

import { RegistryError } from "./read.ts"
import { ICON_LIBRARIES } from "./schema.ts"
import type { Framework, IconLibrary } from "./types.ts"

/** How a library draws an icon in one framework: its packages, its import, and the element. */
type Drawing = {
  packages: string[]
  /** The import statements for these icons. */
  imports: (icons: string[]) => string[]
  /** The element, given the icon's name and the placeholder's other attributes. */
  element: (icon: string, rest: string) => string
}

const named = (from: string) => (icons: string[]) => [
  `import { ${icons.join(", ")} } from "${from}"`,
]
const plain = (icon: string, rest: string) => `<${icon}${rest} />`

/** shadcn/ui's table for React, and its counterpart for Vue. */
const DRAWINGS: Partial<Record<Framework, Record<IconLibrary, Drawing>>> = {
  react: {
    lucide: {
      packages: ["lucide-react"],
      imports: named("lucide-react"),
      element: plain,
    },
    tabler: {
      packages: ["@tabler/icons-react"],
      imports: named("@tabler/icons-react"),
      element: plain,
    },
    hugeicons: {
      packages: ["@hugeicons/react", "@hugeicons/core-free-icons"],
      imports: (icons) => [
        `import { HugeiconsIcon } from "@hugeicons/react"`,
        ...named("@hugeicons/core-free-icons")(icons),
      ],
      element: (icon, rest) =>
        `<HugeiconsIcon icon={${icon}} strokeWidth={2}${rest} />`,
    },
    phosphor: {
      packages: ["@phosphor-icons/react"],
      imports: named("@phosphor-icons/react"),
      element: plain,
    },
    remixicon: {
      packages: ["@remixicon/react"],
      imports: named("@remixicon/react"),
      element: plain,
    },
  },
  vue: {
    lucide: {
      packages: ["@lucide/vue"],
      imports: named("@lucide/vue"),
      element: plain,
    },
    tabler: {
      packages: ["@tabler/icons-vue"],
      imports: named("@tabler/icons-vue"),
      element: plain,
    },
    hugeicons: {
      packages: ["@hugeicons/vue", "@hugeicons/core-free-icons"],
      imports: (icons) => [
        `import { HugeiconsIcon } from "@hugeicons/vue"`,
        ...named("@hugeicons/core-free-icons")(icons),
      ],
      element: (icon, rest) =>
        `<HugeiconsIcon :icon="${icon}" :stroke-width="2"${rest} />`,
    },
    phosphor: {
      packages: ["@phosphor-icons/vue"],
      imports: named("@phosphor-icons/vue"),
      element: plain,
    },
    remixicon: {
      packages: ["@remixicon/vue"],
      imports: named("@remixicon/vue"),
      element: plain,
    },
  },
}

/** The text without its imports of the placeholder's module, whatever the item calls it. */
function withoutPlaceholderImports(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const statement = line.trimStart()
      if (!statement.startsWith("import ")) return true
      const from = statement.lastIndexOf(" from ")
      const module = from < 0 ? "" : statement.slice(from + " from ".length)
      return !(
        module.includes("icon-placeholder") ||
        module.includes("IconPlaceholder")
      )
    })
    .join("\n")
}

/**
 * The end of the element opened at `start` (`<IconPlaceholder`): the index after its `/>`, past
 * strings and braces, so an attribute's `>` (an arrow) does not end it.
 */
function endOf(text: string, start: number): number {
  let depth = 0
  for (let at = start; at < text.length; at++) {
    const char = text[at]!
    if (char === '"' || char === "'" || char === "`") {
      at = text.indexOf(char, at + 1)
      if (at < 0) break
    } else if (char === "{") depth++
    else if (char === "}") depth--
    else if (depth === 0 && char === "/" && text[at + 1] === ">") return at + 2
  }
  throw new RegistryError("an <IconPlaceholder> is not closed with />")
}

/** The library attributes a placeholder names (`lucide="X"`), and what is left of it. */
function split(attributes: string): {
  icons: Partial<Record<IconLibrary, string>>
  rest: string
} {
  const icons: Partial<Record<IconLibrary, string>> = {}
  const rest = attributes.replace(
    new RegExp(`\\s+(${ICON_LIBRARIES.join("|")})="([^"]*)"`, "g"),
    (_, library: IconLibrary, icon: string) => {
      icons[library] = icon
      return ""
    }
  )
  return { icons, rest: rest.trimEnd() }
}

/**
 * A file's placeholders drawn with `library` in `framework`, and the packages that needs; the file
 * as it is when it uses none. Stops when a placeholder names no icon for the library, or the
 * framework has no table.
 */
export function resolveIcons(
  where: string,
  content: string,
  framework: Framework | undefined,
  library: IconLibrary
): { content: string; packages: string[] } {
  if (!content.includes("<IconPlaceholder")) return { content, packages: [] }
  const drawing =
    framework === undefined ? undefined : DRAWINGS[framework]?.[library]
  if (drawing === undefined)
    throw new RegistryError(
      `${where} draws icons, which ${framework ?? "a file for every framework"} cannot resolve yet`
    )
  const used = new Set<string>()
  let text = ""
  let from = 0
  for (
    let start = content.indexOf("<IconPlaceholder", from);
    start >= 0;
    start = content.indexOf("<IconPlaceholder", from)
  ) {
    const end = endOf(content, start)
    const attributes = content.slice(start + "<IconPlaceholder".length, end - 2)
    const { icons, rest } = split(attributes)
    const icon = icons[library]
    if (icon === undefined)
      throw new RegistryError(
        `${where}: an <IconPlaceholder> names no ${library} icon`
      )
    used.add(icon)
    text += content.slice(from, start) + drawing.element(icon, rest)
    from = end
  }
  text += content.slice(from)
  text = withoutPlaceholderImports(text)
  const statements = drawing.imports([...used].sort())
  // A Vue part's imports live in its <script setup>.
  const script = /<script\b[^>]*>\n?/i.exec(text)
  if (script) {
    const at = script.index + script[0].length
    const close = text.indexOf("</script>", at)
    let body = text.slice(at, close)
    for (const statement of statements) body = addImport(body, statement)
    text = text.slice(0, at) + body + text.slice(close)
  } else for (const statement of statements) text = addImport(text, statement)
  return { content: text, packages: drawing.packages }
}
