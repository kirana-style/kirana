/**
 * The icon placeholder, resolved at install (KRN-DX-028, KRN-DX-033): a registry's markup names each
 * icon once for every library, `<IconPlaceholder lucide="ChevronDownIcon" hugeicons="ArrowDown01Icon"
 * … />` (shadcn/ui's convention), and the project gets its own library's component in its place,
 * every other attribute kept, with the library's import added and the placeholder's import dropped.
 * Where a framework has no maintained package for the library, and for every library on Angular,
 * whose placeholder is a directive on the `<svg>` itself (`<svg iconPlaceholder lucide="…">`), the
 * icon is written inline from the library's data (`inline-icons.ts`), and the file keeps the
 * library's notice. An Angular placeholder whose names are bound (`[lucide]="icon.lucide"`) is left
 * to the directive, which draws it at run time.
 */
import { addImport } from "@kirana-style/compiler"

import { ICON_NOTICES } from "./inline-icons.ts"
import type { InlineIcon } from "./inline-icons.ts"
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

/** Drawn inline from the library's data: no package has it for the framework. */
const INLINE = "inline"

/** shadcn/ui's table for React, and its counterparts for the other frameworks. */
const DRAWINGS: Record<
  Framework,
  Record<IconLibrary, Drawing | typeof INLINE>
> = {
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
  svelte: {
    lucide: {
      packages: ["@lucide/svelte"],
      imports: named("@lucide/svelte"),
      element: plain,
    },
    tabler: {
      packages: ["@tabler/icons-svelte"],
      imports: named("@tabler/icons-svelte"),
      element: plain,
    },
    hugeicons: {
      packages: ["@hugeicons/svelte", "@hugeicons/core-free-icons"],
      imports: (icons) => [
        `import { HugeiconsIcon } from "@hugeicons/svelte"`,
        ...named("@hugeicons/core-free-icons")(icons),
      ],
      element: (icon, rest) =>
        `<HugeiconsIcon icon={${icon}} strokeWidth={2}${rest} />`,
    },
    phosphor: {
      packages: ["phosphor-svelte"],
      imports: named("phosphor-svelte"),
      element: plain,
    },
    remixicon: INLINE,
  },
  solid: {
    lucide: {
      packages: ["lucide-solid"],
      imports: named("lucide-solid"),
      element: plain,
    },
    tabler: {
      packages: ["@tabler/icons-solidjs"],
      imports: named("@tabler/icons-solidjs"),
      element: plain,
    },
    hugeicons: INLINE,
    phosphor: INLINE,
    remixicon: INLINE,
  },
  angular: {
    lucide: INLINE,
    tabler: INLINE,
    hugeicons: INLINE,
    phosphor: INLINE,
    remixicon: INLINE,
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

/** An inline icon's `<svg>`: its own attributes but those the placeholder sets, then the placeholder's. */
function inlineSvg(icon: InlineIcon, rest: string): string {
  const own = icon.attributes
    .filter(([name]) => !new RegExp(`(^|\\s)\\[?${name}\\]?=`).test(rest))
    .map(([name, value]) => ` ${name}="${value}"`)
    .join("")
  return `<svg${own}${rest}>${icon.inner}</svg>`
}

/** The opening `<svg …>` at `start`: its attributes and the index after its `>`, past quoted values. */
function openingTag(
  text: string,
  start: number
): { attributes: string; end: number } {
  for (let at = start + "<svg".length; at < text.length; at++) {
    const char = text[at]!
    if (char === '"' || char === "'") {
      at = text.indexOf(char, at + 1)
      if (at < 0) break
    } else if (char === ">")
      return { attributes: text.slice(start + "<svg".length, at), end: at + 1 }
  }
  throw new RegistryError("an <svg> is not closed with >")
}

const PLACEHOLDER_DIRECTIVE = /(^|\s)iconPlaceholder(?=[\s=>]|$)/
/** The tag's text without the directive and the whitespace before it (a scan, not a pattern). */
function withoutDirective(text: string): string {
  // Called on a tag `angularPlaceholders` found by the directive.
  const found = PLACEHOLDER_DIRECTIVE.exec(text)!
  const at = found.index + found[1]!.length
  return text.slice(0, at).trimEnd() + text.slice(at + "iconPlaceholder".length)
}
const BOUND = new RegExp(`\\[(${ICON_LIBRARIES.join("|")})\\]=`)

/**
 * Whether `at` is on a comment's line (`//`, a block comment's `*`, `<!--`): a placeholder written
 * in documentation, which stays as written.
 */
function inComment(text: string, at: number): boolean {
  const line = text.slice(text.lastIndexOf("\n", at - 1) + 1, at)
  return /^\s*(\/\/|\/?\*|<!--)/.test(line)
}

/** Each Angular `<svg iconPlaceholder …></svg>`: its span, attributes, and whether its names are bound. */
function* angularPlaceholders(text: string) {
  for (
    let start = text.indexOf("<svg");
    start >= 0;
    start = text.indexOf("<svg", start + 1)
  ) {
    if (inComment(text, start)) continue
    const { attributes, end } = openingTag(text, start)
    if (!PLACEHOLDER_DIRECTIVE.test(attributes)) continue
    // `</svg >` and `</svg\n>` close it too, as a formatter writes an `<svg>` its parent hugs.
    const closing = /^\s*<\/svg\s*>/.exec(text.slice(end))
    yield {
      start,
      end: closing ? end + closing[0].length : -1,
      attributes,
      bound: BOUND.test(attributes),
    }
  }
}

/** Each `<IconPlaceholder … />`: its span and attributes. */
function* componentPlaceholders(text: string) {
  for (let start = text.indexOf("<IconPlaceholder"); start >= 0;) {
    if (inComment(text, start)) {
      start = text.indexOf("<IconPlaceholder", start + 1)
      continue
    }
    const end = endOf(text, start)
    yield {
      start,
      end,
      attributes: text.slice(start + "<IconPlaceholder".length, end - 2),
    }
    start = text.indexOf("<IconPlaceholder", end)
  }
}

/** The icons of `library` a file draws inline in `framework`: those its data must be read for. */
export function inlineNames(
  content: string,
  framework: Framework | undefined,
  library: IconLibrary
): string[] {
  if (framework === undefined || DRAWINGS[framework][library] !== INLINE)
    return []
  const placeholders =
    framework === "angular"
      ? [...angularPlaceholders(content)].filter((found) => !found.bound)
      : [...componentPlaceholders(content)]
  return [
    ...new Set(
      placeholders.flatMap(({ attributes }) => {
        const icon = split(attributes).icons[library]
        return icon === undefined ? [] : [icon]
      })
    ),
  ]
}

/** The notice an inlined copy of `library`'s icons keeps, as the framework's file writes a comment. */
function notice(framework: Framework, library: IconLibrary): string {
  const text = `Icons drawn from ${ICON_NOTICES[library]}.`
  return framework === "svelte" ? `<!-- ${text} -->\n` : `/* ${text} */\n`
}

/** An icon read for this file, or why it is missing (`plan` reads every one a file names). */
function inlineIcon(
  where: string,
  inline: ReadonlyMap<string, InlineIcon>,
  library: IconLibrary,
  icon: string
): InlineIcon {
  const found = inline.get(icon)
  if (found === undefined)
    throw new RegistryError(
      `${where}: the ${library} icon ${icon} was not read`
    )
  return found
}

/**
 * An Angular file's placeholders filled with `library`'s icons; the directive's import and its
 * `imports` entry dropped once none is left bound.
 */
function resolveAngular(
  where: string,
  content: string,
  library: IconLibrary,
  inline: ReadonlyMap<string, InlineIcon>
): string {
  let text = ""
  let from = 0
  let bound = false
  let drawn = false
  for (const found of angularPlaceholders(content)) {
    if (found.bound) {
      bound = true
      continue
    }
    if (found.end < 0)
      throw new RegistryError(
        `${where}: an <svg iconPlaceholder> holds content`
      )
    const { icons, rest } = split(found.attributes)
    const icon = icons[library]
    if (icon === undefined)
      throw new RegistryError(
        `${where}: an <svg iconPlaceholder> names no ${library} icon`
      )
    text +=
      content.slice(from, found.start) +
      inlineSvg(
        inlineIcon(where, inline, library, icon),
        // The directive, with the space before it, as `split` takes the library's names.
        withoutDirective(rest)
      )
    from = found.end
    drawn = true
  }
  if (!drawn) return content
  text += content.slice(from)
  if (!bound)
    text = text
      // The directive's import, and the statement when it named nothing else.
      .replace(
        /^import\s*\{([^}]*)\}\s*from\s*(["'][^"']+["'])\n/gm,
        (statement, names: string, module: string) => {
          const kept = names
            .split(",")
            .map((name) => name.trim())
            .filter((name) => name && name !== "IconPlaceholder")
          if (
            kept.length ===
            names.split(",").filter((name) => name.trim()).length
          )
            return statement
          return kept.length === 0
            ? ""
            : `import { ${kept.join(", ")} } from ${module}\n`
        }
      )
      // Its entry in a component's `imports`.
      .replace(/\bimports:\s*\[([^[\]]*)\]/g, (_, entries: string) => {
        const kept = entries
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry && entry !== "IconPlaceholder")
        return `imports: [${kept.join(", ")}]`
      })
  return notice("angular", library) + text
}

