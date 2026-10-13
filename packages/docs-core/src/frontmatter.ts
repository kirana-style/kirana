/**
 * The small YAML subset the documentation's frontmatter uses.
 *
 * `@tanstack/markdown` hands back the frontmatter block as raw text, and a full
 * YAML parser would be a dependency for four value shapes. Anything this does
 * not understand throws, so a typo in a page's frontmatter fails the build
 * instead of silently dropping a title.
 */

export type FrontmatterValue = string | number | boolean | string[]

const QUOTED = /^(["'])(.*)\1$/
const ARRAY = /^\[(.*)\]$/

/** Parses `key: value` lines, plus `- item` lists under a key. */
export function parseFrontmatter(
  text: string,
  file: string
): Record<string, FrontmatterValue> {
  const out: Record<string, FrontmatterValue> = {}
  let listKey: string | undefined

  for (const [index, line] of joinWrapped(text).entries()) {
    const where = `${file}:${index + 1}`
    if (!line.trim() || line.trimStart().startsWith("#")) continue

    if (line.startsWith("- ")) {
      if (!listKey) throw new Error(`${where}: list item without a key`)
      const list = out[listKey]
      if (!Array.isArray(list)) {
        throw new Error(`${where}: ${listKey} is not a list`)
      }
      list.push(scalar(line.slice(2).trim(), where) as string)
      continue
    }

    const colon = line.indexOf(":")
    if (colon < 0) {
      throw new Error(
        `${where}: expected \`key: value\`, got ${JSON.stringify(line)}`
      )
    }
    const key = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim()
    listKey = undefined

    if (!value) {
      out[key] = []
      listKey = key
      continue
    }
    out[key] = value.match(ARRAY)
      ? value
          .slice(1, -1)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => String(scalar(item, where)))
      : scalar(value, where)
  }
  return out
}

/**
 * One logical line per entry.
 *
 * The repository's formatter reflows markdown, and a long inline array ends up
 * spread over several lines — sometimes starting on the line after its key. Both
 * shapes are folded back before parsing.
 */
function joinWrapped(text: string): string[] {
  const lines: string[] = []
  let open = 0

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd()
    const depth = count(line, "[") - count(line, "]")
    const continues =
      open > 0 ||
      (lines.length > 0 &&
        /:\s*$/.test(lines.at(-1)!) &&
        line.trimStart().startsWith("["))

    if (continues) {
      lines[lines.length - 1] =
        `${lines.at(-1)!.replace(/\s+$/, "")} ${line.trim()}`
    } else {
      lines.push(line)
    }
    open = Math.max(0, open + depth)
  }
  return lines.map((line) => line.replace(/,\s*]/g, "]").replace(/\[\s+/g, "["))
}

const count = (text: string, character: string) =>
  text.split(character).length - 1

function scalar(value: string, where: string): FrontmatterValue {
  const quoted = value.match(QUOTED)
  if (quoted) return quoted[2]!
  if (value === "true") return true
  if (value === "false") return false
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  if (value.startsWith("[") || value.startsWith("{")) {
    throw new Error(
      `${where}: nested structures are not supported in frontmatter`
    )
  }
  return value
}