/**
 * A file's placeholders drawn with `library` in `framework`, and the packages that needs; the file
 * as it is when it uses none. Stops when a placeholder names no icon for the library, or the
 * framework is not known. An icon drawn inline comes from `inline`, which `plan` reads.
 */
export function resolveIcons(
  where: string,
  content: string,
  framework: Framework | undefined,
  library: IconLibrary,
  inline: ReadonlyMap<string, InlineIcon> = new Map()
): { content: string; packages: string[] } {
  if (framework === "angular")
    return content.includes("iconPlaceholder")
      ? {
          content: resolveAngular(where, content, library, inline),
          packages: [],
        }
      : { content, packages: [] }
  if (!content.includes("<IconPlaceholder")) return { content, packages: [] }
  if (framework === undefined)
    throw new RegistryError(
      `${where} draws icons, which a file for every framework cannot resolve yet`
    )
  const drawing = DRAWINGS[framework][library]
  const used = new Set<string>()
  let text = ""
  let from = 0
  for (const found of componentPlaceholders(content)) {
    const { icons, rest } = split(found.attributes)
    const icon = icons[library]
    if (icon === undefined)
      throw new RegistryError(
        `${where}: an <IconPlaceholder> names no ${library} icon`
      )
    used.add(icon)
    text +=
      content.slice(from, found.start) +
      (drawing === INLINE
        ? inlineSvg(inlineIcon(where, inline, library, icon), rest)
        : drawing.element(icon, rest))
    from = found.end
  }
  text += content.slice(from)
  text = withoutPlaceholderImports(text)
  if (drawing === INLINE)
    return { content: notice(framework, library) + text, packages: [] }
  const statements = drawing.imports([...used].sort())
  // A Vue or Svelte part's imports live in its <script>.
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
